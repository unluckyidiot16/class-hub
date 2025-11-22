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

function calcTurnDamage(correct: number, total: number): number {
    const MAX_DAMAGE_PER_TURN = 10;
    if (total <= 0) return 0;
    const accuracy = correct / total;
    return Math.round(MAX_DAMAGE_PER_TURN * accuracy);
}

// 간단한 exp/레벨 규칙 (Phase 2에서 본격 사용, 지금은 뼈대만)
function addExp(partner: QuizmonPartner, gainedExp: number): QuizmonPartner {
    const LEVEL_CAP = 10;

    let { level, exp } = partner;
    exp += gainedExp;

    const needExpForLevel = (lv: number) => 5 * lv; // 예: 1→2:5, 2→3:10 ...

    while (level < LEVEL_CAP && exp >= needExpForLevel(level)) {
        exp -= needExpForLevel(level);
        level += 1;
    }

    return { ...partner, level, exp };
}

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
                            coins: 0,
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

            const { correct, total } = params;
            const damage = calcTurnDamage(correct, total);
            const gainedExp = Math.max(1, damage);
            const gainedCoins = correct;

            // 1) 코인 지급 (RPC)
            try {
                if (gainedCoins > 0 && classId) {
                    await grantQuizmonCoins({
                        classId,
                        studentKey,
                        amount: gainedCoins,
                        reason: "raid_correct",
                    });
                }
            } catch (e) {
                console.error("[useQuizmonProfile] grantQuizmonCoins error", e);
            }

            // 2) 프로필 파트너 레벨업
            const newPartner = addExp(profile.partner, gainedExp);

            const { error } = await supabase
                .from("quizmon_profiles")
                .update({
                    partner: newPartner,
                    total_raids: profile.total_raids + 1,
                    total_correct: profile.total_correct + correct,
                    total_questions: profile.total_questions + total,
                })
                .eq("id", profile.id);

            if (error) {
                console.error("[useQuizmonProfile] update error", error);
                setError("레이드 결과 저장 중 오류가 발생했습니다.");
                return;
            }

            // 3) 🔹 현재는 파티 1번 슬롯을 '파트너'로 간주하고 owned 몬스터도 동기화
            try {
                await supabase
                    .from("quizmon_owned_monsters")
                    .update({
                        level: newPartner.level,
                        exp: newPartner.exp,
                    })
                    .eq("profile_id", profile.id)
                    .eq("party_slot", 1); // v1: 파티 1번 = 메인 파트너
            } catch (e) {
                console.error(
                    "[useQuizmonProfile] update owned_monster level/exp error",
                    e,
                );
                // 여기 실패해도 fatal은 아니고, 다음 리셋 때만 레벨이 안맞을 뿐이라 log만 남겨도 됨
            }

            // 4) 최신 값(코인 포함)을 다시 읽도록 트리거
            setReloadFlag((x) => x + 1);
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
