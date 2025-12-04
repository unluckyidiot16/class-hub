// src/games/quizmon/effectPaths.ts
import effectGraphicMap from "./effectGraphicMap.json";

type EffectGraphicEntry = {
    moveId: string;
    graphic: string;
    jsonFile: string;
};

// ✅ assets.ts와 동일한 방식
const BASE_URL = (import.meta as any).env?.BASE_URL ?? "/";

// docs/games/quizmon/effects 아래를 기준으로
const EFFECT_BASE = `${BASE_URL}games/quizmon/effects`;

export function getEffectPathsForMove(
    moveId: string,
): { jsonUrl: string; imageUrl: string } | null {
    const entry = (effectGraphicMap as Record<string, EffectGraphicEntry>)[
        moveId
        ];
    if (!entry) return null;

    const jsonUrl = `${EFFECT_BASE}/${entry.jsonFile}`;
    const imageUrl = `${EFFECT_BASE}/${encodeURIComponent(entry.graphic)}.png`;

    return { jsonUrl, imageUrl };
}
