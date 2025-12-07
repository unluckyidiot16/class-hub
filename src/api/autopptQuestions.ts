// src/api/autopptQuestions.ts
import { supabase } from "../lib/supabaseClient";

export type AutopptQuestionRow = {
    id: string;
    doc_id: string;
    page_index: number;
    prompt: string;
    options: string[] | null;
    answer_index: number | null;
    time_limit_sec: number | null;
    created_at: string;
};

export async function listAutopptQuestionsByDocAndPage(
    docId: string,
    pageIndex: number,
): Promise<AutopptQuestionRow[]> {
    const { data, error } = await supabase
        .from("autoppt_questions")
        .select("*")
        .eq("doc_id", docId)
        .eq("page_index", pageIndex)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("[autopptQuestions] list error", error);
        throw error;
    }

    return (data ?? []) as AutopptQuestionRow[];
}

export async function createAutopptQuestion(params: {
    docId: string;
    pageIndex: number;
    prompt: string;
    options?: string[];
    answerIndex?: number | null;
    timeLimitSec?: number | null;
}): Promise<AutopptQuestionRow> {
    const { docId, pageIndex, prompt, options, answerIndex, timeLimitSec } =
        params;

    const { data, error } = await supabase
        .from("autoppt_questions")
        .insert({
            doc_id: docId,
            page_index: pageIndex,
            prompt,
            options: options && options.length > 0 ? options : null,
            answer_index:
                typeof answerIndex === "number" ? answerIndex : null,
            time_limit_sec:
                typeof timeLimitSec === "number" ? timeLimitSec : null,
        })
        .select("*")
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
