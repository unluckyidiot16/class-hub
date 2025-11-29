// src/services/quizmonService.ts
import { supabase } from "../lib/supabaseClient";
import type { QuizmonOwnedMonsterRow } from "../games/quizmon/types";

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
    rewardedGold: number;
};

/**
 * 레이드 결과를 quizmon_profiles 에 반영 + Gold 지급
 * - UPDATE만 수행하고, 다시 SELECT해서 읽어오지는 않는다.
 * - UI 쪽 로컬 상태 업데이트는 호출한 쪽에서 처리.
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

    const { error } = await supabase
        .from("quizmon_profiles")
        .update({
            total_raids: nextTotalRaids,
            total_correct: nextTotalCorrect,
            total_questions: nextTotalQuestions,
            gold: nextGold,
        })
        .eq("id", profile.id);

    if (error) {
        throw error;
    }

    return { rewardedGold };
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
 * 전투 종료 후 HP/기절 상태 저장용 타입
 */
export type BattleHpResult = {
    ownedId: string;   // quizmon_owned_monsters.id
    currentHp: number; // 전투 종료 시점 HP (0 이상)
    maxHp: number;     // 안전하게 clamp 하기 위함
};

/**
 * 전투 종료 후 HP/기절 상태를 quizmon_owned_monsters 에 반영
 * - current_hp <= 0 이면 0으로 고정 + is_fainted = true
 * - 그 외에는 1 ~ maxHp 사이로 clamp
 */
export async function saveBattleHpResultsService(
    profileId: string,
    results: BattleHpResult[],
): Promise<void> {
    if (!profileId || !results.length) return;

    const rows = results.map((r) => {
        const hp = r.currentHp <= 0 ? 0 : Math.min(r.currentHp, r.maxHp);
        return {
            id: r.ownedId,
            profile_id: profileId,
            current_hp: hp,
            is_fainted: hp <= 0,
        };
    });

    const { error } = await supabase
        .from("quizmon_owned_monsters")
        .upsert(rows, { onConflict: "id" });

    if (error) {
        throw error;
    }
}




// pullGachaService 등은 같은 패턴으로 여기 아래에 추가 예정
