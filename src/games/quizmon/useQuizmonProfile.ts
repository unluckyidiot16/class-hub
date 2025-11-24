// src/games/quizmon/useQuizmonProfile.ts
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { QuizmonPartner, QuizmonProfileRow } from "./types";
import { DEFAULT_PARTNER } from "./types";
import { grantQuizmonCoins } from "../../api/quizmonRewards";

type UseQuizmonProfileOptions = {
    classId: string | null;
    studentKey: string | null;
};

type UseQuizmonProfileResult = {
    profile: QuizmonProfileRow | null;
    loading: boolean;
    error: string | null;
    refresh: () => void;

    applyRaidResult: (params: {
        correct: number;
        total: number;
    }) => Promise<void>;

    // 🔹 새로 추가
    chooseStarter: (speciesId: string) => Promise<void>;
};

export function useQuizmonProfile(
    options: UseQuizmonProfileOptions,
): UseQuizmonProfileResult {
    const { classId, studentKey } = options;

    const [profile, setProfile] = useState<QuizmonProfileRow | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reloadFlag, setReloadFlag] = useState(0);

    useEffect(() => {
        if (!studentKey || !classId) return;

        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                // 1) 기존 프로필 조회
                const { data, error } = await supabase
                    .from("quizmon_profiles")
                    .select("*")
                    .eq("class_id", classId)
                    .eq("student_key", studentKey)
                    .maybeSingle();

                if (error && error.code !== "PGRST116") {
                    console.error("[useQuizmonProfile] select error", error);
                    if (!cancelled)
                        setError(error.message ?? "프로필을 불러오는 중 오류가 발생했습니다.");
                    return;
                }

                if (!data) {
                    const { data: inserted, error: insertError } = await supabase
                        .from("quizmon_profiles")
                        .insert({
                            class_id: classId,
                            student_key: studentKey,
                            partner: DEFAULT_PARTNER,
                            trainer_name: null,
                            starter_species_id: null,
                            starter_chosen: false,

                            // 경제 필드 기본값
                            coins: 0,        // 레거시
                            gold: 0,
                            gacha_gems: 0,
                            star_shards: 0,
                        })
                        .select("*")
                        .single();


                    if (insertError) {
                        console.error("[useQuizmonProfile] insert error", insertError);
                        if (!cancelled)
                            setError(insertError.message ?? "새 프로필을 만드는 중 오류가 발생했습니다.");
                        return;
                    }

                    if (!cancelled) {
                        setProfile(inserted as QuizmonProfileRow);
                    }
                } else {
                    if (!cancelled) {
                        setProfile(data as QuizmonProfileRow);
                    }
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [classId, studentKey, reloadFlag]);

    const refresh = useCallback(() => {
        setReloadFlag((x) => x + 1);
    }, []);

    // 레이드 끝났을 때 정답/문항 수를 반영해서 프로필 갱신
    const applyRaidResult = useCallback(
        async (params: { correct: number; total: number }) => {
            if (!profile || !studentKey) return;

            const safeCorrect = Math.max(0, params.correct ?? 0);
            const safeTotal = Math.max(0, params.total ?? 0);

            // 1) 코인 지급 (RPC) - 기존 로직 유지
            try {
                if (safeCorrect > 0 && classId) {
                    await grantQuizmonCoins({
                        classId,
                        studentKey,
                        amount: safeCorrect,
                        reason: "raid_correct",
                    });
                }
            } catch (e) {
                console.error("[useQuizmonProfile] grantQuizmonCoins error", e);
            }

            // 2) 프로필 통계만 업데이트 (레벨/exp/파트너/파티는 건드리지 않음)
            const updates: Partial<QuizmonProfileRow> = {
                total_raids: (profile.total_raids ?? 0) + 1,
                total_correct: (profile.total_correct ?? 0) + safeCorrect,
                total_questions: (profile.total_questions ?? 0) + safeTotal,
            };

            const { data, error } = await supabase
                .from("quizmon_profiles")
                .update(updates)
                .eq("id", profile.id)
                .select("*")
                .single();

            if (error) {
                console.error("[useQuizmonProfile] update error", error);
                setError("레이드 결과 저장 중 오류가 발생했습니다.");
                return;
            }

            // 3) 최신 프로필을 바로 메모리에도 반영
            setProfile(data as QuizmonProfileRow);
        },
        [profile, studentKey, classId],
    );





    // 🔹 스타터 선택 헬퍼
    const chooseStarter = useCallback(
        async (speciesId: string) => {
            if (!profile || !studentKey) return;

            // 1) 프로필에 파트너 / starter 정보 반영
            const starterPartner: QuizmonPartner = {
                speciesId,
                level: 1,
                exp: 0,
            };

            const { data, error } = await supabase
                .from("quizmon_profiles")
                .update({
                    partner: starterPartner,
                    starter_species_id: speciesId,
                    starter_chosen: true,
                })
                .eq("id", profile.id)
                .select("*")
                .single();

            if (error) {
                console.error("[useQuizmonProfile] chooseStarter update error", error);
                setError("스타터를 선택하는 중 오류가 발생했습니다.");
                return;
            }

            const updated = data as QuizmonProfileRow;
            setProfile(updated);

            // 2) 소유 몬스터 테이블에도 스타터 1마리 추가 (파티 1번 슬롯)
            try {
                await supabase.from("quizmon_owned_monsters").insert({
                    profile_id: updated.id,
                    species_id: speciesId,
                    level: starterPartner.level,
                    exp: starterPartner.exp,
                    party_slot: 1,

                    // 새 필드
                    current_hp: null,    // 전투 입장 시 종/레벨 기준으로 계산해서 채우기
                    is_fainted: false,
                    learned_moves: [],   // 나중에 moveData에서 기본 기술 채워도 됨
                });
            } catch (e) {
                // 여기 실패해도 치명적이지 않으니 콘솔만 남김
                console.error(
                    "[useQuizmonProfile] chooseStarter insert owned_monster error",
                    e,
                );
            }
        },
        [profile, studentKey],
    );

    return { profile, loading, error, refresh, applyRaidResult, chooseStarter };
}
