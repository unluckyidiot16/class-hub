// src/games/quizmon/assets.ts

// GitHub Pages에서도 잘 동작하도록 base URL을 사용
const BASE_URL = (import.meta as any).env?.BASE_URL ?? "/";

// ex) BASE_URL = "/class-hub/" 라면
//   → "/class-hub/assets/quizmon/monsters/poke-0001.png"
const MONSTER_BASE = `${BASE_URL}assets/quizmon/monsters/`;
const TRAINER_BASE = `${BASE_URL}assets/quizmon/trainers/`;

/**
 * species_id → 몬스터 스프라이트 URL
 *   - species_id: "poke-0001" 같은 값
 *   - 파일 경로: public/assets/quizmon/monsters/poke-0001.png
 */
export function getMonsterSprite(speciesId?: string | null): string | null {
    if (!speciesId) return null;
    return `${MONSTER_BASE}${speciesId}.png`;
}

/**
 * 트레이너 키 → 트레이너 스프라이트 URL
 *   - trainerKey: "default", "t-001" 같은 값
 *   - 파일 경로: public/assets/quizmon/trainers/{trainerKey}.png
 */
export function getTrainerSprite(trainerKey?: string | null): string {
    const key = trainerKey || "default";
    return `${TRAINER_BASE}${key}.png`;
}
