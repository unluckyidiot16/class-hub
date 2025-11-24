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


/**
 * 레이드 결과를 quizmon_profiles에 반영하고, 기본 보상(gold 등)을 지급한다.
 *
 * ⚠️ 아래 상수만 바꿔서 보상 튜닝 가능
 */
const GOLD_PER_CORRECT = 10;
const GOLD_CLEAR_BONUS = 0; // 던전 클리어 기본 보상 등 필요하면 사용

export type ApplyRaidResultResponse = {
    profile: QuizmonProfileRow;
    rewardedGold: number;
};

export async function applyRaidResultService(
    options: ApplyRaidResultOptions,
): Promise<ApplyRaidResultResponse> {
    const { profile, summary } = options;

    const nextTotalRaids = (profile.total_raids ?? 0) + 1;
    const nextTotalCorrect = (profile.total_correct ?? 0) + summary.correct;
    const nextTotalQuestions =
        (profile.total_questions ?? 0) + summary.total;

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

// pullGacha 관련 Supabase 조작은 useGachaDraw 훅에서
// 같은 패턴으로 빼면 됨.
// 예:
// export async function pullGachaService(options: { profile: QuizmonProfileRow; ... }) { ... }
