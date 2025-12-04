// src/games/quizmon/effectPaths.ts
import effectGraphicMap from "./effectGraphicMap.json";

type EffectGraphicEntry = {
    moveId: string;
    graphic: string;
    jsonFile: string;
};

const EFFECT_BASE_JSON = "/games/quizmon/effects";
const EFFECT_GRAPHIC_BASE = "/games/quizmon/effects";

export function getEffectPathsForMove(
    moveId: string,
): { jsonUrl: string; imageUrl: string } | null {
    const entry = (effectGraphicMap as Record<string, EffectGraphicEntry>)[
        moveId
        ];
    if (!entry) return null;

    const jsonUrl = `${EFFECT_BASE_JSON}/${entry.jsonFile}`;
    const imageUrl = `${EFFECT_GRAPHIC_BASE}/${encodeURIComponent(
        entry.graphic,
    )}.png`;

    return { jsonUrl, imageUrl };
}
