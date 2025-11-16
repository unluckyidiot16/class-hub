// src/api/gameSessions.ts
import { supabase } from "../supabaseClient";
import type { GameId } from "../games/gameRegistry";

export type GameSession = {
    id: string;
    room_id: string;
    game_id: GameId;
    quizpack_id: string;
    status: "pending" | "running" | "finished";
    started_at: string | null;
    ended_at: string | null;
};

export async function createGameSession(params: {
    roomId: string;
    gameId: GameId;
    quizpackId: string;
}): Promise<GameSession> {
    const { data, error } = await supabase
        .from("game_sessions")
        .insert({
            room_id: params.roomId,
            game_id: params.gameId,
            quizpack_id: params.quizpackId,
            status: "running",
            started_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error || !data) throw error ?? new Error("createGameSession failed");
    return data as GameSession;
}

export async function logGameEvent(evt: {
    gameSessionId: string;
    roomId: string;
    studentId: string;
    eventType: "answer" | "summary" | "heartbeat";
    payload: any;
}) {
    const { error } = await supabase.from("game_events").insert({
        game_session_id: evt.gameSessionId,
        room_id: evt.roomId,
        student_id: evt.studentId,
        event_type: evt.eventType,
        payload: evt.payload,
    });

    if (error) throw error;
}
