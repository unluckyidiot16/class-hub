// src/types/quizPackJson.ts

/** 퀴즈팩 메타 정보 (팩 단위) */
export type QuizPackMetaV1 = {
    /** Supabase quiz_packs.id 와 매핑용 (필수 아님, 있으면 사용) */
    id?: string;

    /** 퀴즈팩 제목 (필수) */
    title: string;

    /** 과목 (예: "수학", "영어") */
    subject?: string | null;

    /** 학년/설명 (예: "5", "5-6군") */
    grade?: string | null;

    /** 추가 설명 */
    description?: string | null;
};

/** 퀴즈팩의 단일 문항 구조 (v1) */
export type QuizPackQuestionV1 = {
    /** Supabase quiz_questions.id 와 매핑용 (필수 아님, 있으면 사용) */
    id?: string;

    /** 팩 내 인덱스 (0부터, DB의 index_in_pack 와 매핑) */
    index: number;

    /** 문제 지문 */
    prompt: string;

    /** 보기 목록 (2~N개, QDD에서는 2~6개 정도를 권장) */
    options: string[];

    /** 정답 보기 인덱스 (0 ~ options.length-1) */
    answerIndex: number;

    /** 난이도 (1~5 권장, 없으면 1로 간주) */
    difficulty?: number | null;

    /** 태그 (단원, 단원코드 등) */
    tags?: string[] | null;

    /** 해설/정답 설명 (선택) */
    explanation?: string | null;

    /**
     * 문제 타입 (향후 확장용)
     * 지금은 기본 "choice"만 사용하고,
     * 나중에 "ox", "short" 같은 것들을 추가할 수 있게 열어둠.
     */
    type?: "choice";
};

/** QuizPack v1 전체 JSON 구조 */
export type QuizPackJsonV1 = {
    type: "quizpack";
    version: "v1";

    pack: QuizPackMetaV1;
    questions: QuizPackQuestionV1[];
};

/** 향후 v2 이상 생기면 여기서 union으로 묶어 쓰기 */
export type AnyQuizPackJson = QuizPackJsonV1;

/** 런타임 타입 가드 (import 시 검증용) */
export function isQuizPackJsonV1(raw: any): raw is QuizPackJsonV1 {
    if (!raw || typeof raw !== "object") return false;
    if (raw.type !== "quizpack" || raw.version !== "v1") return false;

    const pack = (raw as any).pack;
    if (!pack || typeof pack.title !== "string") return false;

    const qs = (raw as any).questions;
    if (!Array.isArray(qs)) return false;

    for (const q of qs) {
        if (!q || typeof q !== "object") return false;
        if (typeof q.index !== "number") return false;
        if (typeof q.prompt !== "string") return false;
        if (!Array.isArray(q.options)) return false;
        if (typeof q.answerIndex !== "number") return false;
    }

    return true;
}
