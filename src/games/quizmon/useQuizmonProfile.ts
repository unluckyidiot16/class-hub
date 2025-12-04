// src/games/quizmon/useQuizmonProfile.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { QuizmonProfileRow } from "./types";
import { applyRaidResultService, buyExpDustWithGoldService } from "./quizmonService";

// 실제 DB 스키마와 1:1 대응
export type QuizmonProfile = QuizmonProfileRow;

type UseQuizmonProfileParams = {
    classId: string | null;
    /** StudentRoomPage에서 내려주는 원본 student_key */
    studentKey: string | null;
};

export type UseQuizmonProfileResult = {
    profile: QuizmonProfile | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    applyRaidResult: (summary: { correct: number; total: number }) => Promise<void>;
    chooseStarter: (payload: {
        speciesId: string;
        trainerName: string;
    }) => Promise<void>;
    buyExpDust: (quantity?: number) => Promise<{ spentGold: number; gainedExpDust: number } | void>;
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
                        // 🔹 경제 필드 초기값 (NOT NULL + DEFAULT 0 이더라도 명시적으로 넣어 줌)
                        gold: 0,
                        gems: 0,
                        star_shards: 0,
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

    // 레이드 결과 반영 (프로필 쪽 누적 통계 + 골드 지급)
    // 레이드 결과 반영 (프로필 쪽 누적 통계 + 골드 지급)
    const applyRaidResult = useCallback(
        async (summary: { correct: number; total: number }) => {
            if (!hasKey || !profile) return;

            try {
                // 서비스 레이어에서 DB 업데이트
                const { updatedProfile } = await applyRaidResultService({
                    profile,
                    summary,
                });

                // 서버가 돌려준 최신 프로필로 로컬 상태 동기화
                if (updatedProfile) {
                    setProfile(updatedProfile as QuizmonProfile);
                }
                setError(null);
            } catch (e) {
                console.error(
                    "[useQuizmonProfile] applyRaidResult error",
                    e,
                );
                setError("레이드 결과를 저장하는 중 오류가 발생했습니다.");
            }
        },
        [hasKey, profile],
    );


    const buyExpDust = useCallback(
        async (quantity: number = 1) => {
            if (!profile) return;

            try {
                const { updatedProfile, spentGold, gainedExpDust } =
                    await buyExpDustWithGoldService({
                        profileId: profile.id,
                        quantity,
                    });

                setProfile(updatedProfile);
                setError(null);

                console.log(
                    "[useQuizmonProfile] buyExpDust",
                    { spentGold, gainedExpDust },
                );

                return { spentGold, gainedExpDust };
            } catch (e: any) {
                console.error("[useQuizmonProfile] buyExpDust error", e);
                setError(e?.message ?? "Exp Dust를 구매하는 중 오류가 발생했습니다.");
                throw e;
            }
        },
        [profile],
    );


    // 스타터 선택 + 첫 포켓몬 지급
    // 스타터 선택 + 첫 포켓몬 지급
    const chooseStarter = useCallback(
        async ({ speciesId, trainerName }: { speciesId: string; trainerName: string }) => {
            if (!hasKey || !profile) return;

            setLoading(true);
            setError(null);

            const profileId = profile.id;

            try {
                // 1) 프로필에 이름 + 스타터 선택 + 레벨/경험치 초기값 반영
                const { data: updated, error: updateError } = await supabase
                    .from("quizmon_profiles")
                    .update({
                        trainer_name: trainerName,
                        starter_chosen: true,
                        trainer_level: 1,
                        trainer_exp: 0,
                    })
                    .eq("id", profileId)
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
                    .eq("profile_id", profileId)
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
                            profile_id: profileId,
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
        buyExpDust,
    };
}
