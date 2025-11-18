// src/hooks/useQddAnswerStats.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type QddQuestionStats = {
    total: number;
    correct: number;
    wrong: number;
};

type GameEventRow = {
    id: number;
    game_id: string;
    game_session_id: string;
    room_id: string;
    event_type: string;
    payload: any;
    created_at: string;
};

function applyEvent(
    prev: Record<string, QddQuestionStats>,
    ev: GameEventRow,
): Record<string, QddQuestionStats> {
    // QDD 답안 이벤트만 카운트
    if (ev.game_id !== "qdd") return prev;
    if (ev.event_type !== "answer") return prev;

    const { questionId, correct } = ev.payload ?? {};
    if (!questionId) return prev;

    const current = prev[questionId] ?? { total: 0, correct: 0, wrong: 0 };
    const next: QddQuestionStats = {
        total: current.total + 1,
        correct: current.correct + (correct ? 1 : 0),
        wrong: current.wrong + (correct ? 0 : 1),
    };

    return {
        ...prev,
        [questionId]: next,
    };
}

function buildStats(events: GameEventRow[]): Record<string, QddQuestionStats> {
    let acc: Record<string, QddQuestionStats> = {};
    for (const ev of events) {
        acc = applyEvent(acc, ev);
    }
    return acc;
}

/**
 * QDD 전용: game_events 기준으로 질문별 통계를 계산해 주는 훅
 */
export function useQddAnswerStats(params: {
    roomId: string | null;
    gameSessionId: string | null;
}) {
    const { roomId, gameSessionId } = params;
    const [stats, setStats] = useState<Record<string, QddQuestionStats>>({});

    useEffect(() => {
        if (!roomId || !gameSessionId) return;

        let cancelled = false;

        // 1) 페이지 진입 시 한 번 전체 로드
        async function loadInitial() {
            const { data, error } = await supabase
                .from("game_events")
                .select(
                    "id, game_id, game_session_id, room_id, event_type, payload, created_at",
                )
                .eq("room_id", roomId)
                .eq("game_session_id", gameSessionId)
                .eq("game_id", "qdd")
                .order("id", { ascending: true });

            if (error) {
                console.error("[QDD] loadInitial game_events error", error);
                return;
            }
            if (!data || cancelled) return;

            const typed = data as GameEventRow[];
            setStats(buildStats(typed));
        }

        loadInitial();

        // 2) Realtime INSERT 구독
        const channel = supabase
            .channel(`realtime:qdd:${gameSessionId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "game_events",
                    filter: `game_session_id=eq.${gameSessionId}`,
                },
                (payload) => {
                    const row = payload.new as GameEventRow;
                    setStats((prev) => applyEvent(prev, row));
                },
            )
            .subscribe((status) => {
                console.log("[QDD] game_events channel status:", status);
            });

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
        };
    }, [roomId, gameSessionId]);

    return stats;
}
