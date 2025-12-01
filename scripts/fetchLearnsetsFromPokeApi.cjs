// fetchLearnsetsFromPokeApi.cjs
// const fetch = (...args) => import('node-fetch').then(m => m.default(...args));

const fs = require("fs/promises");
const path = require("path");

const BASE_URL = "https://pokeapi.co/api/v2";
const GEN1_MAX = 151;
const VERSION_GROUP = "red-blue"; // 필요시 "yellow" 등으로 바꿔도 됨

async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return res.json();
}

function pad4(n) {
    return String(n).padStart(4, "0");
}

function dedupeByMoveId(learn) {
    const seen = new Set();
    const result = [];
    for (const entry of learn) {
        if (seen.has(entry.moveId)) continue;
        seen.add(entry.moveId);
        result.push(entry);
    }
    return result;
}

async function fetchLearnsetFor(no) {
    const pokemon = await getJson(`${BASE_URL}/pokemon/${no}`);
    const speciesId = `poke-${pad4(no)}`;

    const learn = [];

    for (const moveEntry of pokemon.moves) {
        const moveId = moveEntry.move.name; // ex) "tackle"

        for (const vg of moveEntry.version_group_details) {
            const isLevelUp = vg.move_learn_method.name === "level-up";
            const isTargetVersion = vg.version_group.name === VERSION_GROUP;
            const level = vg.level_learned_at;

            if (isLevelUp && isTargetVersion && level > 0) {
                learn.push({ level, moveId });
                break; // 같은 move에 대해 여러 버전그룹 중 하나만 사용
            }
        }
    }

    // 레벨 → moveId 순으로 정렬
    learn.sort((a, b) => {
        if (a.level !== b.level) return a.level - b.level;
        return a.moveId.localeCompare(b.moveId);
    });

    const dedup = dedupeByMoveId(learn);

    return { speciesId, learn: dedup };
}

async function main() {
    const all = [];

    for (let no = 1; no <= GEN1_MAX; no++) {
        console.log(`▶ pokemon #${no}`);
        const entry = await fetchLearnsetFor(no);
        all.push(entry);
    }

    const outPath = path.join(__dirname, "learnsets.json");
    await fs.writeFile(outPath, JSON.stringify(all, null, 2), "utf8");
    console.log(`✅ saved learnsets for ${all.length} species to ${outPath}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
