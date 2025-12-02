// src/games/quizmon/elementUtils.ts
import type { ElementType } from "./types";

export type ElementKey = ElementType;

/**
 * 속성 키 → UI에서 쓸 라벨/색상 매핑
 * 도감 / 전투 / 태그 배지에서 공용으로 사용
 */
const ELEMENT_LABEL_MAP: Record<ElementKey, { label: string; color: string }> = {
    normal:  { label: "노말",   color: "#e5e7eb" },
    fire:    { label: "불꽃",   color: "#f97316" },
    water:   { label: "물",     color: "#38bdf8" },
    grass:   { label: "풀",     color: "#4ade80" },
    electric:{ label: "전기",   color: "#facc15" },
    ice:     { label: "얼음",   color: "#a5f3fc" },
    fighting:{ label: "격투",   color: "#f97373" },
    poison:  { label: "독",     color: "#a855f7" },
    ground:  { label: "땅",     color: "#fed7aa" },
    flying:  { label: "비행",   color: "#bfdbfe" },
    psychic: { label: "에스퍼", color: "#fb7185" },
    bug:     { label: "벌레",   color: "#a3e635" },
    rock:    { label: "바위",   color: "#fbbf24" },
    ghost:   { label: "고스트", color: "#a855f7" },
    dragon:  { label: "드래곤", color: "#60a5fa" },
    dark:    { label: "악",     color: "#4b5563" },
    steel:   { label: "강철",   color: "#9ca3af" },
    fairy:   { label: "페어리", color: "#f9a8d4" },
};

export function getElementLabelAndColor(
    element: string | null | undefined,
): { label: string; color: string } {
    const key = (element ?? "normal") as ElementKey;
    return ELEMENT_LABEL_MAP[key] ?? ELEMENT_LABEL_MAP.normal;
}

/**
 * 타입 상성표
 * - 키가 없는 조합은 1배로 처리
 * - 값: 0, 0.5, 1, 2
 */
const TYPE_CHART: Record<ElementKey, Partial<Record<ElementKey, number>>> = {
    normal: { rock: 0.5, steel: 0.5, ghost: 0 },
    fire: {
        grass: 2,
        ice: 2,
        bug: 2,
        steel: 2,
        fire: 0.5,
        water: 0.5,
        rock: 0.5,
        dragon: 0.5,
    },
    water: {
        fire: 2,
        ground: 2,
        rock: 2,
        water: 0.5,
        grass: 0.5,
        dragon: 0.5,
    },
    electric: {
        water: 2,
        flying: 2,
        electric: 0.5,
        grass: 0.5,
        dragon: 0.5,
        ground: 0,
    },
    grass: {
        water: 2,
        ground: 2,
        rock: 2,
        fire: 0.5,
        grass: 0.5,
        poison: 0.5,
        flying: 0.5,
        bug: 0.5,
        dragon: 0.5,
        steel: 0.5,
    },
    ice: {
        grass: 2,
        ground: 2,
        flying: 2,
        dragon: 2,
        fire: 0.5,
        water: 0.5,
        ice: 0.5,
        steel: 0.5,
    },
    fighting: {
        normal: 2,
        ice: 2,
        rock: 2,
        dark: 2,
        steel: 2,
        poison: 0.5,
        flying: 0.5,
        psychic: 0.5,
        bug: 0.5,
        fairy: 0.5,
        ghost: 0,
    },
    poison: {
        grass: 2,
        fairy: 2,
        poison: 0.5,
        ground: 0.5,
        rock: 0.5,
        ghost: 0.5,
        steel: 0,
    },
    ground: {
        fire: 2,
        electric: 2,
        poison: 2,
        rock: 2,
        steel: 2,
        grass: 0.5,
        bug: 0.5,
        flying: 0,
    },
    flying: {
        grass: 2,
        fighting: 2,
        bug: 2,
        electric: 0.5,
        rock: 0.5,
        steel: 0.5,
    },
    psychic: {
        fighting: 2,
        poison: 2,
        psychic: 0.5,
        steel: 0.5,
        dark: 0,
    },
    bug: {
        grass: 2,
        psychic: 2,
        dark: 2,
        fire: 0.5,
        fighting: 0.5,
        poison: 0.5,
        flying: 0.5,
        ghost: 0.5,
        steel: 0.5,
        fairy: 0.5,
    },
    rock: {
        fire: 2,
        ice: 2,
        flying: 2,
        bug: 2,
        fighting: 0.5,
        ground: 0.5,
        steel: 0.5,
    },
    ghost: {
        psychic: 2,
        ghost: 2,
        dark: 0.5,
        normal: 0,
    },
    dragon: {
        dragon: 2,
        steel: 0.5,
        fairy: 0,
    },
    dark: {
        psychic: 2,
        ghost: 2,
        fighting: 0.5,
        dark: 0.5,
        fairy: 0.5,
    },
    steel: {
        ice: 2,
        rock: 2,
        fairy: 2,
        fire: 0.5,
        water: 0.5,
        electric: 0.5,
        steel: 0.5,
    },
    fairy: {
        fighting: 2,
        dragon: 2,
        dark: 2,
        fire: 0.5,
        poison: 0.5,
        steel: 0.5,
    },
};

/**
 * 공격 타입 & 방어 타입들 → 상성 배율 계산
 *
 * @param attackType 공격 기술의 타입
 * @param defenderTypes 방어 측의 1차/2차 타입 배열
 */
export function getTypeEffectiveness(
    attackType: string | null | undefined,
    defenderTypes: (string | null | undefined)[],
): number {
    if (!attackType || !defenderTypes || defenderTypes.length === 0) {
        return 1;
    }

    const atk = attackType as ElementKey;
    const row = TYPE_CHART[atk];
    if (!row) return 1;

    return defenderTypes.reduce((multiplier, defRaw) => {
        if (!defRaw) return multiplier;
        const def = defRaw as ElementKey;
        const v = row[def];
        return multiplier * (typeof v === "number" ? v : 1);
    }, 1);
}
