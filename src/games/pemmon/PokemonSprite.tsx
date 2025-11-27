// src/games/pemmon/PokemonSprite.tsx
import type { Species } from "./pemmonTypes";
import { getScaleForSpecies } from "./scaleUtils";

type PokemonSpriteProps = {
    species: Species;
    /** 박스 한 변 길이 (px) */
    size?: number;
    /** 배경/모서리 스타일 */
    variant?: "card" | "avatar";
};

/**
 * 포켓몬 하나를 "키(height)"에 따라 자동 스케일링해서 그려주는 컴포넌트
 *
 * - species.spriteUrl 이 있으면 그 URL 사용
 * - 없으면 PokeAPI 공식 아트(official-artwork)로 fallback
 * - 바깥 박스는 고정 크기 + overflow-hidden 으로 카드 밖으로 안 튀어나가게 처리
 * - variant:
 *    - "card"   : 사각형 카드용 (도감 리스트 등)
 *    - "avatar" : 둥근 아바타용 (상단 파트너 프로필)
 */
export function PokemonSprite({
                                  species,
                                  size = 72,
                                  variant = "card",
                              }: PokemonSpriteProps) {
    // 1) 키 기반 스케일 계산 (getScaleForSpecies는 1m 기준으로 비율을 돌려줌)
    let scale = getScaleForSpecies(species);

    // 너무 극단적인 값 방지용 클램프
    if (scale < 0.7) scale = 0.7;
    if (scale > 1.15) scale = 1.15;

    // 2) 스프라이트 URL
    const url =
        species.spriteUrl ??
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${species.id}.png`;

    // 3) 배경/모서리 스타일
    const baseClass =
        variant === "avatar"
            ? "relative flex items-center justify-center rounded-full overflow-hidden"
            : "relative flex items-center justify-center rounded-xl overflow-hidden bg-slate-900/5";

    return (
        <div
            className={baseClass}
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
                    className="block max-h-full w-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)]"
                    loading="lazy"
                />
            </div>
        </div>
    );
}
