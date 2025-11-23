// src/games/quizmon/battleFactory.ts
import {
    type ElementType,
    type Monster,
    type QuizmonOwnedMonsterRow,
    type QuizmonSpeciesRow,
} from "./types";
import { getPokemonDimension } from "./pokemonDimensions";
import { getMovesForSpeciesAndLevel } from "./moveData";

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

    // ✅ DB에 저장된 HP/기절 정보 사용
    // - current_hp: null 이면 "풀피"로 간주
    // - is_fainted: true 면 무조건 0으로 시작
    const storedHp = (owned as any).current_hp as number | null | undefined;
    const storedFainted = (owned as any).is_fainted as boolean | null | undefined;

    let initialHp: number;

    if (storedFainted) {
        // DB에서 기절 처리된 개체는 0으로 시작
        initialHp = 0;
    } else if (typeof storedHp === "number") {
        // 숫자면 0~maxHp 범위로 클램프
        const clamped = Math.max(0, Math.min(maxHp, storedHp));
        initialHp = clamped;
    } else {
        // null/undefined → 아직 한번도 전투/회복 이력 없음 → 풀피
        initialHp = maxHp;
    }

    const dim = getPokemonDimension(species.pokedex_no ?? null);

    const baseMonster: Monster = {
        id: owned.id,           // 개체 ID
        speciesId: species.id,  // 종 ID
        name: species.name,
        element: species.element as ElementType,

        level,
        exp: owned.exp ?? 0,

        maxHp,
        hp: initialHp,
        atk: species.base_atk,
        def: species.base_def,
        spd: species.base_spd,

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
