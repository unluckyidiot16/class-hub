import type React from "react";
import { useEffect, useMemo, useState } from "react";

type TexturePackerFrame = {
    filename: string;
    rotated: boolean;
    trimmed: boolean;
    sourceSize: { w: number; h: number };
    spriteSourceSize: { x: number; y: number; w: number; h: number };
    frame: { x: number; y: number; w: number; h: number };
};

type TexturePackerFrameWithoutName = Omit<TexturePackerFrame, "filename">;


type TexturePackerJson = {
    textures?: {
        image: string;
        frames: TexturePackerFrame[];
    }[];
    // 일부 포맷에서는 frames 가 최상위에 있을 수 있음
    frames?: TexturePackerFrame[] | Record<string, TexturePackerFrameWithoutName>;
};

function extractFramesFromJson(
    json: TexturePackerJson,
): { imageName: string | null; frames: TexturePackerFrame[] } {
    // 1) TexturePacker multipack 포맷 (지금 1f.json / 1b.json 이 이 형태)
    if (json.textures && Array.isArray(json.textures) && json.textures.length > 0) {
        const tex = json.textures[0];
        return {
            imageName: tex.image,
            frames: tex.frames ?? [],
        };
    }

    // 2) frames 가 배열로 바로 있는 포맷
    if (Array.isArray(json.frames)) {
        return { imageName: null, frames: json.frames };
    }

    // 3) frames 가 { "0001.png": { ... }, ... } 객체인 포맷
    if (json.frames && typeof json.frames === "object") {
        const obj = json.frames as Record<string, TexturePackerFrameWithoutName>;
        const arr: TexturePackerFrame[] = Object.entries(obj).map(
            ([filename, frame]) => ({
                filename,
                ...frame,
            }),
        );
        return { imageName: null, frames: arr };
    }

    return { imageName: null, frames: [] };
}

export type SpriteAnimationProps = {
    jsonUrl: string;
    imageUrlOverride?: string;
    frameFilter?: (frame: TexturePackerFrame, index: number) => boolean;
    fps?: number;
    loop?: boolean;
    className?: string;
    style?: React.CSSProperties;
};

export function SpriteAnimation(props: SpriteAnimationProps) {
    const {
        jsonUrl,
        imageUrlOverride,
        frameFilter,
        fps = 12,
        loop = true,
        className,
        style,
    } = props;

    const [sheet, setSheet] = useState<TexturePackerJson | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [frameIndex, setFrameIndex] = useState(0);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setError(null);
                setSheet(null);
                setFrameIndex(0);

                const res = await fetch(jsonUrl);
                if (!res.ok) {
                    throw new Error(`Failed to load sprite json: ${res.status}`);
                }
                const data = (await res.json()) as TexturePackerJson;
                if (!cancelled) {
                    setSheet(data);
                }
            } catch (e: any) {
                if (!cancelled) {
                    console.error("[SpriteAnimation] load error", e);
                    setError(e?.message ?? "failed to load sprite json");
                }
            }
        }

        void load();

        return () => {
            cancelled = true;
        };
    }, [jsonUrl]);

    const { imageUrl, frames } = useMemo(() => {
        if (!sheet) {
            return { imageUrl: "", frames: [] as TexturePackerFrame[] };
        }
        const { imageName, frames } = extractFramesFromJson(sheet);

        const filtered = frameFilter
            ? frames.filter((f, idx) => frameFilter(f, idx))
            : frames;

        // filename 기준 정렬 (0001.png ~ 0102.png)
        const sorted = [...filtered].sort((a, b) =>
            a.filename.localeCompare(b.filename),
        );

        let finalImageUrl = imageUrlOverride ?? "";
        if (!finalImageUrl && imageName) {
            const basePath = jsonUrl.replace(/[^/]+$/, "");
            finalImageUrl = `${basePath}${imageName}`;
        }

        return { imageUrl: finalImageUrl, frames: sorted };
    }, [sheet, jsonUrl, imageUrlOverride, frameFilter]);

    // 애니메이션 타이머
    useEffect(() => {
        if (!frames.length || fps <= 0) return;

        const intervalMs = 1000 / fps;

        const id = window.setInterval(() => {
            setFrameIndex((prev) => {
                const next = prev + 1;
                if (next >= frames.length) {
                    return loop ? 0 : prev;
                }
                return next;
            });
        }, intervalMs);

        return () => {
            window.clearInterval(id);
        };
    }, [frames.length, fps, loop]);

    if (error) {
        return null;
    }
    if (!frames.length || !imageUrl) {
        return null;
    }

    const current = frames[Math.min(frameIndex, frames.length - 1)];
    const { x, y, w, h } = current.frame;

    const baseStyle: React.CSSProperties = {
        width: w,
        height: h,
        backgroundImage: `url(${imageUrl})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: `-${x}px -${y}px`,
        imageRendering: "pixelated",
    };

    return (
        <div
            className={className}
            style={{
                ...baseStyle,
                ...style,
            }}
        />
    );
}
