// src/games/quizmon/BattleScriptAnimation.tsx
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import type { BattleScriptJson, ScriptLayer } from "./battleScriptTypes";
import {EFFECT_SHEETS, type EffectSheetConfig} from "./battleEffectSheets";

const BASE_URL = (import.meta as any).env?.BASE_URL ?? "/";
const EFFECT_BASE = `${BASE_URL}games/quizmon/effects/`;

export type BattleScriptAnimationProps = {
    jsonUrl: string;           // battle-anims/xxx.json or effects/xxx.json
    imageUrlOverride?: string; // effectPaths에서 내려오는 PNG 경로
    layerIndex?: number;       // 기본 0: 첫 레이어
    fps?: number;
    loop?: boolean;
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

    // 🔹 JSON 로드
    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setError(null);
                setData(null);
                setFrameIndex(0);

                const res = await fetch(jsonUrl);
                if (!res.ok) {
                    throw new Error(
                        `Failed to load battle script: ${res.status}`,
                    );
                }

                const raw = await res.json();

                // PokéRogue 원본은 ScriptLayer 하나짜리 object인 경우도 있어서 보정
                const normalized: BattleScriptJson = Array.isArray(raw)
                    ? (raw as BattleScriptJson)
                    : ([raw as ScriptLayer] as BattleScriptJson);

                if (!cancelled) {
                    setData(normalized);
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

    // 🔹 레이어 선택
    const layer: ScriptLayer | null = useMemo(() => {
        if (!data || !data.length) return null;
        const idx = Math.max(
            0,
            Math.min(layerIndex, (data as BattleScriptJson).length - 1),
        );
        return (data as BattleScriptJson)[idx];
    }, [data, layerIndex]);

    const frames = layer?.frames ?? [];

    // 🔹 프레임 타이머
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

    if (error || !layer || !frames.length) {
        return null;
    }


    // 🔹 시트 설정: EFFECT_SHEETS → override → fallback 순서
    const preConfig = EFFECT_SHEETS[layer.graphic];

    const sheet: EffectSheetConfig =
        preConfig ??
        {
            imageUrl:
                imageUrlOverride ??
                `${EFFECT_BASE}${encodeURIComponent(layer.graphic)}.png`,
            frameWidth: 80,
            frameHeight: 64,
        };

    if (!preConfig && !imageUrlOverride) {
        console.warn(
            "[BattleScriptAnimation] fallback sheet for graphic:",
            layer.graphic,
            "→",
            sheet.imageUrl,
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

                const frameX = (s.graphicFrame ?? 0) * sheet.frameWidth;

                return (
                    <div
                        key={idx}
                        style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            width: `${sheet.frameWidth}px`,
                            height: `${sheet.frameHeight}px`,
                            transform: `translate(${s.x}px, ${
                                s.y
                            }px) scale(${(s.zoomX ?? 100) / 100}, ${
                                (s.zoomY ?? 100) / 100
                            })`,
                            transformOrigin: "center",
                            opacity: (s.opacity ?? 255) / 255,
                            backgroundImage: `url(${sheet.imageUrl})`,
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
