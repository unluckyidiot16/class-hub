// src/games/pemmon/PokemonSprite.tsx
import type { Species } from "./pemmonTypes";
import { getScaleForSpecies } from "./scaleUtils";

type PokemonSpriteProps = {
    species: Species;
    /** 기본 72px, 화면에 따라 조절 */
    size?: number;
};

/**
 * 포켓몬 하나를 "키(height)"에 따라 자동 스케일링해서 그려주는 컴포넌트
 * - species.spriteUrl 있으면 그 URL 사용
 * - 없으면 PokeAPI 기본 스프라이트로 fallback
 * - 바깥 박스는 고정 크기 + overflow-hidden 으로 카드 밖으로 안 튀어나가게 처리
 */
export function PokemonSprite({ species, size = 72 }: PokemonSpriteProps) {
    // getScaleForSpecies가 0.7 ~ 1.4 사이를 돌려주는데,
    // 카드에서는 1보다 크게는 키우지 않고, 큰 포켓몬만 살짝 줄여주는 느낌으로 사용
    let scale = getScaleForSpecies(species);
    if (scale > 1) scale = 1;
    if (scale < 0.6) scale = 0.6;

    const url =
        species.spriteUrl ??
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${species.id}.png`;

    return (
        <div
            className="relative flex items-center justify-center bg-slate-900/10 rounded-xl overflow-hidden"
            style={{
                width: `${size}px`,
                height: `${size}px`,
            }}
        >
            {/* 안쪽 래퍼에만 스케일 적용 */}
            <div
                className="flex items-end justify-center w-full h-full"
                style={{
                    transformOrigin: "bottom center",
                    transform: `scale(${scale})`,
                }}
            >
                <img
                    src={url}
                    alt={species.name}
                    className="block max-h-full w-auto object-contain"
                    loading="lazy"
                />
            </div>
        </div>
    );
}
