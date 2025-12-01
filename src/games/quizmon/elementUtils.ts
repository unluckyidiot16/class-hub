// src/games/quizmon/elementUtils.ts

export type ElementKey =
    | "normal"
    | "fire"
    | "water"
    | "grass"
    | "electric";

/**
 * 속성 키 → UI에서 쓸 라벨/색상 매핑
 * 도감 / 전투 / 태그 배지에서 공용으로 사용
 */
export function getElementLabelAndColor(
    element: string | null | undefined,
): { label: string; color: string } {
    switch (element as ElementKey) {
        case "grass":
            return { label: "풀", color: "#4ade80" }; // 초록
        case "fire":
            return { label: "불꽃", color: "#f97316" }; // 주황
        case "water":
            return { label: "물", color: "#38bdf8" }; // 파랑
        case "electric":
            return { label: "전기", color: "#facc15" }; // 노랑
        case "normal":
        default:
            return { label: "노말", color: "#e5e7eb" }; // 연회색
    }
}
