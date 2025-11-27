// src/games/pemmon/exploreLogic.ts

import type { Species } from "./pemmonTypes";
import speciesData from "./pemmonSpecies.json";

export const ALL_SPECIES = (speciesData as Species[]).slice().sort((a, b) => a.id - b.id);

// 세대 판정 헬퍼
function getGenerationTag(s: Species): string {
    if (s.generation) return s.generation;

    // generation 값이 없는 경우 id 기반 대략 추정 (백업용)
    const id = s.id;
    if (id <= 151) return "generation-i";
    if (id <= 251) return "generation-ii";
    if (id <= 386) return "generation-iii";
    if (id <= 493) return "generation-iv";
    if (id <= 649) return "generation-v";
    if (id <= 721) return "generation-vi";
    if (id <= 809) return "generation-vii";
    if (id <= 898) return "generation-viii";
    return "generation-ix";
}

// 세대별 버킷
const GEN1 = ALL_SPECIES.filter((s) => getGenerationTag(s) === "generation-i");
const GEN8 = ALL_SPECIES.filter((s) => getGenerationTag(s) === "generation-viii");
const GEN9 = ALL_SPECIES.filter((s) => getGenerationTag(s) === "generation-ix");

type GenBucket = "gen1" | "gen8" | "gen9";

const GEN_WEIGHTS: Record<GenBucket, number> = {
    gen1: 0.6,
    gen8: 0.25,
    gen9: 0.15,
};

function pickGenerationBucket(): GenBucket {
    const r = Math.random();
    const g1 = GEN_WEIGHTS.gen1;
    const g8 = GEN_WEIGHTS.gen8;

    if (r < g1) return "gen1";
    if (r < g1 + g8) return "gen8";
    return "gen9";
}

// 희귀도: 전설/환상은 매우 낮게, 나머지는 높게
function getRarityWeight(s: Species): number {
    if (s.isLegendary) return 1; // 전설/환상
    return 10; // 일반
}

function weightedRandom<T>(items: T[], getWeight: (x: T) => number): T | null {
    let sum = 0;
    const weights: number[] = [];

    for (const item of items) {
        const w = getWeight(item);
        if (w <= 0) continue;
        weights.push(w);
        sum += w;
    }
    if (sum <= 0) return null;

    let r = Math.random() * sum;
    for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
    }
    return items[items.length - 1] ?? null;
}

/**
 * 탐험에서 만날 포켓몬 1마리 뽑기
 * - 1세대 + 8·9세대만 사용
 * - 세대 비율: GEN_WEIGHTS 참고
 * - 같은 세대 내에서 전설/환상은 희귀하게 등장
 */
export function pickRandomEncounter(): Species | null {
    const bucket = pickGenerationBucket();
    let pool: Species[];

    if (bucket === "gen1") pool = GEN1;
    else if (bucket === "gen8") pool = GEN8;
    else pool = GEN9;

    if (pool.length === 0) return null;

    return weightedRandom(pool, getRarityWeight);
}
