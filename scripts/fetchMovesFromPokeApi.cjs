// fetchMovesFromPokeApi.cjs
// Node 18 이상: 바로 fetch 사용 가능
// Node 18 미만: 위에 아래 두 줄 추가해서 사용
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
    if (!Array.isArray(effectEntries)) return null;
    const entry = effectEntries.find((e) => e.language.name === lang);
    if (!entry) return null;
    return entry.short_effect || entry.effect || null;
}

function mapTarget(targetName) {
    if (!targetName) return "enemy";

    if (targetName.includes("user")) return "self";
    if (targetName.includes("ally")) return "ally";

    // 대부분의 공격 기술은 상대 단일/전체 대상이라 enemy로 통일
    return "enemy";
}

// 타입 이름은 그대로 둔다. (ElementType 확장 이후에 필터/매핑)
function mapElement(typeName) {
    return typeName; // "normal", "fire", "water", ...
}

function buildMeta(data) {
    const meta = {};

    // 급소율 증가
    if (data.meta && typeof data.meta.crit_rate === "number" && data.meta.crit_rate > 0) {
        meta.highCrit = true;
    }

    // 능력 단계 변화, 상태이상 등도 필요하면 여기서 더 파싱 가능
    // (예시는 가볍게만 둔다)

    return meta;
}

function buildMove(data) {
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
        id: data.name, // "tackle"
        name: nameEn,  // "Tackle"
        nameKo,        // "몸통박치기" (없으면 nameEn)
        element: mapElement(data.type.name),
        category: data.damage_class.name, // "physical" | "special" | "status"
        power: data.power,                // number | null
        accuracy: data.accuracy,          // number | null
        pp: data.pp,
        priority: data.priority,
        target: mapTarget(data.target && data.target.name),
        description: descEn || "",
        descriptionKo: descKo || "",
        meta: buildMeta(data),
    };
}

async function main() {
    console.log("▶ Fetch generation 1 metadata...");
    const gen1 = await getJson(`${BASE_URL}/generation/1`);

    // 1세대에서 등장한 기술들
    const moveNames = gen1.moves.map((m) => m.name); // ["tackle", "vine-whip", ...]

    const moves = [];

    for (const name of moveNames) {
        console.log(`  - move: ${name}`);
        const data = await getJson(`${BASE_URL}/move/${name}`);
        moves.push(buildMove(data));
    }

    // id 기준 정렬
    moves.sort((a, b) => a.id.localeCompare(b.id));

    const outPath = path.join(__dirname, "moves.json");
    await fs.writeFile(outPath, JSON.stringify(moves, null, 2), "utf8");
    console.log(`✅ saved ${moves.length} moves to ${outPath}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
