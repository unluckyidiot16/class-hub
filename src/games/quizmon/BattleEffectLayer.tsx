// src/games/quizmon/BattleEffectLayer.tsx
import { useEffect } from "react";
import { SpriteAnimation } from "./SpriteAnimation";
import { BattleScriptAnimation } from "./BattleScriptAnimation";
import { getMoveEffectConfig, type MoveEffectAnchor } from "./moveEffectConfig";

export type EffectSide = "player" | "enemy" | "screen";

export type BattleEffect = {
    id: string;          // key 용
    side: EffectSide;    // 어느 쪽에서 터지는지 (기본: 타겟 쪽)
    moveId: string;      // 무브 id
};

type Props = {
    effect: BattleEffect | null;
    onEffectEnd?: () => void;
};

function getDefaultAnchor(side: EffectSide): MoveEffectAnchor {
    if (side === "screen") return "screen";
    return "target";
}

export function BattleEffectLayer({ effect, onEffectEnd }: Props) {
    const cfg = effect ? getMoveEffectConfig(effect.moveId) : null;
    if (!effect || !cfg) return null;

    const anchor: MoveEffectAnchor =
        cfg.anchor ?? getDefaultAnchor(effect.side);

    const isScript = cfg.mode === "script";

    // 🔹 sheet 모드는 durationMs 기준으로 자동 종료
    useEffect(() => {
        if (!effect || !cfg || !onEffectEnd) return;
        if (cfg.mode === "script") return; // script는 내부 onComplete 사용

        const duration = cfg.durationMs ?? 800;
        const timer = window.setTimeout(() => onEffectEnd(), duration);
        return () => window.clearTimeout(timer);
    }, [effect?.id, cfg.mode, cfg.durationMs, onEffectEnd]);

    // 위치(대략 타겟 쪽)
    let justifyContent: "flex-start" | "center" | "flex-end" = "center";
    let alignItems: "flex-start" | "center" | "flex-end" = "center";

    if (anchor === "screen" || effect.side === "screen") {
        justifyContent = "center";
        alignItems = "center";
    } else if (effect.side === "player") {
        // 플레이어 기술 → 적 쪽(오른쪽 위쯤)
        justifyContent = "flex-end";
        alignItems = "flex-start";
    } else if (effect.side === "enemy") {
        // 적 기술 → 우리 쪽(왼쪽 아래쯤)
        justifyContent = "flex-start";
        alignItems = "flex-end";
    }

    const scale = cfg.scale ?? (isScript ? 3 : 1);

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                zIndex: 20,
                display: "flex",
                justifyContent,
                alignItems,
            }}
        >
            {cfg.mode === "script" ? (
                <BattleScriptAnimation
                    key={effect.id}
                    jsonUrl={cfg.jsonUrl}
                    imageUrlOverride={cfg.imageUrl}
                    fps={cfg.fps ?? 20}
                    loop={false}
                    style={{
                        transform: `scale(${scale})`,
                        transformOrigin: "center",
                    }}
                    onComplete={onEffectEnd}
                />
            ) : (
                <SpriteAnimation
                    key={effect.id}
                    jsonUrl={cfg.jsonUrl}
                    imageUrlOverride={cfg.imageUrl}
                    fps={cfg.fps ?? 24}
                    loop={false}
                    style={{
                        transform: `scale(${scale})`,
                        transformOrigin: "center",
                    }}
                />
            )}
        </div>
    );
}
