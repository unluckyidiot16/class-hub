// src/api/autopptQuestions.ts
import { supabase } from "../lib/supabaseClient";

export type AutopptQuestionRow = {
    id: string;
    doc_id: string;
    room_id: string;
    page_number: number;     // DB 컬럼 기준 (1-based)
    prompt: string;
    options: string[] | null;
    answer_index: number | null;
    time_limit_sec: number | null; // DB time_limit_seconds 의 alias
    created_at: string;
};

/**
 * 특정 문서의 N페이지(0-based pageIndex)에 연결된 AutoPPT 문제 리스트
 */
export async function listAutopptQuestionsByDocAndPage(
    docId: string,
    pageIndex: number,
): Promise<AutopptQuestionRow[]> {
    const pageNumber = pageIndex + 1; // DB는 1페이지부터 시작

    const { data, error } = await supabase
        .from("autoppt_questions")
        .select(`
            id,
            doc_id,
            room_id,
            page_number,
            prompt,
            options,
            answer_index,
            time_limit_sec: time_limit_seconds,
            created_at
        `)
        .eq("doc_id", docId)
        .eq("page_number", pageNumber)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("[autopptQuestions] list error", error);
        throw error;
    }

    return (data ?? []) as AutopptQuestionRow[];
}

/**
 * 현재 페이지(0-based pageIndex)에 새로운 AutoPPT 문제 추가
 */
export async function createAutopptQuestion(params: {
    docId: string;
    pageIndex: number;          // 0-based
    prompt: string;
    options?: string[];
    answerIndex?: number | null;
    timeLimitSec?: number | null;
}): Promise<AutopptQuestionRow> {
    const { docId, pageIndex, prompt, options, answerIndex, timeLimitSec } =
        params;
    const pageNumber = pageIndex + 1; // DB용 1-based

    // 🔹 doc_id 에 연결된 room_id 를 autoppt_docs 에서 가져옴
    const { data: doc, error: docError } = await supabase
        .from("autoppt_docs")
        .select("id, room_id")
        .eq("id", docId)
        .single();

    if (docError || !doc) {
        console.error(
            "[autopptQuestions] failed to load doc for room_id",
            docError,
        );
        throw docError ?? new Error("AutoPPT 문서를 찾을 수 없습니다.");
    }

    const insertPayload: any = {
        doc_id: docId,
        room_id: doc.room_id,
        page_number: pageNumber,
        prompt,
        // options / answer_index / time_limit_seconds 는 DB 스키마에 맞춰서 삽입
        options: options && options.length > 0 ? options : null,
        answer_index:
            typeof answerIndex === "number" && !Number.isNaN(answerIndex)
                ? answerIndex
                : null,
        time_limit_seconds:
            typeof timeLimitSec === "number" && !Number.isNaN(timeLimitSec)
                ? timeLimitSec
                : null,
    };

    const { data, error } = await supabase
        .from("autoppt_questions")
        .insert(insertPayload)
        .select(`
            id,
            doc_id,
            room_id,
            page_number,
            prompt,
            options,
            answer_index,
            time_limit_sec: time_limit_seconds,
            created_at
        `)
        .single();

    if (error || !data) {
        console.error("[autopptQuestions] create error", error);
        throw error ?? new Error("createAutopptQuestion failed");
    }

    return data as AutopptQuestionRow;
}

export async function deleteAutopptQuestion(id: string): Promise<void> {
    const { error } = await supabase
        .from("autoppt_questions")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("[autopptQuestions] delete error", error);
        throw error;
    }
}
