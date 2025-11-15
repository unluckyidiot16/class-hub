// src/types/quizPackJson.ts
export type QuizPackJsonV1 = {
    type: "quizpack";
    version: "v1";

    pack: {
        title: string;
        subject?: string | null;
        grade?: string | null;
        description?: string | null;
    };

    questions: {
        index: number;         // 0부터 시작, 배열 순서와 동일
        prompt: string;
        options: string[];     // 4지선다 기준, 길이 2~6 정도
        answerIndex: number;   // 0~(options.length-1)
    }[];
};
