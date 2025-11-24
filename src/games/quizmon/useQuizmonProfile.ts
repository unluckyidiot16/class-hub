// src/games/quizmon/useQuizmonProfile.ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// 실제 테이블 스키마에 맞게 최소 필드만 정의
// (필요하면 나중에 필드 더 추가해도 됨)
export type QuizmonProfile = {
    id: string;
    class_id: string;
    student_key: string; // ← 만약 컬럼명이 student_key라면 여기와 아래 쿼리에서 이름만 바꿔주면 됨
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
    const { classId, studentKey } = params;

    const [profile, setProfile] = useState<QuizmonProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 단순 플래그: Hook 호출 여부가 아니라 effect 안에서 분기할 때만 사용
    const hasKey = !!classId && !!studentKey;

    // 프로필 로딩 / 생성
    const refresh = useCallback(async () => {
        if (!hasKey) {
            // 키가 없으면 그냥 비워주고 끝
            setProfile(null);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1) 기존 프로필 조회
            const { data, error } = await supabase
                .from("quizmon_profiles")
                .select("*")
                .eq("class_id", classId)
                .eq("student_key", studentKey) // ← 컬럼명이 다르면 여기만 수정
                .maybeSingle();

            if (error) {
                console.error("[useQuizmonProfile] load profile error", error);
                setError("퀴즈몬 프로필을 불러오는 중 오류가 발생했습니다.");
                return;
            }

            if (!data) {
                // 2) 없으면 새로 생성
                const { data: inserted, error: insertError } = await supabase
                    .from("quizmon_profiles")
                    .insert({
                        class_id: classId,
                        student_key: studentKey,
                        trainer_name: null,
                        starter_chosen: false,
                        total_raids: 0,
                        total_correct: 0,
                        total_questions: 0,
                    })
                    .select("*")
                    .single();

                if (insertError) {
                    console.error(
                        "[useQuizmonProfile] insert profile error",
                        insertError,
                    );
                    setError("퀴즈몬 프로필 생성 중 오류가 발생했습니다.");
                    return;
                }

                setProfile(inserted as QuizmonProfile);
            } else {
                setProfile(data as QuizmonProfile);
            }
        } finally {
            setLoading(false);
        }
    }, [hasKey, classId, studentKey]);

    // 최초 및 key 변경 시 프로필 로딩
    useEffect(() => {
        void refresh();
    }, [refresh]);

    // 레이드 결과 반영 (프로필 쪽 누적 통계만)
    const applyRaidResult = useCallback(
        async (summary: { correct: number; total: number }) => {
            if (!hasKey || !profile) return;

            const nextTotalRaids = (profile.total_raids ?? 0) + 1;
            const nextTotalCorrect =
                (profile.total_correct ?? 0) + summary.correct;
            const nextTotalQuestions =
                (profile.total_questions ?? 0) + summary.total;

            const { data, error } = await supabase
                .from("quizmon_profiles")
                .update({
                    total_raids: nextTotalRaids,
                    total_correct: nextTotalCorrect,
                    total_questions: nextTotalQuestions,
                })
                .eq("id", profile.id)
                .select("*")
                .single();

            if (error) {
                console.error(
                    "[useQuizmonProfile] applyRaidResult error",
                    error,
                );
                setError("레이드 결과를 저장하는 중 오류가 발생했습니다.");
                return;
            }

            if (data) {
                setProfile(data as QuizmonProfile);
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
