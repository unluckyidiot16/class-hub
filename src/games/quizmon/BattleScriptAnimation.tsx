// src/games/quizmon/BattleScriptAnimation.tsx
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import type { BattleScriptJson, ScriptLayer } from "./battleScriptTypes";
import { EFFECT_SHEETS } from "./battleEffectSheets";

export type BattleScriptAnimationProps = {
    jsonUrl: string;          // battle-anims/xxx.json 또는 effects/xxx.json
    imageUrlOverride?: string; // effectPaths.ts 에서 내려오는 png 경로
    layerIndex?: number;      // 기본 0: 첫 레이어만 사용
    fps?: number;
    loop?: boolean;           // 대부분 false로 쓸 듯
    style?: React.CSSProperties;
    className?: string;
    onComplete?: () => void;
};

export function BattleScriptAnimation({
                                          jsonUrl,
                                          imageUrlOverride,
                                          layerIndex = 0,
                                          fps = 20,
                                          loop = false,
                                          style,
                                          className,
                                          onComplete,
                                      }: BattleScriptAnimationProps) {
    const [data, setData] = useState<BattleScriptJson | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [frameIndex, setFrameIndex] = useState(0);

    // JSON 로드
    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setError(null);
                setData(null);
                setFrameIndex(0);

                const res = await fetch(jsonUrl);
                if (!res.ok) {
                    throw new Error(`Failed to load battle script: ${res.status}`);
                }

                const json = (await res.json()) as BattleScriptJson;
                if (!cancelled) {
                    setData(json);
                }
            } catch (e: any) {
                if (!cancelled) {
                    console.error("[BattleScriptAnimation] load error", e);
                    setError(e?.message ?? "failed to load battle script");
                }
            }
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, [jsonUrl]);

    const layer: ScriptLayer | null = useMemo(() => {
        if (!data || !Array.isArray(data) || data.length === 0) return null;
        return data[Math.min(layerIndex, data.length - 1)];
    }, [data, layerIndex]);

    const frames = layer?.frames ?? [];

    // 타이머
    useEffect(() => {
        if (!frames.length || fps <= 0) return;

        setFrameIndex(0);
        const intervalMs = 1000 / fps;
        let stopped = false;

        const id = window.setInterval(() => {
            setFrameIndex((prev) => {
                if (stopped) return prev;
                const next = prev + 1;

                if (next >= frames.length) {
                    if (!loop) {
                        stopped = true;
                        onComplete?.();
                        return prev;
                    }
                    return 0;
                }

                return next;
            });
        }, intervalMs);

        return () => {
            stopped = true;
            window.clearInterval(id);
        };
    }, [frames, fps, loop, onComplete]);

    if (error || !layer || !frames.length) return null;

    // 🔹 우선 EFFECT_SHEETS에서 찾고, 없으면 imageUrlOverride / 기본 경로 사용
    const preConfig = EFFECT_SHEETS[layer.graphic];

    const sheet = preConfig ?? {
        imageUrl:
            imageUrlOverride ??
            `/games/quizmon/effects/${encodeURIComponent(layer.graphic)}.png`,
        frameWidth: 64,
        frameHeight: 64,
    };

    if (!preConfig && !imageUrlOverride) {
        // 개발용 경고 (경로 자동 추측 중)
        console.warn(
            "[BattleScriptAnimation] using fallback sheet for graphic:",
            layer.graphic,
        );
    }

    const sprites = frames[Math.min(frameIndex, frames.length - 1)] ?? [];

    return (
        <div
            className={className}
            style={{
                position: "relative",
                pointerEvents: "none",
                ...style,
            }}
        >
            {sprites.map((s, idx) => {
                if (!s.visible) return null;

                const { frameWidth, frameHeight, imageUrl } = sheet;
                const frameX = (s.graphicFrame ?? 0) * frameWidth;

                return (
                    <div
                        key={idx}
                        style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            width: `${frameWidth}px`,
                            height: `${frameHeight}px`,
                            transform: `translate(${s.x}px, ${s.y}px) scale(${(s.zoomX ?? 100) / 100}, ${
                                (s.zoomY ?? 100) / 100
                            })`,
                            transformOrigin: "center",
                            backgroundImage: `url(${imageUrl})`,
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: `-${frameX}px 0px`,
                            imageRendering: "pixelated",
                        }}
                    />
                );
            })}
        </div>
    );
}
