// src/utils/playStudentKey.ts

const BASE_KEY = "classhub:play:studentKey";

function makeRandomKey() {
    return "s-" + Math.random().toString(36).slice(2);
}

/**
 * 반(class) 단위 학생 식별 키 보장.
 *
 * - classId가 있으면: classhub:play:studentKey:class:{classId}
 * - 없으면: classhub:play:studentKey:global
 * - 예전에 쓰던 전역 키(BASE_KEY)가 있으면, 반별 키 처음 생성 시 복사해서 재사용.
 */
export function ensurePlayStudentKey(classId?: string | null): string {
    if (typeof window === "undefined") {
        return makeRandomKey();
    }

    try {
        const scope = classId ? `class:${classId}` : "global";
        const storageKey = `${BASE_KEY}:${scope}`;

        let existing = window.localStorage.getItem(storageKey);
        if (existing && existing.length > 0) {
            return existing;
        }

        // 레거시 전역 키가 있으면 우선 사용
        const legacyKey = window.localStorage.getItem(BASE_KEY);
        if (legacyKey && legacyKey.length > 0) {
            window.localStorage.setItem(storageKey, legacyKey);
            return legacyKey;
        }

        const created = makeRandomKey();
        window.localStorage.setItem(storageKey, created);
        return created;
    } catch {
        return makeRandomKey();
    }
}
