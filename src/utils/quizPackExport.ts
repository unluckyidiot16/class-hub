// src/utils/quizPackExport.ts
import type { QuizPackJsonV1 } from "../types/quizPackJson";

export type QuizPackRow = {
    id: string;
    owner_id: string;
    title: string;
    subject: string | null;
    grade: string | null;
    description?: string | null;
};

export type QuizQuestionRow = {
    id: string;
    pack_id: string;
    index_in_pack: number;
    prompt: string;
    options: string[] | null;
    answer_index: number | null;
    difficulty?: number | null;
    tags?: string[] | null;
};

export function buildQuizPackJson(
    pack: QuizPackRow,
    questions: QuizQuestionRow[]
): QuizPackJsonV1 {
    return {
        type: "quizpack",
        version: "v1",
        pack: {
            id: pack.id,
            title: pack.title,
            subject: pack.subject,
            grade: pack.grade,
            description: pack.description ?? null,
        },
        questions: questions
            .slice()
            .sort((a, b) => a.index_in_pack - b.index_in_pack)
            .map((q) => ({
                id: q.id,
                index: q.index_in_pack,
                prompt: q.prompt,
                options: q.options ?? [],
                answerIndex:
                    typeof q.answer_index === "number"
                        ? q.answer_index
                        : 0,
                difficulty:
                    typeof q.difficulty === "number"
                        ? q.difficulty
                        : null,
                tags: Array.isArray(q.tags)
                    ? q.tags.map((t) => String(t))
                    : null,
            })),
    };
}

export function downloadQuizPackJson(
    pack: QuizPackRow,
    questions: QuizQuestionRow[]
) {
    const json = buildQuizPackJson(pack, questions);
    const blob = new Blob([JSON.stringify(json, null, 2)], {
        type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    const safeTitle =
        pack.title.replace(/[^\w가-힣\-]+/g, "_").slice(0, 40) ||
        "quizpack";

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    a.href = url;
    a.download = `${safeTitle}.${today}.quizpack.json`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
