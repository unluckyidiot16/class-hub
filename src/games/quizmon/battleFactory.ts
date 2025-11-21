// src/games/quizmon/battleFactory.ts
import type { ElementType } from "./types";
import { getPokemonDimension } from "./pokemonDimensions";

/**
 * Supabase quizmon_species row에서 필요한 필드만 발췌한 타입
 */
export type QuizmonSpeciesLike = {
    id: string;
    name: string;
    element: ElementType; // 'normal' | 'fire' | ...
    base_hp: number;
    base_atk: number;
    base_def: number;
    base_spd: number;
    pokedex_no?: number | null;
};

/**
 * Supabase quizmon_owned_monsters row에서 필요한 필드만 발췌한 타입
 */
export type QuizmonOwnedMonsterLike = {
    id: string;
    species_id: string;
    level?: number | null;
    exp?: number | null;
};

/**
 * 전투에서 실제로 사용하는 몬스터 객체의 최소 형태
 *
 * - calcHitChance의 SizeSource를 만족하기 위해
 *   heightM / weightKg / pokedexNo 를 포함시켜 둠
 */
export type BattleMonsterCore = {
    // 고유 ID (개체)
    instanceId: string;
    // 종 ID
    speciesId: string;

    name: string;
    element: ElementType;
    level: number;

    maxHp: number;
    hp: number;
    atk: number;
    def: number;
    spd: number;

    // 회피율 계산용 정보
    pokedexNo?: number | null;
    heightM?: number;
    weightKg?: number;
};

/**
 * quizmon_species + quizmon_owned_monsters → 전투용 몬스터로 변환
 *
 * TExtra로 BattleMonsterCore 외에 필요한 필드를 추가로 주입할 수 있게 해 둠.
 *   예: moves, statusEffects, etc.
 */
export function buildBattleMonsterFromSpecies<
    TSpecies extends QuizmonSpeciesLike,
    TOwned extends QuizmonOwnedMonsterLike,
    TExtra extends object = {},
>(
    species: TSpecies,
    owned: TOwned,
    extra?: TExtra,
): BattleMonsterCore & TExtra {
    const level = owned.level ?? 1;

    // 🔢 아주 단순한 레벨 스케일링 – 숫자는 나중에 조정 가능
    const maxHp = species.base_hp + level * 5;
    const atk = species.base_atk + level * 2;
    const def = species.base_def + level * 2;
    const spd = species.base_spd + Math.floor(level / 5); // 레벨 5마다 살짝 속도 증가

    const dim = getPokemonDimension(species.pokedex_no ?? null);

    return {
        ...(extra as TExtra),
        instanceId: owned.id,
        speciesId: species.id,

        name: species.name,
        element: species.element,
        level,

        maxHp,
        hp: maxHp, // 전투 시작 시 풀피
        atk,
        def,
        spd,

        pokedexNo: species.pokedex_no ?? null,
        heightM: dim?.heightM,
        weightKg: dim?.weightKg,
    };
}
