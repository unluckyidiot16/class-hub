// src/games/quizmon/moveData.ts
import type { Move } from "./types";

// ====== 1) 기술 DB ======
export const MOVE_DB: Record<string, Move> = {
    tackle: {
        id: "tackle",
        name: "몸통박치기",
        power: 40,
        baseAcc: 100,
        element: "normal",
    },
    vine_whip: {
        id: "vine_whip",
        name: "덩굴채찍",
        power: 45,
        baseAcc: 100,
        element: "grass",
    },
    razor_leaf: {
        id: "razor_leaf",
        name: "잎날가르기",
        power: 55,
        baseAcc: 95,
        element: "grass",
    },
    seed_bomb: {
        id: "seed_bomb",
        name: "씨폭탄",
        power: 80,
        baseAcc: 100,
        element: "grass",
    },
    // ... 여기에 추가 스킬들 계속
};

// ====== 2) 레벨업 데이터 타입 ======
type LearnsetEntry = {
    level: number;
    moveId: keyof typeof MOVE_DB;
};

// 이상해씨: DB 기준으로는 species_id === "poke-0001"
const BULBASAUR_LEARNSET: LearnsetEntry[] = [
    { level: 1, moveId: "tackle" },
    { level: 3, moveId: "vine_whip" },
    { level: 7, moveId: "razor_leaf" },
    { level: 12, moveId: "seed_bomb" },
];

// 앞으로 여기다가 종별 레벨업 테이블을 계속 추가
const SPECIES_LEARNSETS: Record<string, LearnsetEntry[]> = {
    // key는 항상 DB 기준 id: "poke-0001"
    "poke-0001": BULBASAUR_LEARNSET,
    // "poke-0004": CHARMANDER_LEARNSET,
    // "poke-0007": SQUIRTLE_LEARNSET,
};

// "0001", "poke-0001", "1" → "poke-0001" 통일
function normalizeSpeciesIdForLearnset(raw: string): string {
    const s = String(raw);

    if (s.startsWith("poke-")) {
        // "poke-0001" 같은 경우: 숫자만 뽑아서 재정규화
        const digits = s.replace(/\D/g, "").padStart(4, "0");
        return `poke-${digits}`;
    }

    // "0001", "1", "001" 등 → "poke-0001"
    const digits = s.replace(/\D/g, "").padStart(4, "0");
    return `poke-${digits}`;
}

// 레벨에 맞게 기술 리스트 생성 (중복 제거 + 마지막 4개만)
function buildMovesFromLearnset(
    entries: LearnsetEntry[],
    level: number,
): Move[] {
    const learned = entries.filter((e) => e.level <= level);

    // 중복 제거 + 마지막 4개만 남기기
    const uniqueIds = Array.from(
        new Set(learned.map((e) => e.moveId)),
    ) as (keyof typeof MOVE_DB)[];

    const lastIds = uniqueIds.slice(-4);

    return lastIds.map((id) => MOVE_DB[id]);
}

/* 🔽🔽🔽 여기서부터 새로 추가 🔽🔽🔽 */

/**
 * 내부용: fromLevel < level <= toLevel 구간에서 새로 배우는 moveId들만 추출
 */
function getNewMoveIdsFromLearnset(
    entries: LearnsetEntry[],
    fromLevel: number,
    toLevel: number,
): (keyof typeof MOVE_DB)[] {
    if (toLevel <= fromLevel) return [];

    const newly = entries.filter(
        (e) => e.level > fromLevel && e.level <= toLevel,
    );

    // 혹시 같은 기술을 여러 레벨에서 다시 배우는 케이스 대비해서 중복 제거
    return Array.from(
        new Set(newly.map((e) => e.moveId)),
    ) as (keyof typeof MOVE_DB)[];
}

/**
 * 헬퍼 1:
 *  - speciesId, 이전 레벨, 새 레벨을 받아서
 *  - 그 사이에 "새로 배우는 기술 id 리스트"만 반환
 *  - 레벨업 서비스에서 learned_moves 업데이트할 때 사용
 */
export function getNewlyLearnedMoveIds(
    speciesId: string,
    fromLevel: number,
    toLevel: number,
): string[] {
    const normalized = normalizeSpeciesIdForLearnset(speciesId);
    const learnset = SPECIES_LEARNSETS[normalized];

    if (!learnset) return [];

    const ids = getNewMoveIdsFromLearnset(learnset, fromLevel, toLevel);
    // 외부에선 string[] 으로 다루기 편하도록 캐스팅
    return ids as string[];
}

/**
 * 헬퍼 2:
 *  - 위와 동일하지만 Move 객체 리스트로 반환
 *  - UI에서 "이번에 새로 배운 기술" 카드 보여줄 때 사용 가능
 */
export function getNewlyLearnedMoves(
    speciesId: string,
    fromLevel: number,
    toLevel: number,
): Move[] {
    const normalized = normalizeSpeciesIdForLearnset(speciesId);
    const learnset = SPECIES_LEARNSETS[normalized];

    if (!learnset) return [];

    const ids = getNewMoveIdsFromLearnset(learnset, fromLevel, toLevel);
    return ids.map((id) => MOVE_DB[id]);
}

/* 🔼🔼🔼 여기까지 새로 추가 🔼🔼🔼 */

// ====== 3) 종 + 레벨 → 실제 기술 리스트 ======
export function getMovesForSpeciesAndLevel(
    speciesId: string,
    level: number,
): Move[] {
    const normalized = normalizeSpeciesIdForLearnset(speciesId);
    const learnset = SPECIES_LEARNSETS[normalized];

    if (learnset) {
        return buildMovesFromLearnset(learnset, level);
    }

    // TODO: 다른 포켓몬들은 SPECIES_LEARNSETS에 추가
    // 일단은 기본기 하나라도 갖게 fallback
    return [MOVE_DB.tackle];
}
