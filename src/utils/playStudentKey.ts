// src/utils/playStudentKey.ts

export const PLAY_STUDENT_KEY_KEY = "classhub:play:studentKey";

/**
 * StudentPlayPackPage / QuizMon 허브 등
 * "연습 학생"용 공통 studentKey.
 * localStorage에 고정 키로 저장해서 재사용한다.
 */
export function ensurePlayStudentKey(): string {
    try {
        if (typeof window !== "undefined") {
            const existing = window.localStorage.getItem(PLAY_STUDENT_KEY_KEY);
            if (existing) return existing;

            const created = "play-" + Math.random().toString(36).slice(2);
            window.localStorage.setItem(PLAY_STUDENT_KEY_KEY, created);
            return created;
        }
    } catch {
        // ignore
    }
    // SSR/에러 등의 예외 상황에서도 항상 뭔가 하나는 생성
    return "play-" + Math.random().toString(36).slice(2);
}
