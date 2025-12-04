// src/games/quizmon/battleEffectSheets.ts
export type EffectSheetConfig = {
    imageUrl: string;
    frameWidth: number;
    frameHeight: number;
};

const BASE_URL = (import.meta as any).env?.BASE_URL ?? "/";
const EFFECT_BASE = `${BASE_URL}games/quizmon/effects/`;

export const EFFECT_SHEETS: Record<string, EffectSheetConfig> = {
    "PRAS- Absorption": {
        imageUrl: `${EFFECT_BASE}absorption.png`,
        frameWidth: 64,
        frameHeight: 64,
    },
    // 필요 시 추가...
};
