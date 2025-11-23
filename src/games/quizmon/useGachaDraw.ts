// src/games/quizmon/useGachaDraw.ts
import { useCallback, useState } from "react";
import type { QuizmonProfileRow } from "./types";
import type { GachaCostType, GachaDrawResult } from "./gacha";
import { performSingleGachaDraw } from "./gacha";

type UseGachaDrawOptions = {
    profile: QuizmonProfileRow | null;
    onProfileUpdated?: (profile: QuizmonProfileRow) => void;
};

type UseGachaDrawResult = {
    drawing: boolean;
    error: string | null;
    lastResult: GachaDrawResult | null;

    // 기본은 gacha_gems 1개 소비, free 모드는 인자로 "free" 전달
    pullGacha: (costType?: GachaCostType) => Promise<GachaDrawResult | null>;
};

export function useGachaDraw(
    options: UseGachaDrawOptions,
): UseGachaDrawResult {
    const { profile, onProfileUpdated } = options;

    const [drawing, setDrawing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<GachaDrawResult | null>(null);

    const pullGacha = useCallback(
        async (costType: GachaCostType = "gems") => {
            if (!profile) {
                setError("프로필 정보를 먼저 불러와 주세요.");
                return null;
            }
            if (drawing) {
                // 중복 클릭 방지
                return null;
            }

            setDrawing(true);
            setError(null);

            try {
                const { result, updatedProfile } =
                    await performSingleGachaDraw({ profile, costType });

                setLastResult(result);
                onProfileUpdated?.(updatedProfile);
                return result;
            } catch (e: any) {
                console.error("[useGachaDraw] pullGacha error", e);
                setError(e?.message ?? "소환 중 오류가 발생했습니다.");
                return null;
            } finally {
                setDrawing(false);
            }
        },
        [profile, drawing, onProfileUpdated],
    );

    return {
        drawing,
        error,
        lastResult,
        pullGacha,
    };
}
