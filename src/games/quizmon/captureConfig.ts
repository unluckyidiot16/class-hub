// src/games/quizmon/captureConfig.ts
import type { QuizmonSpeciesRow } from "./types";

export type CaptureBallId = "poke_ball" | "great_ball" | "ultra_ball";

export type CaptureBallMeta = {
    id: CaptureBallId;
    label: string;
    baseRate: number; // 희귀도 1 기준 기본 포획률 (0~1)
    streakK: number;  // 연속 정답 계수
    maxQuestions: number;
};

export const CAPTURE_BALL_CONFIG: Record<CaptureBallId, CaptureBallMeta> = {
    poke_ball: {
        id: "poke_ball",
        label: "포켓볼",
        baseRate: 0.25,
        streakK: 0.25,
        maxQuestions: 3,
    },
    great_ball: {
        id: "great_ball",
        label: "슈퍼볼",
        baseRate: 0.35,
        streakK: 0.3,
        maxQuestions: 3,
    },
    ultra_ball: {
        id: "ultra_ball",
        label: "하이퍼볼",
        baseRate: 0.45,
        streakK: 0.35,
        maxQuestions: 3,
    },
};

// 희귀도에 따른 기본 보정 (희귀할수록 조금 더 잡기 어렵게)
export function getBaseCaptureRateForSpecies(
    species: QuizmonSpeciesRow,
    ballId: CaptureBallId,
): number {
    const rarity = species.rarity ?? 1; // 1~5
    const ball = CAPTURE_BALL_CONFIG[ballId];

    // 희귀도 1 → 100%, 희귀도 5 → 80% 배율 정도
    const rarityPenalty = 1 - (rarity - 1) * 0.05;
    const raw = ball.baseRate * rarityPenalty;

    // 너무 극단적인 값 방지
    return Math.min(0.9, Math.max(0.05, raw));
}
