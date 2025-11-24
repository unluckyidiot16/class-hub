// src/utils/playStudentKey.ts

/**
 * 반 단위 / 연습(global) 단위 학생 식별 키 생성 & 캐시
 * - classId가 있으면: "class:{classId}" 스코프
 * - 없으면: "global" 스코프 (연습용 / StudentPlayPackPage)
 */
export function ensurePlayStudentKey(classId?: string | null): string {
    const scope = classId ? `class:${classId}` : "global";
    const storageKey = `classhub:play-student:${scope}`;

    // SSR 대비
    if (typeof window === "undefined") {
        return `s-${scope}-${Math.random().toString(36).slice(2)}`;
    }

    try {
        const existing = window.localStorage.getItem(storageKey);
        if (existing) return existing;

        const newKey = `s-${Math.random().toString(36).slice(2)}`;
        window.localStorage.setItem(storageKey, newKey);
        return newKey;
    } catch {
        // localStorage 사용 불가 시 fallback
        return `s-${scope}-${Math.random().toString(36).slice(2)}`;
    }
}
