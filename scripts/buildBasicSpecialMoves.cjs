// scripts/buildBasicSpecialMoves.cjs
// 각 종별로 "기본 공격 1개 + 스페셜 스킬 1개"를 자동 선정해서
// basicSpecialMoves.json 을 만드는 스크립트입니다.
//
// 사용법:
//   node scripts/buildBasicSpecialMoves.cjs

const fs = require("fs/promises");
const path = require("path");

const SPECIES_PATH = path.join(__dirname, "species.json");
const MOVES_PATH = path.join(__dirname, "moves.json");
const LEARNSETS_PATH = path.join(__dirname, "learnsets.json");
const OVERRIDE_PATH = path.join(__dirname, "basicSpecialMoves_overrides.json");
const OUT_PATH = path.join(__dirname, "basicSpecialMoves.json");

/**
 * JSON 파일 읽기 헬퍼
 */
async function readJson(filePath, defaultValue = null) {
    try {
        const txt = await fs.readFile(filePath, "utf8");
        return JSON.parse(txt);
    } catch (err) {
        if (defaultValue !== null) {
            console.warn(
                `[buildBasicSpecialMoves] ${path.basename(
                    filePath,
                )} 읽기 실패, 기본값 사용:`,
                err.message,
            );
            return defaultValue;
        }
        throw err;
    }
}

/**
 * learnsets.json 형식:
 * [
 *   {
 *     "speciesId": "poke-0001",
 *     "learn": [{ "level": 1, "moveId": "growl" }, ...]
 *   },
 *   ...
 * ]
 *
 * → speciesId 기준으로 moveId 리스트를 뽑는 헬퍼
 */
function getMoveIdsBySpecies(learnsetRows) {
    /** @type {Record<string, string[]>} */
    const map = {};
    for (const row of learnsetRows) {
        if (!row || !row.speciesId || !Array.isArray(row.learn)) continue;
        const sid = row.speciesId;
        if (!map[sid]) map[sid] = [];
        for (const entry of row.learn) {
            if (!entry || !entry.moveId) continue;
            map[sid].push(entry.moveId);
        }
    }
    return map;
}

/**
 * 기본 공격 선택 로직
 *
 * - power > 0
 * - category != "status"
 * - element === speciesElement 우선(STAB)
 * - power <= 60 인 기술 우선 (빠른 공격 느낌)
 * - 그 중에서 가장 약한 편 기술
 *
 * moves: moves.json 의 move 객체 배열
 * element: species.element (주 타입)
 */
function pickBasicMove(moves, element) {
    const damaging = moves.filter(
        (m) =>
            m &&
            typeof m === "object" &&
            (m.power ?? 0) > 0 &&
            m.category !== "status",
    );

    if (damaging.length === 0) return null;

    const stab = damaging.filter((m) => m.element === element);

    const filtered =
        stab.filter((m) => (m.power ?? 0) <= 60).length > 0
            ? stab.filter((m) => (m.power ?? 0) <= 60)
            : stab.length > 0
                ? stab
                : damaging;

    if (filtered.length === 0) return null;

    const sorted = [...filtered].sort(
        (a, b) => (a.power ?? 0) - (b.power ?? 0),
    );

    return sorted[0] ?? null;
}

/**
 * 스페셜 스킬 선택 로직
 *
 * - power > 0
 * - category != "status"
 * - basicId와는 다른 기술
 * - element === speciesElement 우선(STAB)
 * - power >= 60 인 기술 우선 (한 방 기술 느낌)
 * - 그 중에서 가장 강한 기술
 */
function pickSpecialMove(moves, element, basicId) {
    const damaging = moves.filter(
        (m) =>
            m &&
            typeof m === "object" &&
            (m.power ?? 0) > 0 &&
            m.category !== "status" &&
            m.id !== basicId,
    );

    if (damaging.length === 0) return null;

    const stab = damaging.filter((m) => m.element === element);

    const filtered =
        stab.filter((m) => (m.power ?? 0) >= 60).length > 0
            ? stab.filter((m) => (m.power ?? 0) >= 60)
            : stab.length > 0
                ? stab
                : damaging;

    if (filtered.length === 0) return null;

    const sorted = [...filtered].sort(
        (a, b) => (b.power ?? 0) - (a.power ?? 0),
    );

    return sorted[0] ?? null;
}

async function main() {
    console.log("[buildBasicSpecialMoves] 시작");

    const speciesList = await readJson(SPECIES_PATH);
    const moveList = await readJson(MOVES_PATH);
    const learnsetRows = await readJson(LEARNSETS_PATH, []);

    if (!Array.isArray(speciesList)) {
        throw new Error("species.json 형식이 배열이 아닙니다.");
    }
    if (!Array.isArray(moveList)) {
        throw new Error("moves.json 형식이 배열이 아닙니다.");
    }
    if (!Array.isArray(learnsetRows)) {
        throw new Error("learnsets.json 형식이 배열이 아닙니다.");
    }

    // Move DB 맵 구성: id → move
    /** @type {Record<string, any>} */
    const MOVE_DB = {};
    for (const m of moveList) {
        if (!m || !m.id) continue;
        MOVE_DB[m.id] = m;
    }

    const moveIdsBySpecies = getMoveIdsBySpecies(learnsetRows);

    /** @type {Record<string, { basicMoveId: string; specialMoveId: string }>} */
    const result = {};

    let speciesWithBoth = 0;
    let speciesWithBasicOnly = 0;
    let skipped = 0;

    for (const sp of speciesList) {
        const speciesId = sp.id;
        // 주 타입: element, 없으면 element2라도 시도
        const element = sp.element || sp.element2;

        if (!speciesId || !element) {
            console.warn(
                `[buildBasicSpecialMoves] 종 정보 부족으로 스킵: id=${speciesId}, element=${element}`,
            );
            skipped++;
            continue;
        }

        const moveIds = moveIdsBySpecies[speciesId] ?? [];
        const allMoves = moveIds
            .map((id) => MOVE_DB[id])
            .filter(Boolean);

        if (allMoves.length === 0) {
            console.warn(
                `[buildBasicSpecialMoves] 이 종은 learnset이 없어 스킵: speciesId=${speciesId} (${sp.name})`,
            );
            skipped++;
            continue;
        }

        const basic = pickBasicMove(allMoves, element);
        const special = pickSpecialMove(allMoves, element, basic && basic.id);

        if (!basic && !special) {
            console.warn(
                `[buildBasicSpecialMoves] 공격 기술을 찾지 못해 스킵: speciesId=${speciesId} (${sp.name})`,
            );
            skipped++;
            continue;
        }

        // fallback: 둘 중 하나만 있는 경우
        const basicId = basic?.id || special?.id;
        const specialId = special?.id || basic?.id;

        if (!basicId || !specialId) {
            skipped++;
            continue;
        }

        result[speciesId] = {
            basicMoveId: basicId,
            specialMoveId: specialId,
        };

        if (basic && special) speciesWithBoth++;
        else speciesWithBasicOnly++;
    }

    // 수동 오버라이드 적용 (있으면)
    // 수동 오버라이드 적용 (파일 없으면 그냥 건너뜀)
    const overrides = await readJson(OVERRIDE_PATH, {});
    if (overrides && typeof overrides === "object") {
        const keys = Object.keys(overrides);
        if (keys.length > 0) {
            console.log(
                "[buildBasicSpecialMoves] overrides 적용:",
                keys.length,
                "종",
            );
            for (const [sid, data] of Object.entries(overrides)) {
                if (!data || typeof data !== "object") continue;
                if (!data.basicMoveId && !data.specialMoveId) continue;
                
                const current = result[sid] || {};
                result[sid] = {
                    basicMoveId: data.basicMoveId || current.basicMoveId,
                    specialMoveId: data.specialMoveId || current.specialMoveId,
                };
            }
        }
    }

    await fs.writeFile(OUT_PATH, JSON.stringify(result, null, 2), "utf8");

    console.log("[buildBasicSpecialMoves] 완료");
    console.log("  총 종 수:", speciesList.length);
    console.log("  기본+스페셜 모두 지정된 종:", speciesWithBoth);
    console.log("  기본/스페셜 중 하나만 있는 종:", speciesWithBasicOnly);
    console.log("  스킵된 종:", skipped);
    console.log("  출력 파일:", OUT_PATH);
}

main().catch((err) => {
    console.error("[buildBasicSpecialMoves] 실패:", err);
    process.exit(1);
});
