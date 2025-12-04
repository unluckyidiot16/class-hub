// src/games/quizmon/battleEffectSheets.ts
import effectGraphicMap from "./effectGraphicMap.json";

export type EffectSheetConfig = {
    imageUrl: string; // 실제 PNG 경로
    frameWidth: number;
    frameHeight: number;
};

// GitHub Pages 대응용 BASE_URL (assets.ts와 동일 패턴)
const BASE_URL = (import.meta as any).env?.BASE_URL ?? "/";
const EFFECT_BASE = `${BASE_URL}games/quizmon/effects/`;

// effectGraphicMap.json 을 이용해
// graphic 이름(예: "PRAS- Strike") → 시트 설정을 자동 생성
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
    // 같은 graphic 을 여러 스킬이 공유할 수 있으니 한 번만 등록
    if (acc[graphic]) return acc;

    acc[graphic] = {
        imageUrl: `${EFFECT_BASE}${encodeURIComponent(graphic)}.png`,
        // PRAS 시트 한 칸 크기 (필요하면 수정)
        frameWidth: 64,
        frameHeight: 64,
    };
    return acc;
}, {} as Record<string, EffectSheetConfig>);
