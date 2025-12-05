// src/games/quizmon/ghostBattle.ts
import type { Monster } from "./types";

export type GhostBattleRecord = {
    id: string;
    createdAt: string;
    source: "class" | "raid" | "dungeon" | "solo";
    quizPackId: string | null;
    stats: {
        correct: number;
        total: number;
        accuracy: number;
    };
    playerMonsters: Monster[];
    enemyMonsters: Monster[];
};

const STORAGE_KEY = "quizmon_ghost_battles_v1";

function safeParse(json: string | null): GhostBattleRecord[] {
    if (!json) return [];
    try {
        const arr = JSON.parse(json);
        if (!Array.isArray(arr)) return [];
        return arr;
    } catch {
        return [];
    }
}

export function loadLatestGhostBattle(): GhostBattleRecord | null {
    if (typeof window === "undefined") return null;
    const arr = safeParse(window.localStorage.getItem(STORAGE_KEY));
    if (!arr.length) return null;

    // createdAt 기준 내림차순 정렬 후 첫 번째
    return arr
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}

export function saveGhostBattle(record: GhostBattleRecord) {
    if (typeof window === "undefined") return;
    const arr = safeParse(window.localStorage.getItem(STORAGE_KEY));
    arr.push(record);

    // 최신 20개만 유지
    const sliced = arr
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 20);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sliced));
}
