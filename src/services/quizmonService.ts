// src/services/quizmonService.ts
import { supabase } from "../lib/supabaseClient";
import type {
    QuizmonProfileRow,
    QuizmonOwnedMonsterRow,
} from "../games/quizmon/types";

/**
 * 레이드/배틀 1회 결과 요약
 */
export type RaidSummary = {
    correct: number;
    total: number;
};

// 레이드 결과 반영에 필요한 최소 필드만 받도록 느슨하게 정의
type RaidProfileInput = {
    id: string;
    total_raids?: number | null;
    total_correct?: number | null;
    total_questions?: number | null;
    gold?: number | null;
};

export type ApplyRaidResultOptions = {
    profile: RaidProfileInput;
    summary: RaidSummary;
};

export type ApplyRaidResultResponse = {
    profile: QuizmonProfileRow;
    rewardedGold: number;
};

/**
 * 레이드 결과를 quizmon_profiles 에 반영 + Gold 지급
 */
export async function applyRaidResultService(
    options: ApplyRaidResultOptions,
): Promise<ApplyRaidResultResponse> {
    const { profile, summary } = options;

    const nextTotalRaids = (profile.total_raids ?? 0) + 1;
    const nextTotalCorrect = (profile.total_correct ?? 0) + summary.correct;
    const nextTotalQuestions =
        (profile.total_questions ?? 0) + summary.total;

    const GOLD_PER_CORRECT = 10;
    const GOLD_CLEAR_BONUS = 0;

    const rewardedGold =
        summary.correct * GOLD_PER_CORRECT + GOLD_CLEAR_BONUS;
    const nextGold = (profile.gold ?? 0) + rewardedGold;

    const { data, error } = await supabase
        .from("quizmon_profiles")
        .update({
            total_raids: nextTotalRaids,
            total_correct: nextTotalCorrect,
            total_questions: nextTotalQuestions,
            gold: nextGold,
        })
        .eq("id", profile.id)
        // 🔸 여기가 핵심: "*:1" 같은 거 절대 없음
        .select("*")
        .single();

    if (error || !data) {
        throw error ?? new Error("applyRaidResultService: empty response");
    }

    return {
        profile: data as QuizmonProfileRow,
        rewardedGold,
    };
}

/**
 * 보유 몬스터 전체 조회
 */
export async function fetchOwnedMonstersService(
    profileId: string,
): Promise<QuizmonOwnedMonsterRow[]> {
    const { data, error } = await supabase
        .from("quizmon_owned_monsters")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: true });

    if (error) {
        throw error;
    }

    return (data ?? []) as QuizmonOwnedMonsterRow[];
}

/**
 * 보유 몬스터 전체 회복
 */
export async function healAllMonstersService(
    profileId: string,
): Promise<void> {
    const { error } = await supabase
        .from("quizmon_owned_monsters")
        .update({
            current_hp: null,
            is_fainted: false,
        })
        .eq("profile_id", profileId);

    if (error) {
        throw error;
    }
}

// pullGachaService 등은 같은 패턴으로 여기 아래에 추가 예정
