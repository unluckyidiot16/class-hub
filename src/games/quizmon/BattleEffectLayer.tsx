// src/games/quizmon/BattleEffectLayer.tsx
import { useEffect } from "react";
import { SpriteAnimation } from "./SpriteAnimation";
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

    // 2) caster / target 기준으로 실제 위치가 될 side 결정
    // - effect.side 는 "타겟" 쪽이라고 가정
    // - anchor === "caster" 이면 반대편에서 터지도록 뒤집기
    let targetSide: EffectSide = side;
    if (anchor === "caster") {
        if (side === "player") targetSide = "enemy";
        else if (side === "enemy") targetSide = "player";
    }

    // 3) 최종 위치
    if (targetSide === "player") {
        // 플레이어 스프라이트 근처 (좌측 하단)
        return {
            position: "absolute" as const,
            left: "12%",
            bottom: "30%",
            transform: "translate(-10%, 0)",
        };
    }

    // enemy (우측 상단 근처)
    return {
        position: "absolute" as const,
        right: "12%",
        top: "16%",
        transform: "translate(10%, 0)",
    };
}

export function BattleEffectLayer({ effect, onEffectEnd }: Props) {
    // 🔹 설정 lookup
    const cfg = effect ? getMoveEffectConfig(effect.moveId) : null;
    const durationMs = cfg?.durationMs ?? 700; // 대충 0.7초 기본

    // 🔹 일정 시간 후 onEffectEnd 호출 (effect.id 기준으로 리셋)
    useEffect(() => {
        if (!effect || !cfg || !onEffectEnd) return;

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
                <SpriteAnimation
                    key={effect.id}            // 매번 새로 재생되게
                    jsonUrl={cfg.jsonUrl}
                    imageUrlOverride={cfg.imageUrl}
                    fps={cfg.fps ?? 24}
                    loop={false}
                    style={{
                        transform: `scale(${cfg.scale ?? 1})`,
                        transformOrigin: "center",
                    }}
                />
            </div>
        </div>
    );
}
