// src/games/quizmon/quizmonAchievements.ts
import { supabase } from "../../lib/supabaseClient";

export type QuizmonAchievementRow = {
    id: string;
    code: string;
    title: string;
    description: string;
    category: string;
    condition_type: string;
    condition_value: number;
    reward_gems: number;
    is_active: boolean;
    created_at: string;
};

export type QuizmonProfileAchievementRow = {
    profile_id: string;
    achievement_id: string;
    progress: number;
    completed_at: string | null;
    reward_claimed_at: string | null;
};

export type QuizmonAchievementWithProgress = {
    achievement: QuizmonAchievementRow;
    progress: number;
    completed: boolean;
    claimed: boolean;
    claimable: boolean;
};

export async function loadAchievementsForProfile(
    profileId: string,
): Promise<QuizmonAchievementWithProgress[]> {
    if (!profileId) return [];

    // 1) 업적 마스터
    const { data: achRows, error: achError } = await supabase
        .from("quizmon_achievements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

    if (achError) {
        console.error(
            "[quizmonAchievements] loadAchievements master error",
            achError,
        );
        throw new Error("업적 정보를 불러오는 중 오류가 발생했습니다.");
    }

    // 2) 프로필별 진행/보상 상태
    const { data: progressRows, error: progressError } = await supabase
        .from("quizmon_profile_achievements")
        .select("*")
        .eq("profile_id", profileId);

    if (progressError) {
        console.error(
            "[quizmonAchievements] loadAchievements progress error",
            progressError,
        );
        throw new Error("업적 진행도를 불러오는 중 오류가 발생했습니다.");
    }

    const progressByAchievementId = new Map<
        string,
        QuizmonProfileAchievementRow
    >();
    for (const row of progressRows ?? []) {
        progressByAchievementId.set(row.achievement_id, row);
    }

    const result: QuizmonAchievementWithProgress[] = [];

    for (const a of (achRows ?? []) as QuizmonAchievementRow[]) {
        const pa = progressByAchievementId.get(a.id);
        const progress = pa?.progress ?? 0;
        const target = a.condition_value ?? 0;

        const completed = progress >= target && target > 0;
        const claimed = !!pa?.reward_claimed_at;
        const claimable = completed && !claimed && a.reward_gems > 0;

        result.push({
            achievement: a,
            progress,
            completed,
            claimed,
            claimable,
        });
    }

    return result;
}

/**
 * 업적 보상 수령 RPC (기존 그대로)
 */
export async function claimAchievementRewardRpc(
    profileId: string,
    achievementCode: string,
): Promise<void> {
    if (!profileId || !achievementCode) {
        throw new Error("잘못된 프로필/업적 코드입니다.");
    }

    const { error } = await supabase.rpc(
        "claim_quizmon_achievement_reward",
        {
            _profile_id: profileId,
            _achievement_code: achievementCode,
        },
    );

    if (error) {
        console.error(
            "[quizmonAchievements] claimAchievementRewardRpc error",
            error,
        );
        throw new Error(
            error.message || "업적 보상을 받는 중 오류가 발생했습니다.",
        );
    }
}

/*
 * 전투/퀴즈/레이드 등 이벤트 발생 시 업적 진행도를 증가시키는 헬퍼
 *
 * - _event_type 값은 quizmon_achievements.condition_type 과 일치해야 함
 *   예: 'battle_clear', 'quiz_correct', 'raid_participation', 'raid_clear',
 *       'dex_register', 'monster_owned' 등
 */
export async function pushAchievementEvent(
    profileId: string | null | undefined,
    eventType: string,
    delta: number = 1,
): Promise<void> {
    if (!profileId) return;
    if (!eventType) return;
    if (!Number.isFinite(delta) || delta <= 0) return;

    const { error } = await supabase.rpc(
        "update_quizmon_achievement_progress",
        {
            _profile_id: profileId,
            _event_type: eventType,
            _delta: delta,
        },
    );

    if (error) {
        console.error(
            "[quizmonAchievements] pushAchievementEvent error",
            error,
        );
        // 업적만 안 오르게 두고 게임 흐름은 그대로
    }
}
