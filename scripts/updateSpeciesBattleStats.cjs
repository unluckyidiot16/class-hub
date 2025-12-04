// scripts/updateSpeciesBattleStats.cjs
// 1) species.json 읽어서 battle_stat_total / battle_stat_rank 계산
// 2) species.json 덮어쓰기
// 3) (선택) Supabase quizmon_species 테이블에 upsert

/* eslint-disable no-console */

const fs = require("fs/promises");
const path = require("path");
require("dotenv").config({ path: ".env.seed" }); // 필요에 따라 경로 수정

const { createClient } = require("@supabase/supabase-js");

// ✅ seedQuizmonFromJson.cjs 와 동일 경로로 맞춤
const SPECIES_JSON_PATH = path.resolve(
    __dirname,
    "../src/games/quizmon/data/species.json",
);

// ----------------------
// 1. 랭크 계산 함수들
// ----------------------

function calcBaseStatTotal(sp) {
    // species.json 이 두 가지 케이스를 모두 지원:
    // 1) base_hp / base_atk / base_def / base_spatk / base_spdef / base_spd
    // 2) baseStats: { hp, atk, def, spAtk, spDef, spd }
    const stats = sp.baseStats || {};

    const baseHp =
        typeof sp.base_hp === "number" ? sp.base_hp : stats.hp ?? 0;
    const baseAtk =
        typeof sp.base_atk === "number" ? sp.base_atk : stats.atk ?? 0;
    const baseDef =
        typeof sp.base_def === "number" ? sp.base_def : stats.def ?? 0;

    const baseSpAtk =
        typeof sp.base_spatk === "number"
            ? sp.base_spatk
            : stats.spAtk ?? baseAtk;
    const baseSpDef =
        typeof sp.base_spdef === "number"
            ? sp.base_spdef
            : stats.spDef ?? baseDef;

    const baseSpd =
        typeof sp.base_spd === "number" ? sp.base_spd : stats.spd ?? 0;

    const parts = [baseHp, baseAtk, baseDef, baseSpAtk, baseSpDef, baseSpd];

    return parts.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
}

// 간단한 예시 구간 (나중에 이 숫자들만 조정해서 밸런스 튜닝 가능)
function getBaseStatRank(total) {
    if (total < 400) return "C";
    if (total < 500) return "B";
    if (total < 600) return "A";
    return "S";
}

// ----------------------
// 2. JSON 로드 + 업데이트
// ----------------------

async function loadSpeciesJson() {
    const raw = await fs.readFile(SPECIES_JSON_PATH, "utf8");
    const data = JSON.parse(raw);

    // 배열 또는 { species: [] } 형태 모두 지원
    let list;
    if (Array.isArray(data)) {
        list = data;
    } else if (Array.isArray(data.species)) {
        list = data.species;
    } else {
        throw new Error("species.json 형식을 알 수 없습니다.");
    }

    return { data, list };
}

function applyBattleStats(list) {
    for (const sp of list) {
        const total = calcBaseStatTotal(sp);
        const rank = getBaseStatRank(total);

        sp.battle_stat_total = total;
        sp.battle_stat_rank = rank;
    }
}

async function saveSpeciesJson(original, list) {
    let out;
    if (Array.isArray(original)) {
        out = JSON.stringify(list, null, 2);
    } else {
        out = JSON.stringify({ ...original, species: list }, null, 2);
    }

    await fs.writeFile(SPECIES_JSON_PATH, out, "utf8");
    console.log(
        `✅ species.json 업데이트 완료: ${list.length}종 (battle_stat_total / battle_stat_rank)`,
    );
}

// ----------------------
// 3. Supabase upsert
// ----------------------

function createSupabaseClient() {
    const url = process.env.SUPABASE_URL;
    const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.warn(
            "⚠️ SUPABASE_URL 또는 SERVICE_ROLE_KEY/ANON_KEY가 없습니다. upsert는 건너뜁니다.",
        );
        return null;
    }

    return createClient(url, key, {
        auth: { persistSession: false },
    });
}

async function upsertBattleStatsToSupabase(list) {
    const supabase = createSupabaseClient();
    if (!supabase) return;

    // id, battle_stat_total, battle_stat_rank만 보내면 됨
    const rows = list
        .filter((sp) => sp.id)
        .map((sp) => ({
            id: sp.id,
            battle_stat_total: sp.battle_stat_total ?? null,
            battle_stat_rank: sp.battle_stat_rank ?? null,
        }));

    // 너무 많으면 chunk로 쪼개기
    const CHUNK_SIZE = 200;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase
            .from("quizmon_species")
            .upsert(chunk, { onConflict: "id" });

        if (error) {
            console.error("❌ Supabase upsert 에러:", error);
            throw error;
        } else {
            console.log(
                `✅ Supabase upsert 완료: ${i + 1} ~ ${i + chunk.length} / ${
                    rows.length
                }`,
            );
        }
    }
}

// ----------------------
// 4. 메인 실행
// ----------------------

async function main() {
    try {
        const { data, list } = await loadSpeciesJson();

        applyBattleStats(list);
        await saveSpeciesJson(data, list);

        await upsertBattleStatsToSupabase(list);

        console.log("🎉 updateSpeciesBattleStats 완료!");
    } catch (err) {
        console.error("❌ updateSpeciesBattleStats 실행 중 에러:", err);
        process.exit(1);
    }
}

main();
