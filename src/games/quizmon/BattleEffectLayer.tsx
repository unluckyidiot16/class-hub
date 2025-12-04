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

/**
 * anchor + side를 기준으로 이펙트 기준 위치를 계산
 */
function getAnchorStyle(
    side: EffectSide,
    anchor: MoveEffectAnchor | undefined,
) {
    // 1) 화면 전체 연출
    if (anchor === "screen" || side === "screen") {
        return {
            position: "absolute" as const,
            left: "50%",
            top: "40%",
            transform: "translate(-50%, -50%)",
        };
    }

    // 2) 기본: 플레이어/적 쪽 대략적인 위치
    if (side === "player") {
        return {
            position: "absolute" as const,
            left: "30%",
            bottom: "35%",
            transform: "translate(-50%, 0)",
        };
    }

    if (side === "enemy") {
        return {
            position: "absolute" as const,
            right: "25%",
            top: "25%",
            transform: "translate(50%, 0)",
        };
    }

    // fallback
    return {
        position: "absolute" as const,
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
    };
}

export function BattleEffectLayer({ effect, onEffectEnd }: Props) {
    // 🔹 설정 lookup
    const cfg = effect ? getMoveEffectConfig(effect.moveId) : null;
    const durationMs = cfg?.durationMs ?? 700; // sheet 모드 기본 0.7초

    // 🔹 sheet 모드일 때만 타이머로 종료 처리
    useEffect(() => {
        if (!effect || !cfg || !onEffectEnd) return;
        if (cfg.mode === "script") return; // script는 내부 onComplete 에서 처리

        const t = window.setTimeout(() => {
            onEffectEnd();
        }, durationMs);

        return () => {
            window.clearTimeout(t);
        };
    }, [effect?.id, cfg, durationMs, onEffectEnd]);

    if (!effect || !cfg) return null;

    const anchorStyle = getAnchorStyle(effect.side, cfg.anchor);

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                zIndex: 20, // 스프라이트(10) 위, UI(30) 아래
            }}
        >
            <div style={anchorStyle}>
                {cfg.mode === "script" ? (
                    <BattleScriptAnimation
                        key={effect.id}
                        jsonUrl={cfg.jsonUrl}
                        imageUrlOverride={cfg.imageUrl}
                        fps={cfg.fps ?? 20}
                        loop={false}
                        style={{
                            transform: `scale(${cfg.scale ?? 1})`,
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
                            transform: `scale(${cfg.scale ?? 1})`,
                            transformOrigin: "center",
                        }}
                    />
                )}
            </div>
        </div>
    );
}
