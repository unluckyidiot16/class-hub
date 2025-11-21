// src/games/quizmon/pokemonDimensions.ts

export type PokemonDimension = {
    heightM: number;   // m 단위 키
    weightKg: number;  // kg 단위 몸무게
};

/**
 * pokedex_no → 키/몸무게 매핑
 *
 * ⚠️ 아래는 예시 몇 개만 넣어둔 상태라,
 * 실제로 사용할 종만 골라서 계속 채워 넣으면 됩니다.
 */
export const POKEMON_DIMENSIONS: Record<number, PokemonDimension> = {
    // Kanto starters 예시
    1: { heightM: 0.7, weightKg: 6.9 },   // Bulbasaur
    2: { heightM: 1.0, weightKg: 13.0 },  // Ivysaur
    3: { heightM: 2.0, weightKg: 100.0 }, // Venusaur

    4: { heightM: 0.6, weightKg: 8.5 },   // Charmander
    5: { heightM: 1.1, weightKg: 19.0 },  // Charmeleon
    6: { heightM: 1.7, weightKg: 90.5 },  // Charizard

    7: { heightM: 0.5, weightKg: 9.0 },   // Squirtle
    8: { heightM: 1.0, weightKg: 22.5 },  // Wartortle
    9: { heightM: 1.6, weightKg: 85.5 },  // Blastoise,

    // 필요하면 계속 추가…
};

/**
 * pokedex_no에서 키/몸무게 정보를 꺼내는 헬퍼
 */
export function getPokemonDimension(
    pokedexNo: number | null | undefined,
): PokemonDimension | undefined {
    if (!pokedexNo) return undefined;
    return POKEMON_DIMENSIONS[pokedexNo] ?? undefined;
}
