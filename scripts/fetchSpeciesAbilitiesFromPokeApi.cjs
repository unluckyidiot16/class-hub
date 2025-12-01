// fetchSpeciesAbilitiesFromPokeApi.cjs
// const fetch = (...args) => import('node-fetch').then(m => m.default(...args));

const fs = require("fs/promises");
const path = require("path");

const BASE_URL = "https://pokeapi.co/api/v2";
const GEN1_MAX = 151; // 필요시 1025 등으로 확장

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

async function fetchSpeciesAbilities(no) {
    const pokemon = await getJson(`${BASE_URL}/pokemon/${no}`);
    const speciesId = `poke-${pad4(no)}`;

    const abilities = (pokemon.abilities || []).map((a) => ({
        abilityId: a.ability.name,          // "overgrow"
        slot: a.slot,                       // 1, 2, ...
        isHidden: Boolean(a.is_hidden),     // true/false
    }));

    return { speciesId, abilities };
}

async function main() {
    const all = [];

    for (let no = 1; no <= GEN1_MAX; no++) {
        console.log(`▶ pokemon #${no}`);
        const entry = await fetchSpeciesAbilities(no);
        all.push(entry);
    }

    // speciesId 기준 정렬
    all.sort((a, b) => a.speciesId.localeCompare(b.speciesId));

    const outPath = path.join(__dirname, "speciesAbilities.json");
    await fs.writeFile(outPath, JSON.stringify(all, null, 2), "utf8");
    console.log(`✅ saved abilities for ${all.length} species to ${outPath}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
