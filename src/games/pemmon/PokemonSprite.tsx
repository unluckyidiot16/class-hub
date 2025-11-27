// src/games/pemmon/PokemonSprite.tsx
import type { Species } from "./pemmonTypes";

type PokemonSpriteProps = {
    species: Species;
    /** 표시 박스 한 변 길이 (px). 기본 96 */
    size?: number;
    /** 추가로 Tailwind 클래스를 주고 싶을 때 */
    className?: string;
};

/**
 * 포켓몬 스프라이트 (height 스케일링 잠시 OFF 버전)
 *
 * - 주어진 size × size 박스 안에서만 object-contain 으로 그립니다.
 * - species.spriteUrl 이 있으면 우선 사용,
 *   없으면 PokeAPI official-artwork 로 fallback 합니다.
 * - transform / scale 은 전혀 사용하지 않습니다.
 */
export function PokemonSprite({
                                  species,
                                  size = 96,
                                  className = "",
                              }: PokemonSpriteProps) {
    const url =
        species.spriteUrl ??
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${species.id}.png`;

    return (
        <div
            className={
                "relative flex items-center justify-center overflow-hidden " +
                className
            }
            style={{
                width: `${size}px`,
                height: `${size}px`,
            }}
        >
            <img
                src={url}
                alt={species.name}
                loading="lazy"
                className="max-w-full max-h-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)]"
            />
        </div>
    );
}
