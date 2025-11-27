// src/games/pemmon/scaleUtils.ts

import type { Species } from "./pemmonTypes";

/**
 * 포켓몬 키(height, decimeters)를 이용해
 * 스프라이트 스케일 팩터를 계산.
 *
 * - BASE_HEIGHT(=10dm)를 기준으로,
 *   height가 작으면 크게, 크면 작게 보이도록 조정
 * - 결과는 0.7 ~ 1.4 사이로 제한
 */
export function getScaleForSpecies(species: Species): number {
    const BASE_HEIGHT = 10; // 1m
    const h = species.height || BASE_HEIGHT;

    // 1m보다 작으면 스케일 > 1, 크면 < 1
    const raw = BASE_HEIGHT / h;

    const SCALE_MIN = 0.7;
    const SCALE_MAX = 1.4;

    const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, raw));
    return Number(clamped.toFixed(2));
}
