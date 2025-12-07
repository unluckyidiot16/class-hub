// src/api/autopptQuestions.ts
import { supabase } from "../lib/supabaseClient";

export type AutopptQuestionRow = {
    id: string;
    doc_id: string;
    room_id: string;
    page_number: number; // 1-based
    prompt: string;
    options: string[];
    answer_index: number;
    time_limit_seconds: number;
    created_at: string;
};

export type ListAutopptQuestionsParams = {
    docId: string;
    pageNumber: number; // 1-based
    roomId?: string | null;
};

/**
 * 특정 AutoPPT 문서의 특정 페이지에 연결된 문제 카드 목록 조회
 */
export async function listAutopptQuestions(
    params: ListAutopptQuestionsParams,
): Promise<AutopptQuestionRow[]> {
    const { docId, pageNumber, roomId } = params;

    let query = supabase
        .from("autoppt_questions")
        .select("*")
        .eq("doc_id", docId)
        .eq("page_number", pageNumber)
        .order("created_at", { ascending: true });

    if (roomId) {
        query = query.eq("room_id", roomId);
    }

    const { data, error } = await query;

    if (error) {
        console.error("[autoppt] listAutopptQuestions error", error);
        throw new Error("AutoPPT 문제 카드를 불러오는 중 오류가 발생했습니다.");
    }

    return (data ?? []) as AutopptQuestionRow[];
}

export type CreateAutopptQuestionParams = {
    docId: string;
    roomId: string;
    pageNumber: number; // 1-based
    prompt: string;
    options: string[];
    answerIndex: number;
    timeLimitSeconds?: number;
};

/**
 * 새 AutoPPT 문제 카드 생성
 */
export async function createAutopptQuestion(
    params: CreateAutopptQuestionParams,
): Promise<AutopptQuestionRow> {
    const {
        docId,
        roomId,
        pageNumber,
        prompt,
        options,
        answerIndex,
        timeLimitSeconds = 30,
    } = params;

    const cleanOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);

    if (cleanOptions.length < 2) {
        throw new Error("보기는 최소 2개 이상 입력해야 합니다.");
    }

    if (answerIndex < 0 || answerIndex >= cleanOptions.length) {
        throw new Error("정답 보기 인덱스가 올바르지 않습니다.");
    }

    const { data, error } = await supabase
        .from("autoppt_questions")
        .insert({
            doc_id: docId,
            room_id: roomId,
            page_number: pageNumber,
            prompt,
            options: cleanOptions,
            answer_index: answerIndex,
            time_limit_seconds: timeLimitSeconds,
        })
        .select("*")
        .single();

    if (error || !data) {
        console.error("[autoppt] createAutopptQuestion error", error);
        throw new Error("AutoPPT 문제 카드를 저장하는 중 오류가 발생했습니다.");
    }

    return data as AutopptQuestionRow;
}

export type UpdateAutopptQuestionParams = {
    id: string;
    prompt?: string;
    options?: string[];
    answerIndex?: number;
    timeLimitSeconds?: number;
};

/**
 * 기존 AutoPPT 문제 카드 수정
 */
export async function updateAutopptQuestion(
    params: UpdateAutopptQuestionParams,
): Promise<AutopptQuestionRow> {
    const { id, prompt, options, answerIndex, timeLimitSeconds } = params;

    const patch: Record<string, unknown> = {};
    if (prompt != null) patch.prompt = prompt;

    if (options) {
        const cleanOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
        patch.options = cleanOptions;
    }
    if (answerIndex != null) patch.answer_index = answerIndex;
    if (timeLimitSeconds != null) patch.time_limit_seconds = timeLimitSeconds;

    const { data, error } = await supabase
        .from("autoppt_questions")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();

    if (error || !data) {
        console.error("[autoppt] updateAutopptQuestion error", error);
        throw new Error("AutoPPT 문제 카드를 수정하는 중 오류가 발생했습니다.");
    }

    return data as AutopptQuestionRow;
}

/**
 * AutoPPT 문제 카드 삭제
 */
export async function deleteAutopptQuestion(id: string): Promise<void> {
    const { error } = await supabase
        .from("autoppt_questions")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("[autoppt] deleteAutopptQuestion error", error);
        throw new Error("AutoPPT 문제 카드를 삭제하는 중 오류가 발생했습니다.");
    }
}
