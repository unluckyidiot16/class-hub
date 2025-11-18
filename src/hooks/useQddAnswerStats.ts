// src/hooks/useQddAnswerStats.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type QddAnswerStats = {
    total: number;
    correct: number;
    wrong: number;
};

export type QddStatsMap = Record<string, QddAnswerStats>; // key: questionId (또는 unknown)

/** game_events 한 줄 타입 (payload 기반) */
type GameEventRow = {
    id: string;
    room_id: string;
    event_type: string;
    payload: {
        questionId?: string;
        answerIndex?: number;
        correct?: boolean;
        // timeMs 등 다른 필드는 무시
    } | null;
    created_at: string;
};

/** 1개의 이벤트를 stats 맵에 반영 */
function accumulate(prev: QddStatsMap, row: GameEventRow): QddStatsMap {
    // event_type 이 애매하면 여기서 필터링 (answer / qdd-answer / CH_REPORT_ANSWER 전부 허용)
    const t = row.event_type;
    if (
        t !== "answer" &&
        t !== "qdd-answer" &&
        t !== "CH_REPORT_ANSWER"
    ) {
        return prev;
    }

    const p = row.payload ?? {};
    const qid =
        typeof p.questionId === "string" && p.questionId.length > 0
            ? p.questionId
            : "unknown";

    const answerIdx =
        typeof p.answerIndex === "number" ? p.answerIndex : -1;
    if (answerIdx < 0) return prev;

    const isCorrect = p.correct === true;

    const existing = prev[qid] || { total: 0, correct: 0, wrong: 0 };

    return {
        ...prev,
        [qid]: {
            total: existing.total + 1,
            correct: existing.correct + (isCorrect ? 1 : 0),
            wrong: existing.wrong + (isCorrect ? 0 : 1),
        },
    };
}

/**
 * roomId 기준으로 QDD 정답 통계를 실시간으로 집계
 * - 초기에는 game_events 전체를 한 번 select
 * - 이후에는 Realtime INSERT 이벤트마다 stats 갱신
 */
export function useQddAnswerStats(roomId: string | null) {
    const [stats, setStats] = useState<QddStatsMap>({});

    useEffect(() => {
        if (!roomId) return;
        let cancelled = false;

        // 1) 초기 로드
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

            if (error || !data) {
                if (error) {
                    console.error(
                        "[TeacherRoomLive] load game_events failed",
                        error,
                    );
                }
                return;
            }
            if (cancelled) return;

            let next: QddStatsMap = {};
            for (const row of data as GameEventRow[]) {
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
