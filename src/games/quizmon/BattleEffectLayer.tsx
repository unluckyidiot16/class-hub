// src/games/quizmon/BattleEffectLayer.tsx
import { useEffect } from "react";
import { SpriteAnimation } from "./SpriteAnimation";
import { BattleScriptAnimation } from "./BattleScriptAnimation";
import { getMoveEffectConfig } from "./moveEffectConfig";

export type EffectSide = "player" | "enemy" | "screen";

export type BattleEffect = {
    id: string;
    side: EffectSide;   // 우리 턴이면 "player", 적 턴이면 "enemy"
    moveId: string;
};

type Props = {
    effect: BattleEffect | null;
    onEffectEnd?: () => void;
};

export function BattleEffectLayer({ effect, onEffectEnd }: Props) {
    const cfg = effect ? getMoveEffectConfig(effect.moveId) : null;
    if (!effect || !cfg) return null;

    const isScript = cfg.mode === "script";

    // 🔹 script 이펙트는 기본 3배, sheet는 1배
    const scale = cfg.scale ?? (isScript ? 3 : 1);
    const fps = cfg.fps ?? (isScript ? 8 : 24);

    // 🔹 sheet 모드만 durationMs 기준으로 자동 종료
    useEffect(() => {
        if (!effect || !cfg || !onEffectEnd) return;
        if (cfg.mode === "script") return; // script는 내부 onComplete 사용

        const duration = cfg.durationMs ?? 800;
        const t = window.setTimeout(() => onEffectEnd(), duration);
        return () => window.clearTimeout(t);
    }, [effect?.id, cfg, onEffectEnd]);
    
    
    const anchorStyle: React.CSSProperties = (() => {
        if (effect.side === "screen") {
            return {
                position: "absolute",
                left: "50%",
                top: "45%",
                transform: "translate(-50%, -50%)",
            };
        }
   
        return {
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
        };
    })();

    return (
        <div
            style={{
                position: "absolute",
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                pointerEvents: "none",
                zIndex: 999, // 🔹 스프라이트/HP바보다 확실히 위
            }}
        >
            <div style={anchorStyle}>
                {isScript ? (
                    <BattleScriptAnimation
                        key={effect.id}
                        jsonUrl={cfg.jsonUrl}
                        imageUrlOverride={cfg.imageUrl}
                        fps={fps}
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
                        fps={fps}
                        loop={false}
                        style={{
                            transform: `scale(${scale})`,
                            transformOrigin: "center",
                        }}
                    />
                )}
            </div>
        </div>
    );
}
