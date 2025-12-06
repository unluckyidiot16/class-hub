// src/games/quizmon/useQuizmonProfile.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { QuizmonProfileRow, QuizmonOwnedMonsterRow } from "./types";
import {
    applyRaidResultService,
    buyExpDustWithGoldService,
    applyTrainerExpToProfile,
    TRAINER_EXP_PER_MONSTER,
} from "./quizmonService";

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
    const applyRaidResult = useCallback(
        async (summary: { correct: number; total: number }) => {
            if (!hasKey || !profile) return;

            try {
                // 1) 서비스 레이어에서 프로필 통계 + 골드 등 업데이트
                const { updatedProfile } = await applyRaidResultService({
                    profile,
                    summary,
                });

                // 프로필 id는 여기서 확정
                const nextProfile = (updatedProfile as QuizmonProfile) ?? profile;

                // 2) 파티 슬롯 1~3 몬스터 EXP 분배
                try {
                    const { data: owned, error: ownedError } = await supabase
                        .from("quizmon_owned_monsters")
                        .select("id, level, exp, party_slot")
                        .eq("profile_id", nextProfile.id)
                        .in("party_slot", [1, 2, 3])
                        .order("party_slot", { ascending: true });

                    if (ownedError) {
                        console.error(
                            "[useQuizmonProfile] applyRaidResult party load error",
                            ownedError,
                        );
                    } else {
                        const rows = (owned ?? []) as QuizmonOwnedMonsterRow[];

                        if (rows.length > 0) {
                            // ✅ EXP 간단 공식: 정답 수에 비례
                            const baseExp = Math.max(1, 5 + summary.correct * 2);

                            for (const row of rows) {
                                const isLeader = row.party_slot === 1; // 1번 슬롯 = 전투중 몬 취급
                                const gain = isLeader
                                    ? baseExp              // 메인 몬스터
                                    : Math.floor(baseExp / 2); // 나머지 파티

                                const newExp = (row.exp ?? 0) + gain;

                                const { error: upError } = await supabase
                                    .from("quizmon_owned_monsters")
                                    .update({ exp: newExp })
                                    .eq("id", row.id);

                                if (upError) {
                                    console.error(
                                        "[useQuizmonProfile] applyRaidResult update exp error",
                                        upError,
                                        row.id,
                                    );
                                }
                            }
                        }
                    }
                } catch (expErr) {
                    console.error(
                        "[useQuizmonProfile] applyRaidResult grant EXP error",
                        expErr,
                    );
                    // EXP 실패해도 프로필 저장까지 같이 실패할 필요는 없으니 여기선 에러만 로그
                }

                // 3) 프로필 로컬 상태 반영
                setProfile(nextProfile);
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
    // 스타터 선택 + 첫 포켓몬 지급 (+ 트레이너 EXP)
    const chooseStarter = useCallback(
        async ({ speciesId, trainerName }: { speciesId: string; trainerName: string }) => {
            if (!hasKey || !profile) return;

            setLoading(true);
            setError(null);

            const profileId = profile.id;

            try {
                // 1) 이름/스타터 선택 반영 + 포켓몬 획득 EXP 적용
                const trainerResult = applyTrainerExpToProfile(
                    {
                        ...profile,
                        trainer_name: trainerName,
                        starter_chosen: true,
                    },
                    TRAINER_EXP_PER_MONSTER, // 몬스터 1마리 획득 EXP
                );

                const leveledProfile = trainerResult.profile;

                const { data: updated, error: updateError } = await supabase
                    .from("quizmon_profiles")
                    .update({
                        trainer_name: leveledProfile.trainer_name,
                        starter_chosen: leveledProfile.starter_chosen,
                        trainer_level: leveledProfile.trainer_level,
                        trainer_exp: leveledProfile.trainer_exp,
                        gems: leveledProfile.gems,
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

                // 2) 이미 보유몬이 있으면 스타터 지급 스킵
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

                // TODO: trainerResult.gainedLevels / gainedGems 로
                // "첫 파트너 획득! 트레이너 레벨/젬 보상" UI도 나중에 띄울 수 있음.
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
