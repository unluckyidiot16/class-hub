// battleEffectSheets.ts
export type EffectSheetConfig = {
    imageUrl: string;   // 실제 PNG 경로
    frameWidth: number;
    frameHeight: number;
};

export const EFFECT_SHEETS: Record<string, EffectSheetConfig> = {
    // TODO: 실제 경로/크기 맞게 조정
    "PRAS- Absorption": {
        imageUrl: "/games/quizmon/effects/absorption.png",
        frameWidth: 64,
        frameHeight: 64,
    },
    // "PRFX- TackleHit": { ... } 등 계속 추가
};
