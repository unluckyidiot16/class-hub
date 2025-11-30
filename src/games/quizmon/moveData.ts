// src/games/quizmon/moveData.ts
import type { Move } from "./types";
import rawMovesJson from "./data/moves.json";
import rawLearnsetsJson from "./data/learnsets.json";

/**
 * ------------------------------------------------------------------
 * 1. JSON 타입 정의
 * ------------------------------------------------------------------
 */
type RawMove = {
    id: string;
    name: string;
    nameKo?: string;
    element: string; // "grass" | "fire" | ...
    category: "physical" | "special" | "status";
    power?: number | null;
    accuracy?: number | null;
    pp?: number | null;
    priority?: number | null;
    target?: string;
    meta?: Record<string, unknown>;
};

type RawLearnsetEntry = {
    level: number;
    moveId: string;
};

type RawLearnsetRow = {
    speciesId: string;
    learn: RawLearnsetEntry[];
};

const rawMoves = rawMovesJson as RawMove[];
const rawLearnsets = rawLearnsetsJson as RawLearnsetRow[];

/**
 * ------------------------------------------------------------------
 * 2. MOVE_DB 구성
 * ------------------------------------------------------------------
 */

export const MOVE_DB: Record<string, Move> = {};

for (const m of rawMoves) {
    // 여기서 Move 타입에 맞게 매핑해 준다.
    // (필요하면 category, pp, meta 등을 Move에 추가)
    MOVE_DB[m.id] = {
        id: m.id,
        name: m.nameKo ?? m.name,
        power: m.power ?? 0,
        baseAcc: m.accuracy ?? 100,
        element: m.element,
        // 원하는 필드 더 있으면 여기서 채우기
        // category: m.category,
        // pp: m.pp ?? undefined,
        // priority: m.priority ?? 0,
        // target: m.target ?? "enemy",
        // meta: m.meta ?? {},
    } as Move;
}

/**
 * ------------------------------------------------------------------
 * 3. 종별 레벨업 테이블 (SPECIES_LEARNSETS)
 * ------------------------------------------------------------------
 */

type LearnsetEntry = {
    level: number;
    moveId: string; // 나중에 keyof typeof MOVE_DB 로 좁혀서 쓸 것
};

const SPECIES_LEARNSETS: Record<string, LearnsetEntry[]> = {};

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

// JSON → 내부 맵으로 옮기기
for (const row of rawLearnsets) {
    const normalized = normalizeSpeciesIdForLearnset(row.speciesId);
    const entries: LearnsetEntry[] = (row.learn ?? []).map((e) => ({
        level: e.level,
        moveId: e.moveId,
    }));
    SPECIES_LEARNSETS[normalized] = entries;
}

/**
 * ------------------------------------------------------------------
 * 4. 공통 헬퍼들
 * ------------------------------------------------------------------
 */

// 레벨에 맞게 기술 리스트 생성 (중복 제거 + 마지막 4개만)
function buildMovesFromLearnset(
    entries: LearnsetEntry[],
    level: number,
): Move[] {
    const learned = entries.filter((e) => e.level <= level);

    // 중복 제거 + 마지막 4개만 남기기
    const uniqueIds = Array.from(
        new Set(learned.map((e) => e.moveId)),
    );

    const lastIds = uniqueIds.slice(-4);

    // MOVE_DB에 실제 존재하는 것만 반환
    return lastIds
        .map((id) => MOVE_DB[id])
        .filter((m): m is Move => Boolean(m));
}

/**
 * 내부용: fromLevel < level <= toLevel 구간에서 새로 배우는 moveId들만 추출
 */
function getNewMoveIdsFromLearnset(
    entries: LearnsetEntry[],
    fromLevel: number,
    toLevel: number,
): string[] {
    if (toLevel <= fromLevel) return [];

    const newly = entries.filter(
        (e) => e.level > fromLevel && e.level <= toLevel,
    );

    return Array.from(new Set(newly.map((e) => e.moveId)));
}

/**
 * speciesId, 이전 레벨, 새 레벨을 받아서
 * 그 사이에 "새로 배우는 기술 id 리스트"만 반환
 */
export function getNewlyLearnedMoveIds(
    speciesId: string,
    fromLevel: number,
    toLevel: number,
): string[] {
    const normalized = normalizeSpeciesIdForLearnset(speciesId);
    const learnset = SPECIES_LEARNSETS[normalized];

    if (!learnset) return [];

    const ids = getNewMoveIdsFromLearnset(
        learnset,
        fromLevel,
        toLevel,
    );

    // MOVE_DB에 없는 id는 자동 필터링
    return ids.filter((id) => !!MOVE_DB[id]);
}

/**
 * 위와 동일하지만 Move 객체 리스트로 반환
 * (UI에서 "이번에 새로 배운 기술" 카드 보여줄 때 사용)
 */
export function getNewlyLearnedMoves(
    speciesId: string,
    fromLevel: number,
    toLevel: number,
): Move[] {
    const normalized = normalizeSpeciesIdForLearnset(speciesId);
    const learnset = SPECIES_LEARNSETS[normalized];

    if (!learnset) return [];

    const ids = getNewMoveIdsFromLearnset(
        learnset,
        fromLevel,
        toLevel,
    );

    return ids
        .map((id) => MOVE_DB[id])
        .filter((m): m is Move => Boolean(m));
}

/**
 * 종 + 레벨 → 실제 전투에서 쓸 4개 기술 리스트
 */
export function getMovesForSpeciesAndLevel(
    speciesId: string,
    level: number,
): Move[] {
    const normalized = normalizeSpeciesIdForLearnset(speciesId);
    const learnset = SPECIES_LEARNSETS[normalized];

    if (learnset) {
        const list = buildMovesFromLearnset(learnset, level);
        if (list.length > 0) return list;
    }

    // TODO: learnsets.json에 아직 안 넣은 종이면 여기로.
    // 최소한 번들에 있는 아무 기본기라도 한 개 넣어 주기.
    if (MOVE_DB["tackle"]) return [MOVE_DB["tackle"]];
    // 그래도 없으면 그냥 빈 배열 반환
    return [];
}
