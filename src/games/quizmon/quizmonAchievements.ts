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

    // 3) 프로필 요약 스탯 (퀴즈 정답 수, 배틀 클리어 수, 레이드 참여 수 등)
    const { data: profileRow, error: profileError } = await supabase
        .from("quizmon_profiles")
        .select("id, total_battles, total_correct, total_raids")
        .eq("id", profileId)
        .maybeSingle();

    if (profileError) {
        console.warn(
            "[quizmonAchievements] loadAchievements profile stats error",
            profileError,
        );
    }

    const anyProfile = (profileRow ?? {}) as any;
    const totalBattles: number = anyProfile.total_battles ?? 0;
    const totalCorrect: number = anyProfile.total_correct ?? 0;
    const totalRaids: number = anyProfile.total_raids ?? 0;

    // 4) 보유 몬스터/도감 정보
    const { data: ownedRows, error: ownedError } = await supabase
        .from("quizmon_owned_monsters")
        .select("species_id")
        .eq("profile_id", profileId);

    if (ownedError) {
        console.warn(
            "[quizmonAchievements] loadAchievements owned error",
            ownedError,
        );
    }

    const ownedList = ownedRows ?? [];
    const monsterOwnedCount = ownedList.length;
    const dexRegisterCount = new Set(
        ownedList.map((r: any) => r.species_id as string),
    ).size;

    // 5) merge
    const result: QuizmonAchievementWithProgress[] = [];

    for (const a of (achRows ?? []) as QuizmonAchievementRow[]) {
        const pa = progressByAchievementId.get(a.id);

        // condition_type 별로 진행도 계산
        let derivedProgress: number | null = null;
        switch (a.condition_type) {
            case "quiz_correct":
                derivedProgress = totalCorrect;
                break;
            case "battle_clear":
                derivedProgress = totalBattles;
                break;
            case "raid_participation":
                derivedProgress = totalRaids;
                break;
            case "monster_owned":
                derivedProgress = monsterOwnedCount;
                break;
            case "dex_register":
                derivedProgress = dexRegisterCount;
                break;
            default:
                // 나중에 이벤트형 업적 추가 시, DB에 저장된 progress 사용
                derivedProgress = null;
                break;
        }

        const storedProgress = pa?.progress ?? 0;
        const progress =
            derivedProgress != null ? derivedProgress : storedProgress;

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
