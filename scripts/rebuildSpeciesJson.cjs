// scripts/rebuildSpeciesJson.cjs
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

// ✅ species.json 위치는 프로젝트 구조에 맞게 조정하세요
// 예시로: /data/species.json 에 있다고 가정
const INPUT_PATH = path.join(__dirname, "..", "scripts", "species.json");
const OUTPUT_PATH = path.join(__dirname, "..", "scripts", "species.built.json");
// DB seed용으로 쓸 snake_case 버전
const OUTPUT_DB_ROWS_PATH = path.join(
    __dirname,
    "..",
    "scripts",
    "species.dbRows.json",
);

// 배틀 총합 → 랭크 매핑 규칙 (원하는대로 조정 가능)
function getBattleRank(total) {
    if (total == null) return null;
    if (total < 400) return "C";
    if (total < 500) return "B";
    if (total < 600) return "A";
    return "S"; // 600 이상
}

// 가챠 weight 자동 설정 규칙 (optional)
function getGachaWeight({ battleTotal, isLegendary, isMythical }) {
    if (isLegendary || isMythical) return 0; // 어차피 is_gacha_enabled = false
    if (battleTotal == null) return 100;

    if (battleTotal < 400) return 120; // 약한 애들 자주
    if (battleTotal < 500) return 100;
    if (battleTotal < 550) return 60;
    if (battleTotal < 600) return 30;
    return 10; // 강한 애들은 낮게
}

// 베이스폼 판별 (간단 버전: 누군가의 evolution.toId 대상이 아닌 애들)
function markBaseForms(speciesList) {
    const evolvedIds = new Set(
        speciesList
            .map((s) => (s.evolution ? s.evolution.toId : null))
            .filter((id) => !!id),
    );

    for (const s of speciesList) {
        s.isBaseForm = !evolvedIds.has(s.id);
    }
}

function main() {
    if (!fs.existsSync(INPUT_PATH)) {
        console.error("❌ species.json not found at", INPUT_PATH);
        process.exit(1);
    }

    const raw = fs.readFileSync(INPUT_PATH, "utf8");
    /** @type {any[]} */
    const species = JSON.parse(raw);

    // 1) 먼저 베이스폼 플래그 계산
    markBaseForms(species);

    const rebuilt = [];
    const dbRows = [];

    for (const s of species) {
        const {
            id,
            pokedexNo,
            name,
            nameEn,
            element,
            element2,
            rarity,
            baseStats,
            heightDm,
            weightHg,
            spriteKey,
            description,
            isLegendary,
            isMythical,
            popularityRank,
            gachaWeight,
            generation,
            isPlayable,
            evolution,
            battle_stat_total,
            battle_stat_rank,
            isBaseForm,
            isGachaEnabled,
        } = s;

        const hp = baseStats?.hp ?? 0;
        const atk = baseStats?.atk ?? 0;
        const def = baseStats?.def ?? 0;
        const spAtk = baseStats?.spAtk ?? 0;
        const spDef = baseStats?.spDef ?? 0;
        const spd = baseStats?.spd ?? 0;

        const total = hp + atk + def + spAtk + spDef + spd;
        const rank = getBattleRank(total);

        const finalGachaWeight =
            typeof gachaWeight === "number"
                ? gachaWeight
                : getGachaWeight({ battleTotal: total, isLegendary, isMythical });

        const baseFormFlag = typeof isBaseForm === "boolean" ? isBaseForm : false;
        const gachaEnabledFlag =
            typeof isGachaEnabled === "boolean"
                ? isGachaEnabled
                : !(isLegendary || isMythical || total >= 600);

        // 2) JSON용 객체 재구성 (camelCase)
        const rebuiltEntry = {
            id,
            pokedexNo,
            name,
            nameEn,
            element,
            element2: element2 ?? null,
            rarity,
            baseStats: {
                hp,
                atk,
                def,
                spAtk,
                spDef,
                spd,
            },
            heightDm,
            weightHg,
            spriteKey,
            description,
            isLegendary: !!isLegendary,
            isMythical: !!isMythical,
            popularityRank,
            gachaWeight: finalGachaWeight,
            generation,
            isPlayable: !!isPlayable,
            isBaseForm: baseFormFlag,
            isGachaEnabled: gachaEnabledFlag,
            evolution: evolution ?? {
                toId: null,
                trigger: null,
                minLevel: null,
                itemId: null,
                specialKey: null,
            },
            battle_stat_total: total,
            battle_stat_rank: rank,
        };

        rebuilt.push(rebuiltEntry);

        // 3) DB seed용 snake_case 버전도 같이 만들어두기
        dbRows.push({
            id,
            name,
            element,
            rarity,
            base_hp: hp,
            base_atk: atk,
            base_def: def,
            base_spd: spd,
            pokedex_no: pokedexNo,
            sprite_key: spriteKey,
            description,
            evolves_to_id: evolution?.toId ?? null,
            evolution_trigger: evolution?.trigger ?? null,
            evolution_level: evolution?.minLevel ?? null,
            evolution_item_id: evolution?.itemId ?? null,
            evolution_special_key: evolution?.specialKey ?? null,
            base_spatk: spAtk,
            base_spdef: spDef,
            height_dm: heightDm,
            weight_hg: weightHg,
            popularity_rank: popularityRank,
            is_legendary: !!isLegendary,
            is_mythical: !!isMythical,
            gacha_weight: finalGachaWeight,
            generation,
            is_playable: !!isPlayable,
            element2: element2 ?? null,
            first_encounter_level: null, // 필요하면 나중에 로직 추가
            popularity_tier: null, // 인기 구간 나누고 싶으면 여기서 계산
            battle_stat_total: total,
            battle_stat_rank: rank,
            is_base_form: baseFormFlag,
            is_gacha_enabled: gachaEnabledFlag,
        });
    }

    // 4) 파일로 저장
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(rebuilt, null, 2), "utf8");
    fs.writeFileSync(
        OUTPUT_DB_ROWS_PATH,
        JSON.stringify(dbRows, null, 2),
        "utf8",
    );

    console.log("✅ Rebuilt species.json →", OUTPUT_PATH);
    console.log("✅ DB rows json →", OUTPUT_DB_ROWS_PATH);
    console.log("   example row:", dbRows[0]);
}

main();
