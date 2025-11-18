// src/api/gameSessions.ts
import { supabase } from "../lib/supabaseClient";

export type GameEventLog = {
    gameSessionId: string;
    roomId: string;
    studentId: string;
    eventType: "answer" | "summary" | string;
    payload: unknown;
};

/**
 * game_events에 한 줄 남기는 함수
 */
// src/api/gameEvents.ts (또는 gameSessions.ts 안에)
export async function logGameEvent(params: {
    gameSessionId: string;
    roomId: string;
    studentId: string;
    eventType: string;
    payload: any;
}) {
    const { error } = await supabase.from("game_events").insert({
        game_session_id: params.gameSessionId,
        room_id: params.roomId,
        student_id: params.studentId,
        event_type: params.eventType,
        payload: params.payload,
    });

    if (error) {
        console.error("[logGameEvent] insert error", error, {
            gameSessionId: params.gameSessionId, 
                roomId: params.roomId,
                studentId: params.studentId,
                eventType: params.eventType,
        });   
    }
}


/**
 * quiz_sessions.id와 동일한 id로 game_sessions를 보장
 * - 이미 있으면 그대로 반환
 * - 없으면 새로 insert
 */
export async function ensureGameSession(params: {
    roomId: string;
    gameId: string;          // 'qdd' | 'quizmon' | ...
    quizPackId: string;
    quizSessionId: string;   // quiz_sessions.id
}) {
    const { roomId, gameId, quizPackId, quizSessionId } = params;

    const { data, error } = await supabase
        .from("game_sessions")
        .upsert(
            {
                room_id: roomId,
                game_id: gameId,
                quiz_pack_id: quizPackId,
                quiz_session_id: quizSessionId,
            },
            {
                onConflict: "room_id,quiz_session_id,game_id",
            },
        )
        .select("id")
        .single();

    if (error) {
        console.error("[ensureGameSession] upsert error", error);
        throw error;
    }

    return data; // { id: '...gameSessionId...' }
}

/**
 * game_sessions 쪽 상태도 finished로 마무리
 */
export async function endGameSession(params: { sessionId: string }) {
    const { sessionId } = params;
    if (!sessionId) return;

    const { error } = await supabase
        .from("game_sessions")
        .update({
            status: "finished",
            ended_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

    if (error) {
        console.error("[endGameSession] update error", error);
        // 치명적이지 않으니 throw는 선택
    }
}
