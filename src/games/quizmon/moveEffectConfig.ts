// moveEffectConfig.ts
export type MoveEffectAnchor = "caster" | "target" | "screen";

export type MoveEffectConfig = {
    moveId: string;                // MOVE_DB id 와 동일
    jsonUrl: string;               // /public 경로
    imageUrl: string;
    fps?: number;
    scale?: number;
    anchor?: MoveEffectAnchor;     // 어디 기준으로 띄울지
    durationMs?: number;
};

const BASE = "/games/quizmon/effects";

export const MOVE_EFFECT_CONFIG: Record<string, MoveEffectConfig> = {
    ember: {
        moveId: "ember",
        jsonUrl: `${BASE}/ember.json`,
        imageUrl: `${BASE}/ember.png`,
        fps: 18,
        scale: 1.4,
        anchor: "target",
    },
    tackle: {
        moveId: "tackle",
        jsonUrl: `${BASE}/tackle.json`,
        imageUrl: `${BASE}/tackle.png`,
        fps: 16,
        scale: 1.0,
        anchor: "target",
    },
    // aeroblast, accelerock, absorb ... 계속 추가
};

export function getMoveEffectConfig(moveId: string) {
    return MOVE_EFFECT_CONFIG[moveId] ?? null;
}
