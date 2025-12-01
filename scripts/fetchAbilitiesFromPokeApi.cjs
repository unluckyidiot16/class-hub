// fetchAbilitiesFromPokeApi.cjs
// Node 18 미만이면 아래 주석 풀어서 node-fetch 사용:
// const fetch = (...args) => import('node-fetch').then(m => m.default(...args));

const fs = require("fs/promises");
const path = require("path");

const BASE_URL = "https://pokeapi.co/api/v2";

async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return res.json();
}

function extractName(names, lang) {
    const entry = names.find((n) => n.language.name === lang);
    return entry ? entry.name : null;
}

function extractEffect(effectEntries, lang) {
    const entry = effectEntries.find((e) => e.language.name === lang);
    if (!entry) return null;
    // short_effect가 한 줄 설명이라 쓰기 좋음
    return entry.short_effect || entry.effect;
}

// 필요 시 몇 개만 element를 유추하는 예시
function inferElement(abilityName) {
    if (abilityName === "overgrow") return "grass";
    if (abilityName === "blaze") return "fire";
    if (abilityName === "torrent") return "water";
    if (abilityName === "swarm") return "bug";
    return null; // 대부분은 null로 두고, 나중에 hand-tuning
}

function buildAbility(data) {
    const nameEn = extractName(data.names, "en") || data.name;
    const nameKo =
        extractName(data.names, "ko") ||
        extractName(data.names, "ja-Hrkt") ||
        nameEn;

    const descEn = extractEffect(data.effect_entries, "en");
    const descKo =
        extractEffect(data.effect_entries, "ko") ||
        descEn;

    return {
        id: data.name,               // "overgrow"
        name: nameEn,                // "Overgrow"
        nameKo,                      // "풀의 힘"(없으면 nameEn)
        description: descEn || "",
        descriptionKo: descKo || "",
        element: inferElement(data.name), // 대부분 null, 필요한 것만 스크립트/수동으로 채우자
        meta: {
            // overgrow / blaze / torrent / swarm 같은 건
            // seed 단계에서 별도 스크립트나 수동 편집으로 meta 채워주는 걸 추천
        },
    };
}

async function main() {
    console.log("▶ Fetch abilities list...");
    const list = await getJson(`${BASE_URL}/ability?limit=10000&offset=0`);
    const results = list.results || [];

    console.log(`  Found ${results.length} abilities.`);

    const abilities = [];

    for (const { name, url } of results) {
        console.log(`  - ability: ${name}`);
        const data = await getJson(url || `${BASE_URL}/ability/${name}`);
        abilities.push(buildAbility(data));
    }

    // id 기준 정렬
    abilities.sort((a, b) => a.id.localeCompare(b.id));

    const outPath = path.join(__dirname, "abilities.json");
    await fs.writeFile(outPath, JSON.stringify(abilities, null, 2), "utf8");
    console.log(`✅ saved ${abilities.length} abilities to ${outPath}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
