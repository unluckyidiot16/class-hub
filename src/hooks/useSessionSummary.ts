// src/hooks/useSessionSummary.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type SessionQuestionSummary = {
    questionId: string;
    totalAnswers: number;
    totalCorrect: number;
};

export type SessionSummaryState = {
    questions: SessionQuestionSummary[];
};

export function useSessionSummary(
    sessionId?: string,
    pollMs: number = 5000
) {
    const [summary, setSummary] = useState<SessionSummaryState | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!sessionId) return;

        let cancelled = false;
        let timer: number | undefined;

        const fetchSummary = async () => {
            setLoading(true);
            setError(null);

            const { data, error } = await supabase
                .from("quiz_answers")
                .select("question_id, is_correct")
                .eq("session_id", sessionId);

            if (error) {
                console.error("[useSessionSummary] error", error);
                if (!cancelled) {
                    setError(error.message);
                    setLoading(false);
                }
                return;
            }

            if (cancelled || !data) return;

            const map = new Map<
                string,
                {
                    totalAnswers: number;
                    totalCorrect: number;
                }
            >();

            for (const row of data as {
                question_id: string;
                is_correct: boolean | null;
            }[]) {
                const qId = row.question_id;
                const bucket =
                    map.get(qId) ?? {
                        totalAnswers: 0,
                        totalCorrect: 0,
                    };

                bucket.totalAnswers += 1;
                if (row.is_correct) {
                    bucket.totalCorrect += 1;
                }

                map.set(qId, bucket);
            }

            const questions: SessionQuestionSummary[] = Array.from(
                map.entries()
            ).map(([questionId, v]) => ({
                questionId,
                totalAnswers: v.totalAnswers,
                totalCorrect: v.totalCorrect,
            }));

            if (!cancelled) {
                setSummary({ questions });
                setLoading(false);
            }
        };

        // 최초 1회 + 주기적 업데이트
        fetchSummary();
        timer = window.setInterval(fetchSummary, pollMs);

        return () => {
            cancelled = true;
            if (timer) window.clearInterval(timer);
        };
    }, [sessionId, pollMs]);

    return { summary, loading, error };
}
