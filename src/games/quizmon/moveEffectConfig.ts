// moveEffectConfig.ts
import { getEffectPathsForMove } from "./effectPaths";

export type MoveEffectAnchor = "caster" | "target" | "screen";
export type MoveEffectMode = "sheet" | "script";

export type MoveEffectConfig = {
    moveId: string;
    mode?: MoveEffectMode;  // 기본 "sheet"
    jsonUrl: string;
    imageUrl?: string;      // sheet 모드 전용
    fps?: number;
    scale?: number;
    anchor?: MoveEffectAnchor;
    durationMs?: number;
};

export const MOVE_EFFECT_CONFIG: Record<string, MoveEffectConfig> = {
    ember: {
        moveId: "ember",
        mode: "script",
        jsonUrl: "/games/quizmon/battle-anims/ember.json",
        anchor: "target",
        fps: 20,
    },
    tackle: {
        moveId: "tackle",
        mode: "script",
        jsonUrl: "/games/quizmon/battle-anims/tackle.json",
        anchor: "target",
        fps: 20,
    },
    // 필요하면 TexturePacker sheet 기반 이펙트도 "sheet" 모드로 같이 사용 가능
};

export function getMoveEffectConfig(
    moveId: string,
): MoveEffectConfig | null {
    // 1) 수동 설정 우선 (기존 ember, tackle 등)
    const manual = MOVE_EFFECT_CONFIG[moveId];
    if (manual) return manual;

    // 2) effectGraphicMap.json 기반 자동 매핑
    //    → effectPaths.ts 가 moveId → { jsonUrl, imageUrl } 를 만들어 줌
    const paths = getEffectPathsForMove(moveId);
    if (!paths) {
        // effectGraphicMap.json 에 없는 기술이면 이펙트 없음
        return null;
    }

    // PokéRogue battle script 형식이라고 가정하고 script 모드로 사용
    return {
        moveId,
        mode: "script",      // BattleScriptAnimation 사용
        jsonUrl: paths.jsonUrl,
        fps: 24,
        anchor: "target",    // 기본은 타겟 쪽에 터지도록
    };
}
