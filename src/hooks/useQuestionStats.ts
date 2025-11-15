// src/hooks/useQuestionStats.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type ChoiceStat = {
    index: number;        // 보기 인덱스 (0,1,2,3...)
    count: number;        // 해당 보기 선택 인원 수
    correctCount: number; // 그 중 정답인 응답 수
};

export type QuestionStats = {
    totalAnswers: number;   // 전체 응답 수
    totalCorrect: number;   // 전체 정답 수
    choiceStats: ChoiceStat[];
};

/**
 * 특정 sessionId + questionId에 대한
 * - 전체 응답 수
 * - 정답 수
 * - 보기별 선택 수/정답 수
 * 를 주기적으로 다시 가져오는 훅
 */
export function useQuestionStats(
    sessionId?: string,
    questionId?: string,
    pollMs: number = 2000
) {
    const [stats, setStats] = useState<QuestionStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!sessionId || !questionId) return;

        let cancelled = false;
        let timer: number | undefined;

        const fetchStats = async () => {
            setLoading(true);
            setError(null);

            const { data, error } = await supabase
                .from("quiz_answers")
                .select("selected_index, is_correct")
                .eq("session_id", sessionId)
                .eq("question_id", questionId);

            if (error) {
                console.error("[useQuestionStats] error", error);
                if (!cancelled) {
                    setError(error.message);
                    setLoading(false);
                }
                return;
            }

            if (cancelled || !data) return;

            let totalAnswers = data.length;
            let totalCorrect = 0;

            const map = new Map<
                number,
                {
                    count: number;
                    correctCount: number;
                }
            >();

            for (const row of data as {
                selected_index: number | null;
                is_correct: boolean | null;
            }[]) {
                const idx = row.selected_index ?? 0;
                const bucket =
                    map.get(idx) ??
                    {
                        count: 0,
                        correctCount: 0,
                    };

                bucket.count += 1;
                if (row.is_correct) {
                    bucket.correctCount += 1;
                    totalCorrect += 1;
                }

                map.set(idx, bucket);
            }

            const choiceStats: ChoiceStat[] = Array.from(map.entries())
                .map(([index, v]) => ({
                    index,
                    count: v.count,
                    correctCount: v.correctCount,
                }))
                .sort((a, b) => a.index - b.index);

            if (!cancelled) {
                setStats({
                    totalAnswers,
                    totalCorrect,
                    choiceStats,
                });
                setLoading(false);
            }
        };

        // 최초 1회 + pollMs 간격으로 반복
        fetchStats();
        timer = window.setInterval(fetchStats, pollMs);

        return () => {
            cancelled = true;
            if (timer) window.clearInterval(timer);
        };
    }, [sessionId, questionId, pollMs]);

    return { stats, loading, error };
}
