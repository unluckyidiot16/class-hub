// src/hooks/useQddAnswerStats.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type QddAnswerStats = {
    total: number;
    correct: number;
    wrong: number;
};

export type QddStatsMap = Record<string, QddAnswerStats>; // key: question_id

function accumulate(prev: QddStatsMap, row: any): QddStatsMap {
    const qid: string = row.question_id || "unknown";
    const existing = prev[qid] || { total: 0, correct: 0, wrong: 0 };
    const isCorrect = row.is_correct === true;

    return {
        ...prev,
        [qid]: {
            total: existing.total + 1,
            correct: existing.correct + (isCorrect ? 1 : 0),
            wrong: existing.wrong + (isCorrect ? 0 : 1),
        },
    };
}

export function useQddAnswerStats(roomId: string | null) {
    const [stats, setStats] = useState<QddStatsMap>({});

    useEffect(() => {
        if (!roomId) return;
        let cancelled = false;

        // 1) 초기 로드
        async function bootstrap() {
            const { data, error } = await supabase
                .from("game_events")
                .select(
                    "id, room_id, game_key, event_type, question_id, is_correct, answer_index"
                )
                .eq("room_id", roomId)
                .eq("game_key", "qdd")
                .eq("event_type", "answer");

            if (error) {
                console.error("[TeacherRoomLive] load game_events failed", error);
                return;
            }
            if (cancelled) return;

            let next: QddStatsMap = {};
            for (const row of data ?? []) {
                next = accumulate(next, row);
            }
            setStats(next);
        }

        void bootstrap();

        // 2) Realtime 구독
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
                    const row: any = payload.new;
                    if (!row) return;
                    if (row.game_key !== "qdd") return;
                    if (row.event_type !== "answer") return;

                    setStats((prev) => accumulate(prev, row));
                }
            )
            .subscribe((status) => {
                console.log("[TeacherRoomLive] game_events channel status:", status);
            });

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
        };
    }, [roomId]);

    return stats;
}
