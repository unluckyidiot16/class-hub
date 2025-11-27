// scripts/generatePemmonSpecies.mjs
// Node 18+ 기준 (global fetch 사용)
//   실행: node scripts/generatePemmonSpecies.mjs

import fs from "node:fs/promises";

const POKE_API_BASE = "https://pokeapi.co/api/v2";

// 이 배열만 바꾸면 포함할 포켓몬을 조정 가능
// 1,4,7 (이상해씨/파이리/꼬부기) + 예시로 몇 마리 추가
const POKEMON_IDS = [
    1, 4, 7,      // 1세대 스타팅
    25,           // 피카츄
    133,          // 이브이
    810, 813, 816 // 8세대 스타팅 (사불, 염버니, 울머기) 예시
    // TODO: 8~9세대에서 1학년이 좋아하는 애들 id 추가
];

// PokeAPI에서 한 마리 정보 가져와 Species 형태로 변환
async function fetchSpecies(id) {
    const pokemonUrl = `${POKE_API_BASE}/pokemon/${id}`;
    const speciesUrl = `${POKE_API_BASE}/pokemon-species/${id}`;

    const [pokemonRes, speciesRes] = await Promise.all([
        fetch(pokemonUrl),
        fetch(speciesUrl),
    ]);

    if (!pokemonRes.ok) {
        throw new Error(`pokemon ${id} fetch failed: ${pokemonRes.status}`);
    }
    if (!speciesRes.ok) {
        throw new Error(`species ${id} fetch failed: ${speciesRes.status}`);
    }

    const pokemon = await pokemonRes.json();
    const species = await speciesRes.json();

    // stats에서 hp/attack/defense 추출
    const getStat = (name) =>
        pokemon.stats.find((s) => s.stat?.name === name)?.base_stat ?? 1;

    const hp = getStat("hp");
    const atk = getStat("attack");
    const def = getStat("defense");

    // 한글 이름 찾기 (없으면 species.name 또는 pokemon.name)
    const koEntry = species.names?.find(
        (n) => n.language?.name === "ko",
    );
    const name = koEntry?.name ?? species.name ?? pokemon.name;

    return {
        id: pokemon.id,
        name,
        maxHp: hp,
        atk,
        def,
    };
}

async function main() {
    const results = [];

    for (const id of POKEMON_IDS) {
        console.log(`Fetching #${id} ...`);
        try {
            const s = await fetchSpecies(id);
            results.push(s);
        } catch (err) {
            console.error(`  -> failed:`, err);
        }
    }

    const outPath = "src/games/pemmon/pemmonSpecies.json";
    await fs.mkdir("src/games/pemmon", { recursive: true });
    await fs.writeFile(outPath, JSON.stringify(results, null, 2), "utf8");

    console.log(
        `Done. Wrote ${results.length} species to ${outPath}`,
    );
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
