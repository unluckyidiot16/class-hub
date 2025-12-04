// battleScriptTypes.ts
export type ScriptSprite = {
    x: number;
    y: number;
    zoomX: number;
    zoomY: number;
    visible: boolean;
    target: number;        // 0,1,2 ... (caster/target/screen 등 해석은 나중에)
    graphicFrame: number;
    opacity: number;
    priority: number;
    focus: number;
};

export type ScriptLayer = {
    id: number;
    graphic: string;       // 예: "PRAS- Absorption"
    frames: ScriptSprite[][];
    frameTimedEvents?: Record<string, unknown>;
    position?: number;
    hue?: number;
};

// absorb.json / tackle.json 전체는 사실상 ScriptLayer[]
export type BattleScriptJson = ScriptLayer[];

