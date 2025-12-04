// src/games/quizmon/battleEffectSheets.ts
import effectGraphicMap from "./effectGraphicMap.json";

export type EffectSheetConfig = {
    imageUrl: string;
    frameWidth: number;
    frameHeight: number;
};

const BASE_URL = (import.meta as any).env?.BASE_URL ?? "/";
const EFFECT_BASE = `${BASE_URL}games/quizmon/effects/`;

// effectGraphicMap.json 기반: graphic 이름 → PNG 시트 설정
type EffectGraphicEntry = {
    moveId: string;
    graphic: string;
    jsonFile: string;
};

export const EFFECT_SHEETS: Record<string, EffectSheetConfig> = Object.values(
    effectGraphicMap as Record<string, EffectGraphicEntry>,
).reduce((acc, entry) => {
    const graphic = entry.graphic;
    if (!graphic) return acc;
    if (acc[graphic]) return acc; // 같은 graphic 여러 번 등록 방지

    acc[graphic] = {
        imageUrl: `${EFFECT_BASE}${encodeURIComponent(graphic)}.png`,
        // ⬇️ PRAS 시트 한 칸 크기: 80 x 64
        frameWidth: 80,
        frameHeight: 64,
    };
    return acc;
}, {} as Record<string, EffectSheetConfig>);
