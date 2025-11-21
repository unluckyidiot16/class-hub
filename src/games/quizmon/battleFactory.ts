// src/games/quizmon/battleFactory.ts
import {
    type ElementType,
    type Monster,
    type QuizmonOwnedMonsterRow,
    type QuizmonSpeciesRow,
} from "./types";
import { getPokemonDimension } from "./pokemonDimensions";

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

    // 🔢 아주 단순한 레벨 스케일링 – 숫자는 나중에 조정 가능
    const maxHp = species.base_hp + level * 5;
    const atk = species.base_atk + level * 2;
    const def = species.base_def + level * 2;
    const spd = species.base_spd + Math.floor(level / 5); // 레벨 5마다 살짝 속도 증가

    const dim = getPokemonDimension(species.pokedex_no ?? null);

    const baseMonster: Monster = {
        id: owned.id,           // 개체 ID
        speciesId: species.id,  // 종 ID
        name: species.name,
        element: species.element as ElementType,

        level,
        exp: owned.exp ?? 0,

        maxHp,
        hp: maxHp,
        atk,
        def,
        spd,

        accStage: 0,
        evaStage: 0,
        status: "none",

        pokedexNo: species.pokedex_no ?? null,
        heightM: dim?.heightM ?? null,
        weightKg: dim?.weightKg ?? null,

        moves: [], // 실제 스킬 장착은 extra에서 주입
    };

    return {
        ...(baseMonster as Monster),
        ...(extra as TExtra),
    };
}
