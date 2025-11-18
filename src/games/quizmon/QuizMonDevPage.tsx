// src/games/quizmon/QuizMonDevPage.tsx
import { QuizMonGame } from "./QuizMonGame";
import type { QuizPackJsonV1 } from "../../types/quizPackJson";

// 임시 더미 quizpackJson (엔진 테스트용)
const dummyQuizpack: QuizPackJsonV1 = {
    type: "quizpack",   // ✅ 필수
    version: "v1",      // ✅ 필수

    pack: {
        id: "dummy-pack",
        title: "샌드박스 테스트 팩",
        subject: "테스트",
        grade: "dev",
    },

    questions: [
        {
            id: "q1",
            index: 0,
            prompt: "2 + 3 = ?",
            options: ["4", "5", "6", "7"],
            answerIndex: 1,
            // difficulty, tags, explanation, type 등은 선택(optional)
        },
        {
            id: "q2",
            index: 1,
            prompt: "영어로 '고양이'는?",
            options: ["dog", "cat", "bird", "fish"],
            answerIndex: 1,
        },
    ],
};

export default function QuizMonDevPage() {
    return <QuizMonGame quizpack={dummyQuizpack} />;
}
