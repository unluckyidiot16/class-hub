// src/hooks/useQddAnswerStats.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type QddAnswerStats = {
    total: number;
    correct: number;
    wrong: number;
    options: Record<number, number>; // answerIndex -> count
};

export type QddStatsMap = Record<string, QddAnswerStats>;

type GameEventRow = {
    id: string;
    room_id: string;
    event_type: string;
    payload: {
        questionId?: string;
        answerIndex?: number;
        correct?: boolean;
    } | null;
    created_at: string;
};

function accumulate(prev: QddStatsMap, row: GameEventRow): QddStatsMap {
    const p = row.payload ?? {};

    const qid =
        typeof p.questionId === "string" && p.questionId.length > 0
            ? p.questionId
            : "unknown";

    const answerIdx =
        typeof p.answerIndex === "number" ? p.answerIndex : -1;
    if (answerIdx < 0) return prev;

    const isCorrect = p.correct === true;

    const existing =
        prev[qid] || { total: 0, correct: 0, wrong: 0, options: {} };

    const next: QddAnswerStats = {
        total: existing.total + 1,
        correct: existing.correct + (isCorrect ? 1 : 0),
        wrong: existing.wrong + (isCorrect ? 0 : 1),
        options: {
            ...existing.options,
            [answerIdx]: (existing.options[answerIdx] ?? 0) + 1,
        },
    };

    return {
        ...prev,
        [qid]: next,
    };
}

export function useQddAnswerStats(roomId: string | null) {
    const [stats, setStats] = useState<QddStatsMap>({});

    useEffect(() => {
        if (!roomId) return;
        let cancelled = false;

        async function bootstrap() {
            const { data, error } = await supabase
                .from("game_events")
                .select("id, room_id, event_type, payload, created_at")
                .eq("room_id", roomId)
                .order("created_at", { ascending: true });

            console.log("[TeacherRoomLive] game_events initial", {
                roomId,
                data,
                error,
            });

            if (error || !data) return;
            if (cancelled) return;

            let next: QddStatsMap = {};
            for (const row of data as GameEventRow[]) {
                next = accumulate(next, row);
            }
            setStats(next);
        }

        void bootstrap();

        const channel = supabase
            .channel(`game_events:room=${roomId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "game_events",
                    filter: `room_id=eq.${roomId}`,
                },
                (payload) => {
                    const row = payload.new as GameEventRow;
                    console.log(
                        "[TeacherRoomLive] game_events realtime INSERT",
                        row,
                    );
                    setStats((prev) => accumulate(prev, row));
                },
            )
            .subscribe((status) => {
                console.log(
                    "[TeacherRoomLive] game_events channel status:",
                    status,
                );
            });

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
        };
    }, [roomId]);

    return stats;
}
