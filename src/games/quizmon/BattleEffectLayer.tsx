// src/games/quizmon/BattleEffectLayer.tsx
import { useEffect } from "react";
import { SpriteAnimation } from "./SpriteAnimation";
import { BattleScriptAnimation } from "./BattleScriptAnimation";
import {
    getMoveEffectConfig,
    type MoveEffectAnchor,
} from "./moveEffectConfig";

export type EffectSide = "player" | "enemy" | "screen";

export type BattleEffect = {
    id: string;       // key 용
    side: EffectSide; // 어느 쪽에서 터지는지 (기본: 타겟 쪽)
    moveId: string;   // 무브 id
};

type Props = {
    effect: BattleEffect | null;
    onEffectEnd?: () => void;
};

// side 기준 기본 anchor 추론
function getDefaultAnchor(side: EffectSide): MoveEffectAnchor {
    if (side === "screen") return "screen";
    // 플레이어 기술이면 보통 상대(타겟) 쪽에, 적 기술이면 우리(타겟) 쪽에
    return "target";
}

export function BattleEffectLayer(props: Props) {
    const { effect, onEffectEnd } = props;

    const cfg = effect ? getMoveEffectConfig(effect.moveId) : null;
    if (!effect || !cfg) {
        return null;
    }

    const anchor: MoveEffectAnchor =
        cfg.anchor ?? getDefaultAnchor(effect.side);

    // sheet 모드일 때는 durationMs 기준으로 onEffectEnd 호출
    useEffect(() => {
        if (!effect || !cfg || !onEffectEnd) return;
        if (cfg.mode === "script") {
            // script 모드는 BattleScriptAnimation 의 onComplete 에서 처리
            return;
        }

        const duration = cfg.durationMs ?? 800; // 기본 0.8초 정도
        const timer = window.setTimeout(() => {
            onEffectEnd();
        }, duration);

        return () => window.clearTimeout(timer);
    }, [effect?.id, cfg.mode, cfg.durationMs, onEffectEnd]);

    // 위치 정렬 (대략적인 기준값 – 필요하면 여기서 튜닝)
    let justifyContent: "flex-start" | "center" | "flex-end" = "center";
    let alignItems: "flex-start" | "center" | "flex-end" = "center";

    if (anchor === "screen") {
        justifyContent = "center";
        alignItems = "center";
    } else if (anchor === "caster") {
        // 시전자 기준
        if (effect.side === "player") {
            justifyContent = "flex-start";
            alignItems = "flex-end";
        } else if (effect.side === "enemy") {
            justifyContent = "flex-end";
            alignItems = "flex-start";
        }
    } else {
        // anchor === "target"
        if (effect.side === "player") {
            // 플레이어 기술 → 적 쪽에 맞게
            justifyContent = "flex-end";
            alignItems = "flex-start";
        } else if (effect.side === "enemy") {
            // 적 기술 → 우리 쪽에 맞게
            justifyContent = "flex-start";
            alignItems = "flex-end";
        }
    }

    const scale = cfg.scale ?? 1;

    const content =
        cfg.mode === "script" ? (
            <BattleScriptAnimation
                key={effect.id}
                jsonUrl={cfg.jsonUrl}
                fps={cfg.fps ?? 24}
                loop={false}
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin: "center",
                }}
                onComplete={onEffectEnd}
            />
        ) : (
            <SpriteAnimation
                key={effect.id} // 매번 새로 재생되게
                jsonUrl={cfg.jsonUrl}
                imageUrlOverride={cfg.imageUrl}
                fps={cfg.fps ?? 24}
                loop={false}
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin: "center",
                }}
            />
        );

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                display: "flex",
                justifyContent,
                alignItems,
                zIndex: 20,
            }}
        >
            {content}
        </div>
    );
}
