// src/games/pemmon/PokemonSprite.tsx
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
 */
export function PokemonSprite({ species, size = 96 }: PokemonSpriteProps) {
    const scale = getScaleForSpecies(species);

    const url =
        species.spriteUrl ??
        // fallback: 공식 일러스트 → 없으면 기본 front 스프라이트
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${species.id}.png`;

    return (
        <div
            className="relative"
            style={{
                width: `${size}px`,
                height: `${size}px`,
                transformOrigin: "bottom center",
                transform: `scale(${scale})`,
            }}
        >
            <img
                src={url}
                alt={species.name}
                className="absolute bottom-0 left-1/2 -translate-x-1/2 max-h-full"
                loading="lazy"
            />
        </div>
    );
}
