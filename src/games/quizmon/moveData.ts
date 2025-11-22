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
        baseAcc: 90,
        element: "grass",
    },
};

// ====== 2) 레벨업 데이터 타입 ======
type LearnsetEntry = {
    level: number;
    moveId: keyof typeof MOVE_DB;
};

// 이상해씨: species_id === "0001" 이라고 가정
const BULBASAUR_LEARNSET: LearnsetEntry[] = [
    { level: 1,  moveId: "tackle" },
    { level: 3,  moveId: "vine_whip" },
    { level: 7,  moveId: "razor_leaf" },
    { level: 12, moveId: "seed_bomb" },
];

// ====== 3) 종 + 레벨 → 실제 기술 리스트 ======
export function getMovesForSpeciesAndLevel(
    speciesId: string,
    level: number,
): Move[] {
    // 이상해씨 (0001)
    if (speciesId === "0001") {
        const learned = BULBASAUR_LEARNSET.filter((e) => e.level <= level);

        // 중복 제거 + 마지막 4개만 남기기
        const uniqueIds = Array.from(
            new Set(learned.map((e) => e.moveId)),
        ) as (keyof typeof MOVE_DB)[];

        const lastIds = uniqueIds.slice(-4);

        return lastIds.map((id) => MOVE_DB[id]);
    }

    // TODO: 다른 포켓몬들은 여기에 점점 추가
    // 일단은 기본기 하나라도 갖게 fallback
    return [MOVE_DB.tackle];
}
