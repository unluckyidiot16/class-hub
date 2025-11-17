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
export async function logGameEvent(event: GameEventLog): Promise<void> {
    if (import.meta.env.DEV) {
        // 개발 중에는 어떤 값이 들어오는지 로그로 확인
        console.debug("[logGameEvent]", event);
    }

    const { gameSessionId, roomId, studentId, eventType, payload } = event;

    if (!gameSessionId || !roomId || !studentId) {
        console.warn("[logGameEvent] missing ids", {
            gameSessionId,
            roomId,
            studentId,
        });
        return;
    }

    const { error } = await supabase.from("game_events").insert({
        game_session_id: gameSessionId,
        room_id: roomId,
        student_id: studentId,
        event_type: eventType,
        payload,
    });

    if (error) {
        console.error("[logGameEvent] insert error", error);
        throw error;
    }
}

/**
 * quiz_sessions.id와 동일한 id로 game_sessions를 보장
 * - 이미 있으면 그대로 반환
 * - 없으면 새로 insert
 */
export async function ensureGameSession(params: {
    sessionId: string;
    roomId: string;
    gameId: string;
    quizpackId?: string | null;
}) {
    const { sessionId, roomId, gameId, quizpackId } = params;

    if (!sessionId || !roomId) return;

    // 이미 있는지 먼저 확인
    const { data: existing, error: loadErr } = await supabase
        .from("game_sessions")
        .select("id, status")
        .eq("id", sessionId)
        .maybeSingle();

    if (loadErr) {
        console.error("[ensureGameSession] load error", loadErr);
        throw loadErr;
    }

    if (existing) {
        return existing;
    }

    // 없으면 새로 생성 (id를 quiz_sessions.id와 동일하게 지정)
    const { data, error } = await supabase
        .from("game_sessions")
        .insert({
            id: sessionId,
            room_id: roomId,
            game_id: gameId,
            quizpack_id: quizpackId ?? null,
            status: "running",
        })
        .select("id, status")
        .single();

    if (error) {
        console.error("[ensureGameSession] insert error", error);
        throw error;
    }

    return data;
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
