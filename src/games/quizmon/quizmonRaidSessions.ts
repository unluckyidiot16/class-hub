// src/games/quizmon/quizmonRaidSessions.ts
import { supabase } from "../../lib/supabaseClient";

/**
 * quizmon_raid_sessions 테이블 Row 타입
 * (DB 스키마 기준: id, room_id, game_session_id, class_id, boss_species_id ...)
 */
export type QuizmonRaidSessionRow = {
    id: string;
    room_id: string;
    game_session_id: string;
    class_id: string;
    boss_species_id: string;
    boss_level: number;
    status: "open" | "closed";
    total_damage: number;
    runs_count: number;
    created_at: string;
    closed_at: string | null;
};

type GetActiveRaidSessionParams = {
    roomId: string;
    gameSessionId?: string | null;
};

/**
 * 현재 room + game_session 기준으로 열린 레이드 세션 1개 가져오기
 * - 없으면 null 반환
 */
export async function getActiveRaidSession(
    params: GetActiveRaidSessionParams,
): Promise<QuizmonRaidSessionRow | null> {
    const { roomId, gameSessionId } = params;

    if (!roomId || !gameSessionId) return null;

    const { data, error } = await supabase
        .from("quizmon_raid_sessions")
        .select("*")
        .eq("room_id", roomId)
        .eq("game_session_id", gameSessionId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1);

    if (error) {
        console.error(
            "[quizmonRaidSessions] getActiveRaidSession error",
            error,
        );
        return null;
    }

    const rows = (data ?? []) as QuizmonRaidSessionRow[];
    return rows.length > 0 ? rows[0] : null;
}

type CreateRaidSessionParams = {
    roomId: string;
    classId: string;
    gameSessionId: string;
    bossSpeciesId: string;
    bossLevel?: number;
};

/**
 * 새 레이드 세션 시작
 * - 동일 room + game_session 에 열린 레이드가 있으면 먼저 닫고 새로 연다.
 */
export async function createRaidSession(
    params: CreateRaidSessionParams,
): Promise<QuizmonRaidSessionRow> {
    const {
        roomId,
        classId,
        gameSessionId,
        bossSpeciesId,
        bossLevel = 50,
    } = params;

    // 1) 기존 열린 레이드 세션 닫기
    const nowIso = new Date().toISOString();
    const { error: closeError } = await supabase
        .from("quizmon_raid_sessions")
        .update({
            status: "closed",
            closed_at: nowIso,
        })
        .eq("room_id", roomId)
        .eq("game_session_id", gameSessionId)
        .eq("status", "open");

    if (closeError) {
        console.warn(
            "[quizmonRaidSessions] createRaidSession close old error",
            closeError,
        );
    }

    // 2) 새 레이드 세션 생성
    const { data, error } = await supabase
        .from("quizmon_raid_sessions")
        .insert({
            room_id: roomId,
            class_id: classId,
            game_session_id: gameSessionId,
            boss_species_id: bossSpeciesId, // TODO: 보스 선택 UI 붙이면 여기 값만 바꾸면 됨
            boss_level: bossLevel,
            status: "open",
        })
        .select("*")
        .limit(1);

    if (error || !data || data.length === 0) {
        console.error(
            "[quizmonRaidSessions] createRaidSession insert error",
            error,
        );
        throw error ?? new Error("Failed to create raid session");
    }

    return data[0] as QuizmonRaidSessionRow;
}

type CloseActiveRaidSessionParams = {
    roomId: string;
    gameSessionId: string;
};

/**
 * 현재 room + game_session 에 열린 레이드 세션이 있으면 모두 닫기
 */
export async function closeActiveRaidSession(
    params: CloseActiveRaidSessionParams,
): Promise<void> {
    const { roomId, gameSessionId } = params;
    const nowIso = new Date().toISOString();

    const { error } = await supabase
        .from("quizmon_raid_sessions")
        .update({
            status: "closed",
            closed_at: nowIso,
        })
        .eq("room_id", roomId)
        .eq("game_session_id", gameSessionId)
        .eq("status", "open");

    if (error) {
        console.error(
            "[quizmonRaidSessions] closeActiveRaidSession error",
            error,
        );
        throw error;
    }
}
