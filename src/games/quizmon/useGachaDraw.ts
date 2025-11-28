// src/games/quizmon/useGachaDraw.ts
import { useCallback, useState } from "react";
import type { QuizmonProfileRow } from "./types";
import { performSingleGachaDraw, type GachaCostType } from "./gacha";

// UI에서 쓰기용 결과 타입은 그대로
export type GachaResultLite = {
    kind: "new" | "duplicate";
    speciesId: string;
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
    pullGacha: (costType?: GachaCostType) => Promise<void>;
    lastResult: GachaResultLite | null;
};

export function useGachaDraw(options: UseGachaDrawOptions): UseGachaDrawReturn {
    const { profile, onProfileUpdated } = options;

    const [drawing, setDrawing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<GachaResultLite | null>(null);

    const pullGacha = useCallback(
        async (costType: GachaCostType = "gems") => {
            if (!profile) {
                setError("플레이어 프로필이 없습니다.");
                return;
            }
            if (drawing) return;

            setDrawing(true);
            setError(null);

            try {
                const { result, updatedProfile } = await performSingleGachaDraw({
                    profile,
                    costType,
                });

                if (onProfileUpdated && updatedProfile) {
                    onProfileUpdated(updatedProfile);
                }

                if (result) {
                    setLastResult({
                        kind: result.kind,
                        speciesId: result.species.id,
                        species: {
                            name: result.species.name,
                            rarity: result.species.rarity ?? 1,
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
