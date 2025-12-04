// moveEffectConfig.ts
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
    return MOVE_EFFECT_CONFIG[moveId] ?? null;
}
