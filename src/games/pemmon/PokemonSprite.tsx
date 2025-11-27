// src/games/pemmon/PokemonSprite.tsx
import type { Species } from "./pemmonTypes";

type PokemonSpriteProps = {
    species: Species;
    /** 한 변 길이(px). 카드/아이콘에서 고정 박스 크기 */
    size?: number;
    /** 둥근 아바타로 쓸지 여부 (기본: 사각 카드) */
    variant?: "card" | "avatar";
};

/**
 * 포켓몬 스프라이트 컴포넌트
 *
 * - PEM V2처럼 "정해진 박스(size)" 안에서만 그리기
 * - height 기반 스케일은 여기서 하지 않고,
 *   정말 크게 보여주고 싶은 곳(히어로/배너)에서만 부모가 직접 처리
 * - species.spriteUrl 이 있으면 우선 사용
 * - 없으면 PokeAPI official-artwork 로 fallback
 */
export function PokemonSprite({
                                  species,
                                  size = 96,
                                  variant = "card",
                              }: PokemonSpriteProps) {
    const url =
        species.spriteUrl ??
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${species.id}.png`;

    const roundedClass =
        variant === "avatar" ? "rounded-full" : "rounded-xl";

    return (
        <div
            className={`relative flex items-center justify-center ${roundedClass} overflow-hidden bg-white/0`}
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
