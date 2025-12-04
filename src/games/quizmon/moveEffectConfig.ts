// src/games/quizmon/moveEffectConfig.ts
import { getEffectPathsForMove } from "./effectPaths";

export type MoveEffectAnchor = "caster" | "target" | "screen";
export type MoveEffectMode = "sheet" | "script";

export type MoveEffectConfig = {
    moveId: string;
    mode?: MoveEffectMode;  // 기본 "sheet"
    jsonUrl: string;
    imageUrl?: string;      // script / sheet 공통으로 사용
    fps?: number;
    scale?: number;
    anchor?: MoveEffectAnchor;
    durationMs?: number;
};

// 필요하면 나중에 수동 오버라이드용으로 사용 (지금은 비워두기)
export const MOVE_EFFECT_CONFIG: Record<string, MoveEffectConfig> = {
    // 예시:
    // ember: {
    //   moveId: "ember",
    //   mode: "script",
    //   jsonUrl: "/커스텀경로.json",
    //   imageUrl: "/커스텀이미지.png",
    //   fps: 24,
    //   anchor: "target",
    // },
};

export function getMoveEffectConfig(
    moveId: string,
): MoveEffectConfig | null {
    // 1) 수동 설정 우선
    const manual = MOVE_EFFECT_CONFIG[moveId];
    if (manual) return manual;

    // 2) effectGraphicMap.json 기반 자동 매핑
    const paths = getEffectPathsForMove(moveId);
    if (!paths) return null;

    return {
        moveId,
        mode: "script",         // PokéRogue battle script 형식
        jsonUrl: paths.jsonUrl, // 예: /games/quizmon/effects/tackle.json
        imageUrl: paths.imageUrl, // 예: /games/quizmon/effects/PRAS-%20Strike.png
        fps: 20,
        anchor: "target",
    };
}
