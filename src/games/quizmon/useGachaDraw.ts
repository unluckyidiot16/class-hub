// src/games/quizmon/useGachaDraw.ts
import { useCallback, useState } from "react";
import type { QuizmonProfileRow } from "./types";
import { performSingleGachaDraw } from "./gacha";

// 가챠 비용 타입 (이미 gacha.ts 에 맞춰져 있으면 그대로 사용)
export type GachaCostType = "free" | "gems" ;

// UI에서 쓰기용 “가볍게 정리한 결과” 타입
export type GachaResultLite = {
    kind: "new" | "duplicate";
    species: {
        name: string;
        rarity: number;
    };
    starShardsGained: number;
};

type UseGachaDrawOptions = {
    profile: QuizmonProfileRow | null;
    onProfileUpdated?: (p: QuizmonProfileRow | null) => void;
};

type UseGachaDrawReturn = {
    drawing: boolean;
    error: string | null;
    pullGacha: (costType: GachaCostType) => Promise<void>;
    lastResult: GachaResultLite | null;
};

export function useGachaDraw(options: UseGachaDrawOptions): UseGachaDrawReturn {
    const { profile, onProfileUpdated } = options;

    const [drawing, setDrawing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<GachaResultLite | null>(null);

    const pullGacha = useCallback(
        async (costType: GachaCostType) => {
            if (!profile) {
                setError("플레이어 프로필이 없습니다.");
                return;
            }

            if (drawing) return; // double-click 방지

            setDrawing(true);
            setError(null);

            try {
                const { result, updatedProfile } = await performSingleGachaDraw({
                    profile,
                    costType,
                });

                // 프로필 재화/스탯 갱신
                if (onProfileUpdated && updatedProfile) {
                    onProfileUpdated(updatedProfile);
                }

                if (result) {
                    // UI에서 필요한 부분만 뽑아서 저장
                    setLastResult({
                        kind: result.kind,
                        species: {
                            name: result.species.name,
                            rarity: result.species.rarity,
                        },
                        starShardsGained: result.starShardsGained ?? 0,
                    });
                }
            } catch (e) {
                console.error("[useGachaDraw] pullGacha error", e);
                setError("가챠를 수행하는 중 오류가 발생했습니다.");
            } finally {
                setDrawing(false);
            }
        },
        [profile, drawing, onProfileUpdated],
    );

    return {
        drawing,
        error,
        pullGacha,
        lastResult,
    };
}
