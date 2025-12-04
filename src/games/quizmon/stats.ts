// src/games/quizmon/stats.ts
import type { QuizmonSpeciesRow } from "./types";

export type DerivedStats = {
    maxHp: number;
    atk: number;
    spAtk: number;
    spDef: number;
    def: number;
    spd: number;
};

/**
 * 종(base_* 스탯) + 레벨 → 전투용 스탯 계산
 * - 지금은 단순 선형 성장, 나중에 공식을 바꿔도 이 함수만 고치면 됨
 */
export function calcDerivedStats(
    species: QuizmonSpeciesRow,
    level: number,
): DerivedStats {
    const baseHp = species.base_hp ?? 30;
    const baseAtk = species.base_atk ?? 10;
    const basespAtk = species.base_spatk ?? 10;
    const basespDef = species.base_spdef ?? 10;
    const baseDef = species.base_def ?? 10;
    const baseSpd = species.base_spd ?? 10;
    

    const lvl = Math.max(1, Math.min(level, 100)); // 1~100 보정

    // 원하는 감각에 맞게 수치만 나중에 손봐도 됨
    const maxHp = Math.round(baseHp + (lvl - 1) * 3);      // HP는 좀 더 크게 성장
    const atk   = Math.round(baseAtk + (lvl - 1) * 1.5);
    const spAtk = Math.round(basespAtk + (lvl - 1) * 1.5);
    const spDef = Math.round(basespDef + (lvl - 1) * 1.5);
    const def   = Math.round(baseDef + (lvl - 1) * 1.5);
    const spd   = Math.round(baseSpd + (lvl - 1) * 1.2);

    return { maxHp, atk, spAtk, spDef, def, spd };
}
