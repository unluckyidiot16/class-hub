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

    if (!roomId || !gameSessionId) {
        console.log("[quizmonRaidSessions] getActiveRaidSession: missing params", { roomId, gameSessionId });
        return null;
    }

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
            {
                error,
                code: error?.code,
                message: error?.message,
                details: error?.details,
            },
        );
        return null;
    }

    const rows = (data ?? []) as QuizmonRaidSessionRow[];
    console.log("[quizmonRaidSessions] getActiveRaidSession result:", rows.length > 0 ? rows[0] : "none");
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

    const nowIso = new Date().toISOString();

    // 1) 기존 열린 레이드 세션 확인
    const { data: existingOpen, error: checkError } = await supabase
        .from("quizmon_raid_sessions")
        .select("id, status")
        .eq("room_id", roomId)
        .eq("game_session_id", gameSessionId)
        .eq("status", "open");

    if (checkError) {
        console.warn(
            "[quizmonRaidSessions] createRaidSession check existing error",
            checkError,
        );
    }

    console.log("[quizmonRaidSessions] existing open raids:", existingOpen);

    // 2) 기존 열린 레이드가 있으면 모두 닫기 (id 기준으로 개별 처리)
    if (existingOpen && existingOpen.length > 0) {
        for (const raid of existingOpen) {
            const { error: closeError } = await supabase
                .from("quizmon_raid_sessions")
                .update({
                    status: "closed",
                    closed_at: nowIso,
                })
                .eq("id", raid.id);

            if (closeError) {
                console.error(
                    "[quizmonRaidSessions] failed to close raid",
                    raid.id,
                    closeError,
                );
            } else {
                console.log("[quizmonRaidSessions] closed existing raid:", raid.id);
            }
        }

        // 닫은 후 잠시 대기 (DB 동기화)
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 3) 새 레이드 세션 생성
    const { data, error } = await supabase
        .from("quizmon_raid_sessions")
        .insert({
            room_id: roomId,
            class_id: classId,
            game_session_id: gameSessionId,
            boss_species_id: bossSpeciesId,
            boss_level: bossLevel,
            status: "open",
        })
        .select("*")
        .limit(1);

    if (error || !data || data.length === 0) {
        // 상세 에러 정보 출력
        console.error(
            "[quizmonRaidSessions] createRaidSession insert error",
            {
                error,
                code: error?.code,
                message: error?.message,
                details: error?.details,
                hint: error?.hint,
            },
        );

        // 409 에러면 UNIQUE 제약 조건 충돌 가능성 높음
        if (error?.code === "23505" || error?.message?.includes("duplicate") || error?.message?.includes("unique")) {
            throw new Error(
                "이미 열린 레이드 세션이 있습니다. 기존 레이드를 먼저 종료해주세요.",
            );
        }

        throw error ?? new Error("Failed to create raid session");
    }

    console.log("[quizmonRaidSessions] created new raid session:", data[0]);
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

    console.log("[quizmonRaidSessions] closeActiveRaidSession:", { roomId, gameSessionId });

    const { data, error } = await supabase
        .from("quizmon_raid_sessions")
        .update({
            status: "closed",
            closed_at: nowIso,
        })
        .eq("room_id", roomId)
        .eq("game_session_id", gameSessionId)
        .eq("status", "open")
        .select("id");

    if (error) {
        console.error(
            "[quizmonRaidSessions] closeActiveRaidSession error",
            {
                error,
                code: error?.code,
                message: error?.message,
                details: error?.details,
            },
        );
        throw error;
    }

    console.log("[quizmonRaidSessions] closed raids:", data);
}