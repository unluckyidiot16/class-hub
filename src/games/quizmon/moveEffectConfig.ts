// src/games/quizmon/moveEffectConfig.ts
import { getEffectPathsForMove } from "./effectPaths";

export type MoveEffectAnchor = "caster" | "target" | "screen";
export type MoveEffectMode = "sheet" | "script";

export type MoveEffectConfig = {
    moveId: string;
    mode?: MoveEffectMode;
    jsonUrl: string;
    imageUrl?: string;
    fps?: number;
    scale?: number;
    anchor?: MoveEffectAnchor;
    durationMs?: number;
};

export const MOVE_EFFECT_CONFIG: Record<string, MoveEffectConfig> = {
    // 수동 오버라이드가 필요하면 여기만 채우고,
    // tackle 같은 기본 기술은 effectPaths로 자동 처리하게 놔두는 걸 추천
};

export function getMoveEffectConfig(
    moveId: string,
): MoveEffectConfig | null {
    // 1) 수동 설정 우선
    const manual = MOVE_EFFECT_CONFIG[moveId];
    if (manual) return manual;

    // 2) effectGraphicMap 기반 기본 경로
    const paths = getEffectPathsForMove(moveId);
    if (!paths) return null;

    return {
        moveId,
        mode: "script",
        jsonUrl: paths.jsonUrl,
        imageUrl: paths.imageUrl,
        fps: 20,
        anchor: "target",
    };
}
