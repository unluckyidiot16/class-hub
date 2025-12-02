// fetchSpeciesFromPokeApi.cjs
// Node 18 이상이면 fetch 기본 제공
// Node 18 미만이면 아래 주석을 해제해서 node-fetch 사용:
// const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const fs = require("fs/promises");
const path = require("path");

const BASE = "https://pokeapi.co/api/v2";
const OUT_PATH = path.join(__dirname, "species.json");

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

function getPrimaryType(types) {
    return (types.find((t) => t.slot === 1) ?? types[0]).type.name;
}

function getSecondaryType(types) {
    const second = types.find((t) => t.slot === 2);
    return second ? second.type.name : null;
}

function getStat(stats, name) {
    return stats.find((s) => s.stat.name === name)?.base_stat ?? 0;
}

function pickLocalizedName(names, langCode) {
    const ko = names.find((n) => n.language.name === langCode);
    if (ko) return ko.name;
    const en = names.find((n) => n.language.name === "en");
    return en ? en.name : names[0]?.name ?? "";
}

function pickFlavorText(entries, langCode) {
    const ko = entries.find((e) => e.language.name === langCode);
    const en = entries.find((e) => e.language.name === "en");
    const raw = (ko ?? en ?? entries[0])?.flavor_text ?? "";
    return raw.replace(/[\n\f\r]/g, " ").trim();
}

function mapGenerationToNumber(genName) {
    const map = {
        "generation-i": 1,
        "generation-ii": 2,
        "generation-iii": 3,
        "generation-iv": 4,
        "generation-v": 5,
        "generation-vi": 6,
        "generation-vii": 7,
        "generation-viii": 8,
        "generation-ix": 9,
    };
    return map[genName] ?? null;
}

// evolution-chain → { [speciesId]: { toId, trigger, minLevel, itemId, specialKey } }
function buildEvolutionMap(chain) {
    const map = {};

    function walk(node) {
        const speciesUrl = node.species.url; // .../pokemon-species/1/
        const idStr = speciesUrl.split("/").filter(Boolean).pop();
        const dexNo = parseInt(idStr, 10);
        const currentId = `poke-${pad4(dexNo)}`;

        for (const evo of node.evolves_to || []) {
            const childUrl = evo.species.url;
            const childIdStr = childUrl.split("/").filter(Boolean).pop();
            const childDexNo = parseInt(childIdStr, 10);
            const childId = `poke-${pad4(childDexNo)}`;

            const trigger = evo.evolution_details?.[0];
            let evoTrigger = "special";
            let minLevel = null;
            let itemId = null;
            let specialKey = null;

            if (trigger) {
                if (trigger.trigger?.name === "level-up") {
                    evoTrigger = "level";
                    minLevel = trigger.min_level ?? null;
                } else if (trigger.trigger?.name === "use-item") {
                    evoTrigger = "item";
                    itemId = `evo-${trigger.item.name}`; // evo-thunder-stone 등
                } else {
                    evoTrigger = "special";
                    specialKey = trigger.trigger?.name ?? null;
                }
            }

            map[currentId] = {
                toId: childId,
                trigger: evoTrigger,
                minLevel,
                itemId,
                specialKey,
            };

            walk(evo);
        }
    }

    walk(chain);
    return map;
}

async function fetchAllSpecies() {
    console.log("▶ PokeAPI: pokemon-species 목록 가져오는 중...");
    const speciesList = await getJson(`${BASE}/pokemon-species?limit=10000&offset=0`);
    const results = speciesList.results || [];

    console.log(`  - species count: ${results.length}`);

    const allEntries = [];
    const evoChainUrls = new Set();

    // 1차 패스: species 정보/포켓몬 정보 모으기
    for (const { url } of results) {
        const idStr = url.split("/").filter(Boolean).pop();
        const dexNo = parseInt(idStr, 10);

        const [pokemon, species] = await Promise.all([
            getJson(`${BASE}/pokemon/${dexNo}`),
            getJson(`${BASE}/pokemon-species/${dexNo}`),
        ]);

        if (species.evolution_chain?.url) {
            evoChainUrls.add(species.evolution_chain.url);
        }

        allEntries.push({ dexNo, pokemon, species });
    }

    // 2차: 진화체인별 map 구성
    const evoMap = {};
    for (const url of evoChainUrls) {
        const chainJson = await getJson(url);
        const localMap = buildEvolutionMap(chainJson.chain);
        Object.assign(evoMap, localMap);
    }

    // 3차: 최종 species.json 엔트리 생성
    const list = allEntries.map(({ dexNo, pokemon, species }) => {
        const id = `poke-${pad4(dexNo)}`;
        const baseStats = {
            hp: getStat(pokemon.stats, "hp"),
            atk: getStat(pokemon.stats, "attack"),
            def: getStat(pokemon.stats, "defense"),
            spAtk: getStat(pokemon.stats, "special-attack"),
            spDef: getStat(pokemon.stats, "special-defense"),
            spd: getStat(pokemon.stats, "speed"),
        };

        const evolution = evoMap[id] ?? null;

        const generation = mapGenerationToNumber(species.generation?.name);
        const isLegendary = !!species.is_legendary;
        const isMythical = !!species.is_mythical;

        return {
            id,
            pokedexNo: dexNo,
            name: pickLocalizedName(species.names, "ko"),
            nameEn: pickLocalizedName(species.names, "en"),
            element: getPrimaryType(pokemon.types),
            element2: getSecondaryType(pokemon.types),
            rarity: 1, // 기본값, 나중에 테이블로 조정
            baseStats,
            heightDm: pokemon.height,
            weightHg: pokemon.weight,
            spriteKey: pad4(dexNo),
            description: pickFlavorText(species.flavor_text_entries, "ko"),
            isLegendary,
            isMythical,
            popularityRank: null, // 나중에 투표/리스트로 채우기
            gachaWeight: 100,     // 기본값, 나중에 조정

            // 🔹 새 필드
            generation,           // 1,2,3...
            isPlayable: generation === 1, // MVP: 1세대만 true

            evolution,
        };
    });

    // pokedexNo 기준 정렬
    list.sort((a, b) => a.pokedexNo - b.pokedexNo);
    return list;
}

(async () => {
    const list = await fetchAllSpecies();
    await fs.writeFile(OUT_PATH, JSON.stringify(list, null, 2), "utf8");
    console.log(`✅ species.json 생성 완료: ${list.length}개 (${OUT_PATH})`);
})();
