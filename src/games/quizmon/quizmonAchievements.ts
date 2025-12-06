// src/games/quizmon/quizmonAchievements.ts
import { supabase } from "../../lib/supabaseClient";

/**
 * quizmon_achievements 테이블 타입
 * (필드명/타입은 실제 스키마에 맞게 필요하면 조정해 주세요)
 */
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

/**
 * quizmon_profile_achievements 테이블 타입
 */
export type QuizmonProfileAchievementRow = {
    profile_id: string;
    achievement_id: string;
    progress: number;
    completed_at: string | null;
    reward_claimed_at: string | null;
};

/**
 * 프론트에서 쓰기 좋은 합쳐진 형태
 */
export type QuizmonAchievementWithProgress = {
    achievement: QuizmonAchievementRow;
    progress: number;
    completed: boolean;
    claimed: boolean;
    claimable: boolean;
};

/**
 * 특정 프로필의 업적 목록 + 진행도 로딩
 *
 * 1) 활성화된 업적(quizmon_achievements where is_active = true)
 * 2) 해당 프로필의 진행도(quizmon_profile_achievements where profile_id = ...)
 * 를 두 번에 나눠서 읽고 merge 합니다.
 */
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
        console.error("[quizmonAchievements] loadAchievements master error", achError);
        throw new Error("업적 정보를 불러오는 중 오류가 발생했습니다.");
    }

    // 2) 프로필별 진행도
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
        const completed = !!pa?.completed_at;
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
 * 업적 보상 수령 RPC
 *
 * ─ DB 쪽에서 만들어 둔 함수 이름/파라미터에 맞춰 호출합니다.
 *   여기서는 예시로:
 *
 *   create or replace function public.claim_quizmon_achievement_reward(
 *     _profile_id uuid,
 *     _achievement_code text
 *   ) ...
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
