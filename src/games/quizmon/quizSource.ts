// src/games/quizmon/quizSource.ts
import type { QuizQuestionLite } from "./types";
import type { QuizPackJsonV1 } from "../../types/quizPackJson";

/** QuizPackJsonV1 → QuizMon에서 쓰는 가벼운 퀴즈 타입으로 변환 */
export function quizPackToLiteQuestions(
    quizpack: QuizPackJsonV1,
): QuizQuestionLite[] {
    return quizpack.questions.map((q, idx) => {
        // ✅ id가 없을 경우에 대비해서 항상 string 보장
        const id =
            q.id ??
            `${quizpack.pack.id ?? "pack"}-${q.index ?? idx}`;

        // ✅ answerIndex도 number로 안전하게 보정
        const anyQ = q as any;
        const answerIndex =
            typeof anyQ.answerIndex === "number"
                ? anyQ.answerIndex
                : typeof anyQ.answer_index === "number"
                    ? anyQ.answer_index
                    : 0;

        return {
            id,
            prompt: q.prompt,
            options: q.options ?? [],
            answerIndex,
        };
    });
}
