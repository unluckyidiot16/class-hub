// src/games/quizmon/useQuizmonProfile.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { applyRaidResultService } from "../../services/quizmonService";


// 실제 테이블 스키마에 맞게 최소 필드만 정의
export type QuizmonProfile = {
    id: string;
    class_id: string;
    student_key: string;
    trainer_name: string | null;
    starter_chosen: boolean;
    total_raids: number;
    total_correct: number;
    total_questions: number;
    created_at: string | null;
    updated_at: string | null;
};

type UseQuizmonProfileParams = {
    classId: string | null;
    /** StudentRoomPage에서 내려주는 원본 student_key */
    studentKey: string | null;
};

type UseQuizmonProfileResult = {
    profile: QuizmonProfile | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    applyRaidResult: (summary: { correct: number; total: number }) => Promise<void>;
    chooseStarter: (speciesId: string) => Promise<void>;
};

/**
 * ⚠️ 중요한 포인트
 * - Hook을 "항상" 같은 순서로 호출한다.
 * - classId / studentKey가 없을 때도 useState/useEffect/useCallback은 호출하되,
 *   내부 로직에서만 조용히 빠져나간다.
 */
export function useQuizmonProfile(
    params: UseQuizmonProfileParams,
): UseQuizmonProfileResult {
    const { classId, studentKey: rawStudentKey } = params;

    const [profile, setProfile] = useState<QuizmonProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * effectiveStudentKey
     * - 실제 DB에 저장되는 student_key
     * - 같은 학급(classId)에서는 항상 동일해야 한다.
     * - localStorage("quizmon_profile_key:{classId}")에 보관
     */
    const [effectiveStudentKey, setEffectiveStudentKey] = useState<string | null>(
        null,
    );

    // 동시에 여러 번 생성하는 것을 막기 위한 플래그
    const creatingRef = useRef(false);

    // 🔹 classId + rawStudentKey → effectiveStudentKey 정규화
    useEffect(() => {
        if (!classId || !rawStudentKey) {
            setEffectiveStudentKey(null);
            return;
        }

        if (typeof window === "undefined") {
            // 브라우저 환경이 아니면 아무 것도 하지 않음
            return;
        }

        const storageKey = `quizmon_profile_key:${classId}`;
        const stored = window.localStorage.getItem(storageKey);

        if (stored && stored.length > 0) {
            // 이미 저장된 키가 있으면 그걸 계속 사용
            if (stored !== rawStudentKey) {
                console.log(
                    "[useQuizmonProfile] student_key mismatch; keep stored key",
                    { classId, stored, rawStudentKey },
                );
            }
            setEffectiveStudentKey(stored);
        } else {
            // 처음 접속: 현재 rawStudentKey를 canonical 키로 저장
            window.localStorage.setItem(storageKey, rawStudentKey);
            setEffectiveStudentKey(rawStudentKey);
        }
    }, [classId, rawStudentKey]);

    const hasKey = !!classId && !!effectiveStudentKey;

    // 프로필 로딩 / 생성
    const refresh = useCallback(async () => {
        if (!hasKey || !classId || !effectiveStudentKey) {
            // 키가 없으면 그냥 비워주고 끝
            setProfile(null);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1) 기존 프로필 조회 (가장 오래된 1개만)
            const { data, error } = await supabase
                .from("quizmon_profiles")
                .select("*")
                .eq("class_id", classId)
                .eq("student_key", effectiveStudentKey)
                .order("created_at", { ascending: true })
                .limit(1);

            if (error) {
                console.error("[useQuizmonProfile] load profile error", error);
                setError("퀴즈몬 프로필을 불러오는 중 오류가 발생했습니다.");
                return;
            }

            const row = (data?.[0] ?? null) as QuizmonProfile | null;

            if (row) {
                setProfile(row);
                return;
            }

            // 2) 없으면 새로 생성 (upsert + onConflict 로 중복 방지)
            if (creatingRef.current) {
                // 이미 다른 refresh 가 생성 중이면 여기서는 그냥 종료
                return;
            }
            creatingRef.current = true;

            const { data: inserted, error: insertError } = await supabase
                .from("quizmon_profiles")
                .upsert(
                    {
                        class_id: classId,
                        student_key: effectiveStudentKey,
                        trainer_name: null,
                        starter_chosen: false,
                        total_raids: 0,
                        total_correct: 0,
                        total_questions: 0,
                    },
                    {
                        // DB 에 유니크 제약 걸어둔 (class_id, student_key) 기준
                        onConflict: "class_id,student_key",
                    },
                )
                .select("*")
                .single();

            if (insertError) {
                console.error(
                    "[useQuizmonProfile] insert/upsert profile error",
                    insertError,
                );
                setError("퀴즈몬 프로필 생성 중 오류가 발생했습니다.");
                return;
            }

            setProfile(inserted as QuizmonProfile);
        } finally {
            creatingRef.current = false;
            setLoading(false);
        }
    }, [hasKey, classId, effectiveStudentKey]);

    // 최초 및 key 변경 시 프로필 로딩
    useEffect(() => {
        void refresh();
    }, [refresh]);

    // 레이드 결과 반영 (프로필 쪽 누적 통계만)
    const applyRaidResult = useCallback(
        async (summary: { correct: number; total: number }) => {
            if (!hasKey || !profile) return;

            try {
                const { profile: updated } = await applyRaidResultService({
                    profile,   // 타입 캐스팅 필요 없음
                    summary,
                });

                setProfile(updated as QuizmonProfile);
                setError(null);

                // TODO: 나중에 토스트/결산 UI에 rewardedGold 보여주고 싶으면
                // 여기에서 별도 상태로 올리면 됨.
            } catch (e) {
                console.error("[useQuizmonProfile] applyRaidResult error", e);
                setError("레이드 결과를 저장하는 중 오류가 발생했습니다.");
            }
        },
        [hasKey, profile],
    );

    // 스타터 선택 + 첫 포켓몬 지급
    const chooseStarter = useCallback(
        async (speciesId: string) => {
            if (!hasKey || !profile) return;

            setLoading(true);
            setError(null);

            try {
                // 1) 프로필에 starter_chosen 표시
                const { data: updated, error: updateError } = await supabase
                    .from("quizmon_profiles")
                    .update({
                        starter_chosen: true,
                    })
                    .eq("id", profile.id)
                    .select("*")
                    .single();

                if (updateError) {
                    console.error(
                        "[useQuizmonProfile] chooseStarter update error",
                        updateError,
                    );
                    setError("스타터를 저장하는 중 오류가 발생했습니다.");
                    return;
                }

                if (updated) {
                    setProfile(updated as QuizmonProfile);
                }

                // 2) 이미 보유몬이 있으면 건너뛰기
                const { data: existing, error: ownedError } = await supabase
                    .from("quizmon_owned_monsters")
                    .select("id")
                    .eq("profile_id", profile.id)
                    .limit(1);

                if (ownedError) {
                    console.error(
                        "[useQuizmonProfile] chooseStarter owned check error",
                        ownedError,
                    );
                    return;
                }

                if (!existing || existing.length === 0) {
                    // 3) 첫 스타터 지급
                    const { error: insertOwnedError } = await supabase
                        .from("quizmon_owned_monsters")
                        .insert({
                            profile_id: profile.id,
                            species_id: speciesId,
                            level: 1,
                            exp: 0,
                            party_slot: 1,
                            current_hp: null, // null = 풀피
                            is_fainted: false,
                            // jsonb 컬럼이므로 JS 배열 넣으면 자동으로 JSON 배열로 저장됨
                            learned_moves: [],
                        });

                    if (insertOwnedError) {
                        console.error(
                            "[useQuizmonProfile] chooseStarter insert owned error",
                            insertOwnedError,
                        );
                    }
                }
            } finally {
                setLoading(false);
            }
        },
        [hasKey, profile],
    );

    return {
        profile,
        loading,
        error,
        refresh,
        applyRaidResult,
        chooseStarter,
    };
}
