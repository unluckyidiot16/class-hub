// src/utils/quizPackImport.ts
import type { QuizPackJsonV1 } from "../types/quizPackJson";
import { isQuizPackJsonV1 } from "../types/quizPackJson";
import { supabase } from "../lib/supabaseClient";

/**
 * 업로드된 파일을 읽어서 QuizPackJsonV1로 파싱/검증
 */
export async function parseQuizPackFile(
    file: File
): Promise<QuizPackJsonV1> {
    const text = await file.text();
    let raw: unknown;

    try {
        raw = JSON.parse(text);
    } catch (e) {
        throw new Error("JSON 형식이 올바르지 않습니다.");
    }

    if (!isQuizPackJsonV1(raw)) {
        throw new Error("지원하지 않는 퀴즈팩 포맷입니다.");
    }

    if (!raw.questions || raw.questions.length === 0) {
        throw new Error("문항이 하나 이상 있어야 합니다.");
    }

    // 간단 추가 검증 (지문, 보기, 정답 인덱스)
    raw.questions.forEach((q, i) => {
        if (
            typeof q.prompt !== "string" ||
            !Array.isArray(q.options) ||
            typeof q.answerIndex !== "number"
        ) {
            throw new Error(`${i + 1}번 문항 형식이 잘못되었습니다.`);
        }
    });

    return raw;
}

/**
 * JSON으로부터 새 quiz_packs + quiz_questions를 생성하고
 * 생성된 pack id를 반환
 */
export async function importQuizPackJson(
    file: File,
    ownerId: string
): Promise<string> {
    const data = await parseQuizPackFile(file);
    const { pack, questions } = data;

    // 1) quiz_packs insert
    const { data: packRow, error: packErr } = await supabase
        .from("quiz_packs")
        .insert({
            owner_id: ownerId,
            title: pack.title,
            subject: pack.subject ?? null,
            grade: pack.grade ?? null,
            description: pack.description ?? null,
        })
        .select("*")
        .single();

    if (packErr || !packRow) {
        console.error("[importQuizPackJson] pack insert error", packErr);
        throw new Error("퀴즈팩 생성 중 오류가 발생했습니다.");
    }

    const newPackId = packRow.id as string;

    // 2) quiz_questions bulk insert
    const questionRows = questions.map((q, idx) => ({
        pack_id: newPackId,
        index_in_pack: typeof q.index === "number" ? q.index : idx,
        prompt: q.prompt,
        options: q.options,
        answer_index: q.answerIndex,
        difficulty:
            typeof q.difficulty === "number" ? q.difficulty : null,
        tags: Array.isArray(q.tags) ? q.tags : null,
    }));

    const { error: qErr } = await supabase
        .from("quiz_questions")
        .insert(questionRows);

    if (qErr) {
        console.error("[importQuizPackJson] questions insert error", qErr);
        throw new Error("문항 생성 중 오류가 발생했습니다.");
    }

    return newPackId;
}
