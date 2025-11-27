// src/games/pemmon/PokemonSprite.tsx
import { useState } from "react";
import type { Species } from "./pemmonTypes";
import { getScaleForSpecies } from "./scaleUtils";

type PokemonSpriteProps = {
    species: Species;
    /** 기본 96px, 화면에 따라 조절 */
    size?: number;
};

/**
 * 포켓몬 하나를 "키(height)"에 따라 자동 스케일링해서 그려주는 컴포넌트
 * - species.spriteUrl 있으면 그 URL 사용
 * - 없으면 PokeAPI 기본 스프라이트로 fallback
 * - 이미지 로딩 실패 시 ⭐ 이모지로 폴백
 */
export function PokemonSprite({ species, size = 96 }: PokemonSpriteProps) {
    const [hasError, setHasError] = useState(false);

    const scale = getScaleForSpecies(species);

    // 1) JSON에 들어있는 spriteUrl 우선
    // 2) 없으면 PokeAPI 공식 아트워크 URL로 폴백
    const url =
        species.spriteUrl ??
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${species.id}.png`;

    const heightMeters = (species.height ?? 10) / 10;

    return (
        <div
            className="relative flex items-end justify-center bg-slate-900/5 rounded-lg border border-slate-200/60"
            style={{
                width: `${size}px`,
                height: `${size}px`,
                transformOrigin: "bottom center",
                transform: `scale(${scale})`,
            }}
            title={`${species.name} (키 ${heightMeters.toFixed(1)}m)`}
        >
            {!hasError ? (
                <img
                    src={url}
                    alt={species.name}
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 max-h-full"
                    loading="lazy"
                    onError={() => {
                        console.warn(
                            "[PokemonSprite] 이미지 로딩 실패:",
                            species.id,
                            url,
                        );
                        setHasError(true);
                    }}
                />
            ) : (
                // 이미지가 막히거나 404일 때는 이모지로 폴백
                <div className="w-full h-full flex items-center justify-center text-xl">
                    ⭐
                </div>
            )}
        </div>
    );
}
