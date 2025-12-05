// src/games/quizmon/CaptureBallSprite.tsx
import { useEffect, useState } from "react";
import {
    getCaptureBallSprite,
    type CaptureBallSpriteState,
} from "./assets";

export type CaptureBallPhase = "idle" | "open" | "close";

export type CaptureBallSpriteProps = {
    phase: CaptureBallPhase;          // "open" → 열기 애니메이션, "close" → 닫기(역재생)
    size?: number;                    // px, 기본 32
    className?: string;
    style?: React.CSSProperties;
    onAnimationEnd?: () => void;      // 한 번 열기/닫기 애니메이션 끝났을 때 콜백
};

export function CaptureBallSprite(props: CaptureBallSpriteProps) {
    const {
        phase,
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

    const src = getCaptureBallSprite(frame);

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
