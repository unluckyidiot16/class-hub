// scripts/seedQuizmonFromJson.cjs
// JSON(moves.json / learnsets.json) → Supabase 테이블(seed) 스크립트

require("dotenv").config({ path: ".env.seed" }); // 필요하면 경로 바꿔도 됨

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

/** ---------- 0. Supabase 클라이언트 생성 ---------- */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
        "[seedQuizmon] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.",
    );
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
});

/** ---------- 1. JSON 로드 ---------- */

// ⚠️ 실제 경로에 맞게 수정!!
// 지금은 예시로 src/games/quizmon/data 기준으로 두었음
const MOVES_JSON_PATH = path.resolve(
    __dirname,
    "../src/games/quizmon/data/moves.json",
);
const LEARNSETS_JSON_PATH = path.resolve(
    __dirname,
    "../src/games/quizmon/data/learnsets.json",
);

const SPECIES_JSON_PATH = path.resolve(
    __dirname,
    "../src/games/quizmon/data/species.json", // 실제 위치에 맞게 조정
);

function loadJson(jsonPath) {
    const raw = fs.readFileSync(jsonPath, "utf8");
    return JSON.parse(raw);
}

/** ---------- 2. quizmon_moves 업서트 ---------- */

/**
 * moves.json 형태:
 * [
 *   {
 *     "id": "tackle",
 *     "name": "Tackle",
 *     "nameKo": "몸통박치기",
 *     "element": "normal",
 *     "category": "physical",
 *     "power": 40,
 *     "accuracy": 100,
 *     "pp": 35,
 *     "priority": 0,
 *     "target": "enemy",
 *     "meta": { ... }
 *   },
 *   ...
 * ]
 */
async function seedMoves() {
    const moves = loadJson(MOVES_JSON_PATH);
    console.log(`[seedQuizmon] moves.json 로드: ${moves.length}개`);

    const chunkSize = 500;

    for (let i = 0; i < moves.length; i += chunkSize) {
        const chunk = moves.slice(i, i + chunkSize).map((m) => ({
            id: m.id,
            // DB 쪽에는 한국어 이름을 우선으로 넣고, 없으면 영어 사용
            name: m.nameKo || m.name,
            description: m.description || "",
            element: m.element,
            category: m.category,
            power: m.power,
            accuracy: m.accuracy,
            pp: m.pp,
            priority: m.priority ?? 0,
            target: m.target || "enemy",
            meta: m.meta || {},
        }));

        const { error } = await supabase
            .from("quizmon_moves")
            .upsert(chunk, { onConflict: "id" });

        if (error) {
            console.error("[seedQuizmon] quizmon_moves upsert 에러:", error);
            throw error;
        }

        console.log(
            `[seedQuizmon] quizmon_moves upsert: ${i} ~ ${i + chunk.length - 1}`,
        );
    }

    console.log("[seedQuizmon] quizmon_moves seeding 완료");
}

async function seedAbilitiesFromJson() {
    const abilitiesPath = path.resolve(
        __dirname,
        "../src/games/quizmon/data/abilities.json"  // 실제 경로 확인해서 수정
    );

    let abilities;
    try {
        const raw = fs.readFileSync(abilitiesPath, "utf8");
        abilities = JSON.parse(raw);
    } catch (e) {
        console.error("[seedQuizmon] abilities.json 로드 실패:", e);
        return;
    }

    if (!Array.isArray(abilities) || abilities.length === 0) {
        console.log("[seedQuizmon] abilities.json 비어 있음, 스킵");
        return;
    }

    console.log(`[seedQuizmon] abilities.json 로드: ${abilities.length}개`);

    const rows = abilities.map((ab) => ({
        id: ab.id,
        // ⚡ name: 한글 이름 우선, 없으면 영어/ID
        name: ab.nameKo || ab.name || ab.id,
        // ⚡ description: 한글 설명 우선, 없으면 영어/빈 문자열
        description: ab.descriptionKo || ab.description || "",
        // ⚡ element: JSON에 element가 있으면 그대로, 없으면 meta.element 참고
        element: ab.element || (ab.meta && ab.meta.element) || null,
        meta: ab.meta || {},
    }));

    const { error } = await supabase
        .from("quizmon_abilities")
        .upsert(rows, { onConflict: "id" });

    if (error) {
        console.error("[seedQuizmon] quizmon_abilities upsert 에러:", error);
        throw error;
    }

    console.log("[seedQuizmon] quizmon_abilities seeding 완료");
}

async function seedSpeciesAbilitiesFromJson() {
    const speciesAbilitiesPath = path.resolve(
        __dirname,
        "../src/games/quizmon/data/speciesAbilities.json" // 실제 경로 확인
    );

    let list;
    try {
        const raw = fs.readFileSync(speciesAbilitiesPath, "utf8");
        list = JSON.parse(raw);
    } catch (e) {
        console.error("[seedQuizmon] speciesAbilities.json 로드 실패:", e);
        return;
    }

    if (!Array.isArray(list) || list.length === 0) {
        console.log("[seedQuizmon] speciesAbilities.json 비어 있음, 스킵");
        return;
    }

    console.log(
        `[seedQuizmon] speciesAbilities.json 로드: ${list.length}개 종`
    );

    const rows = [];

    for (const entry of list) {
        const speciesId = entry.speciesId;
        if (!speciesId || !Array.isArray(entry.abilities)) continue;

        for (const ab of entry.abilities) {
            if (!ab.abilityId) continue;
            rows.push({
                species_id: speciesId,
                ability_id: ab.abilityId,
                slot: ab.slot ?? 1,
                is_hidden: ab.isHidden ?? false,
            });
        }
    }

    if (rows.length === 0) {
        console.log("[seedQuizmon] speciesAbilities rows 없음, 스킵");
        return;
    }

    console.log(
        `[seedQuizmon] quizmon_species_abilities 생성 예정 row: ${rows.length}개`
    );

    const { error } = await supabase
        .from("quizmon_species_abilities")
        .upsert(rows, { onConflict: "species_id,ability_id" });

    if (error) {
        console.error(
            "[seedQuizmon] quizmon_species_abilities upsert 에러:",
            error
        );
        throw error;
    }

    console.log("[seedQuizmon] quizmon_species_abilities seeding 완료");
}

async function seedSpeciesFromJson() {
    let list;
    try {
        const raw = fs.readFileSync(SPECIES_JSON_PATH, "utf8");
        list = JSON.parse(raw);
    } catch (e) {
        console.error("[seedQuizmon] species.json 로드 실패 (스킵):", e.message);
        return;
    }

    if (!Array.isArray(list) || list.length === 0) {
        console.log("[seedQuizmon] species.json 비어 있음, 스킵");
        return;
    }

    console.log(`[seedQuizmon] species.json 로드: ${list.length}개`);

    const rows = list.map((sp) => {
        const stats = sp.baseStats || {};
        const evo = sp.evolution || {};

        return {
            id: sp.id,
            name: sp.name,
            element: sp.element,
            rarity: sp.rarity ?? 1,

            base_hp: stats.hp ?? 10,
            base_atk: stats.atk ?? 10,
            base_def: stats.def ?? 10,
            base_spd: stats.spd ?? 10,
            base_spatk: stats.spAtk ?? stats.atk ?? null,
            base_spdef: stats.spDef ?? stats.def ?? null,

            pokedex_no: sp.pokedexNo ?? null,
            sprite_key: sp.spriteKey ?? null,
            description: sp.description ?? null,

            height_dm: sp.heightDm ?? null,
            weight_hg: sp.weightHg ?? null,

            evolves_to_id: evo.evolvesToId ?? null,
            evolution_trigger: evo.trigger ?? null,      // "level" | "item" | "special" | null
            evolution_level: evo.level ?? null,
            evolution_item_id: evo.itemId ?? null,
            evolution_special_key: evo.specialKey ?? null,
        };
    });

    const { error } = await supabase
        .from("quizmon_species")
        .upsert(rows, { onConflict: "id" });

    if (error) {
        console.error("[seedQuizmon] quizmon_species upsert 에러:", error);
        throw error;
    }

    console.log("[seedQuizmon] quizmon_species seeding 완료");
}



/** ---------- 3. quizmon_species_levelup_moves 초기화 & insert ---------- */

/**
 * learnsets.json 형태:
 * [
 *   {
 *     "speciesId": "poke-0001",
 *     "learn": [
 *       { "level": 1, "moveId": "tackle" },
 *       { "level": 3, "moveId": "vine_whip" },
 *       ...
 *     ]
 *   },
 *   ...
 * ]
 */
async function seedLevelupLearnsets() {
    const learnsets = loadJson(LEARNSETS_JSON_PATH);
    console.log(`[seedQuizmon] learnsets.json 로드: ${learnsets.length}개 종`);

    const rows = [];

    for (const ls of learnsets) {
        const speciesId = ls.speciesId;
        if (!speciesId || !Array.isArray(ls.learn)) continue;

        ls.learn.forEach((entry, index) => {
            rows.push({
                species_id: speciesId,
                level: entry.level,
                move_id: entry.moveId,
                sort_order: index,
            });
        });
    }

    console.log(
        `[seedQuizmon] quizmon_species_levelup_moves 생성 예정 row: ${rows.length}개`,
    );

    // ⚠️ 간단하게 전체 삭제 후 다시 채우는 방식 (v1에서는 이게 제일 편함)
    const { error: delError } = await supabase
        .from("quizmon_species_levelup_moves")
        .delete()
        .neq("species_id", "__never__"); // 모든 row 삭제용 꼼수

    if (delError) {
        console.error(
            "[seedQuizmon] quizmon_species_levelup_moves 전체 삭제 에러:",
            delError,
        );
        throw delError;
    }

    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);

        const { error } = await supabase
            .from("quizmon_species_levelup_moves")
            .insert(chunk);

        if (error) {
            console.error(
                "[seedQuizmon] quizmon_species_levelup_moves insert 에러:",
                error,
            );
            throw error;
        }

        console.log(
            `[seedQuizmon] quizmon_species_levelup_moves insert: ${i} ~ ${i + chunk.length - 1}`,
        );
    }

    console.log("[seedQuizmon] quizmon_species_levelup_moves seeding 완료");
}

/** ---------- 4. 메인 실행 ---------- */

async function main() {
    console.log("=== QuizMon JSON → Supabase seeder 시작 ===");

    await seedSpeciesFromJson();          // ✅ 종 마스터 먼저
    await seedMoves();                    // 기술 마스터
    await seedLevelupLearnsets();         // 레벨업 기술 (species + moves FK)
    await seedAbilitiesFromJson();        // 특성 마스터
    await seedSpeciesAbilitiesFromJson(); // 종별 특성 매핑

    console.log("=== QuizMon seeding 완료 ===");
}



main()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
