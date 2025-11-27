// src/games/pemmon/PokemonSprite.tsx
import type { Species } from "./pemmonTypes";
import { getScaleForSpecies } from "./scaleUtils";

type PokemonSpriteProps = {
    species: Species;
    /** 기본 80px, 화면에 따라 조절 */
    size?: number;
};

/**
 * 포켓몬 하나를 "키(height)"에 따라 자동 스케일링해서 그려주는 컴포넌트
 * - species.spriteUrl 있으면 그 URL 사용
 * - 없으면 PokeAPI 기본 스프라이트로 fallback
 * - 바깥 박스는 고정 크기 + overflow-hidden 으로 카드 밖으로 안 튀어나가게 처리
 */
export function PokemonSprite({ species, size = 80 }: PokemonSpriteProps) {
    const scale = getScaleForSpecies(species);

    const url =
        species.spriteUrl ??
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${species.id}.png`;

    return (
        <div
            className="relative flex items-end justify-center bg-slate-900/10 rounded-xl overflow-hidden"
            style={{
                width: `${size}px`,
                height: `${size}px`,
            }}
        >
            {/* 스케일은 안쪽 래퍼에만 적용 */}
            <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2"
                style={{
                    transformOrigin: "bottom center",
                    transform: `scale(${scale})`,
                }}
            >
                <img
                    src={url}
                    alt={species.name}
                    className="block h-[110%] w-auto max-w-none"
                    loading="lazy"
                />
            </div>
        </div>
    );
}
