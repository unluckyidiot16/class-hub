// src/games/quizmon/battleFactory.ts
import {
    type ElementType,
    type Monster,
    type QuizmonOwnedMonsterRow,
    type QuizmonSpeciesRow,
} from "./types";
import { getPokemonDimension } from "./pokemonDimensions";
import { getMovesForSpeciesAndLevel } from "./moveData";
import { calcDerivedStats } from "./stats";

/**
 * 기존 제네릭 코드와의 호환을 위해 alias 유지
 */
export type QuizmonSpeciesLike = QuizmonSpeciesRow;
export type QuizmonOwnedMonsterLike = QuizmonOwnedMonsterRow;

/**
 * 전투용 몬스터의 코어 타입
 * - Monster 타입을 그대로 재사용
 */
export type BattleMonsterCore = Monster;

/**
 * quizmon_species + quizmon_owned_monsters → 전투용 몬스터로 변환
 *
 * TExtra로 Monster 외에 필요한 필드를 추가로 주입할 수 있게 해 둠.
 *   예: moves, statusEffects, partySlot 등
 */
export function buildBattleMonsterFromSpecies<
    TExtra extends object = {},
>(
    species: QuizmonSpeciesLike,
    owned: QuizmonOwnedMonsterLike,
    extra?: TExtra,
): BattleMonsterCore & TExtra {
    const level = owned.level ?? 1;

    // ✅ 종 + 레벨 → 파생 스탯 계산 (이 함수만 믿고 가기)
    const stats = calcDerivedStats(species, level);

    const maxHp = stats.maxHp;

    const storedHp = (owned as any).current_hp as number | null | undefined;
    const storedFainted = (owned as any).is_fainted as boolean | null | undefined;

    let initialHp: number;

    if (storedFainted) {
        initialHp = 0;
    } else if (typeof storedHp === "number") {
        const clamped = Math.max(0, Math.min(maxHp, storedHp));
        initialHp = clamped;
    } else {
        initialHp = maxHp;
    }

    const dim = getPokemonDimension(species.pokedex_no ?? null);

    const baseMonster: Monster = {
        id: owned.id,
        speciesId: species.id,
        name: species.name,
        element: species.element as ElementType,

        level,
        exp: owned.exp ?? 0,

        // 🔹 전투 스탯 = 파생 스탯
        maxHp,
        hp: initialHp,
        atk: stats.atk,
        def: stats.def,
        spd: stats.spd,

        moves: getMovesForSpeciesAndLevel(species.id, level),

        accStage: 0,
        evaStage: 0,
        status: "none",

        pokedexNo: species.pokedex_no ?? null,
        heightM: dim?.heightM ?? null,
        weightKg: dim?.weightKg ?? null,
    };

    return {
        ...(baseMonster as Monster),
        ...(extra as TExtra),
    };
}

