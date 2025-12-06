// src/games/quizmon/CaptureBallSprite.tsx
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
    getCaptureBallSprite,
    type CaptureBallSpriteState,
} from "./assets";

export type CaptureBallPhase = "idle" | "open" | "close";

// 🔹 볼 스킨 종류
export type CaptureBallVariant = "pokeball" | "greatball" | "ultraball";

export type CaptureBallSpriteProps = {     
    phase: CaptureBallPhase;          // "open" → 열기 애니메이션, "close" → 닫기(역재생)
    variant?: CaptureBallVariant;     // 기본 pokeball
    size?: number;                    // px, 기본 32
    className?: string;
    style?: CSSProperties;
    onAnimationEnd?: () => void;      // 한 번 열기/닫기 애니메이션 끝났을 때 콜백
};

// 기본 pb 스프라이트 경로를 variant에 맞게 치환
    function getVariantBallSprite(
    state: CaptureBallSpriteState,
        variant: CaptureBallVariant,
    ): string {
        const base = getCaptureBallSprite(state); // 예: .../pb.png, pb_open.png, pb_opening.png
    
            if (variant === "pokeball") return base;
    
            // 파일명에서 pb → gb(그레이트), ub(울트라)로 치환
                const prefix = variant === "greatball" ? "gb" : "ub";
    
            // 맨 끝 파일 이름만 안전하게 교체
                return base.replace(/pb(_opening|_open)?\.png$/, (match) =>
                    match.replace("pb", prefix),
            );
    }

export function CaptureBallSprite(props: CaptureBallSpriteProps) {
    const {
        phase,
        variant = "pokeball",
        size = 32,
        className,
        style,
        onAnimationEnd,
    } = props;

    
    const [frame, setFrame] = useState<CaptureBallSpriteState>("closed");

    useEffect(() => {
        let t1: number | null = null;
        let t2: number | null = null;

        // 항상 시작 전에 타이머 정리
        const clearTimers = () => {
            if (t1 !== null) window.clearTimeout(t1);
            if (t2 !== null) window.clearTimeout(t2);
        };

        clearTimers();

        if (phase === "idle") {
            setFrame("closed");
            return;
        }

        // 한 스텝당 딜레이 (필요하면 숫자만 바꿔서 속도 조절)
        const STEP = 90; // ms

        if (phase === "open") {
            // closed → opening → open
            setFrame("closed");
            t1 = window.setTimeout(() => {
                setFrame("opening");
            }, STEP);

            t2 = window.setTimeout(() => {
                setFrame("open");
                onAnimationEnd?.();
            }, STEP * 2);
        } else if (phase === "close") {
            // open → opening → closed (역재생)
            setFrame("open");
            t1 = window.setTimeout(() => {
                setFrame("opening");
            }, STEP);

            t2 = window.setTimeout(() => {
                setFrame("closed");
                onAnimationEnd?.();
            }, STEP * 2);
        }

        return () => {
            clearTimers();
        };
    }, [phase, onAnimationEnd]);
    
    const src = getVariantBallSprite(frame, variant);

    return (
        <img
            src={src}
            alt="Capture Ball"
            className={className}
            style={{
                width: size,
                height: size,
                imageRendering: "pixelated",
                pointerEvents: "none",
                ...style,
            }}
        />
    );
}
