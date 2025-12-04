// src/games/quizmon/useGachaDraw.ts
import { useCallback, useState } from "react";
import type { QuizmonProfileRow } from "./types";
import {
    performSingleGachaDraw,
    type GachaDrawResult,
} from "./gacha";

type UseGachaDrawOptions = {
    profile: QuizmonProfileRow | null;
    onProfileUpdated?: (profile: QuizmonProfileRow) => void;
    onDrawCompleted?: (result: GachaDrawResult) => void;
};

export function useGachaDraw(options: UseGachaDrawOptions) {
    const { profile, onProfileUpdated, onDrawCompleted } = options;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<GachaDrawResult | null>(null);

    const pullGacha = useCallback(async () => {
        if (!profile) {
            setError("프로필 정보를 찾을 수 없습니다.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { result, updatedProfile } =
                await performSingleGachaDraw({ profile });

            setLastResult(result);
            onProfileUpdated?.(updatedProfile);
            onDrawCompleted?.(result);
        } catch (e: any) {
            console.error("[useGachaDraw] pullGacha error", e);
            const msg =
                typeof e?.message === "string"
                    ? e.message
                    : "가챠를 수행하는 중 오류가 발생했습니다.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [profile, onProfileUpdated, onDrawCompleted]);

    return {
        pullGacha,
        loading,
        error,
        lastResult,
    };
}
