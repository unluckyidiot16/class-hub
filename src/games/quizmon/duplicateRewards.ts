// src/games/quizmon/grantMonsterOrShards.ts (가칭)

import type {
    QuizmonProfileRow,
    QuizmonOwnedMonsterRow,
    QuizmonSpeciesRow,
} from "./types";
import { supabase } from "../../lib/supabaseClient";
import { pushAchievementEvent } from "./quizmonAchievements";

export type AcquisitionSource = "capture" | "gacha";

export type GrantMonsterOrShardsResult =
    | {
    kind: "new-monster";
    ownedMonster: QuizmonOwnedMonsterRow;
    profile: QuizmonProfileRow;
    shardsAwarded: 0;
}
    | {
    kind: "duplicate";
    ownedMonster: null;
    profile: QuizmonProfileRow;
    shardsAwarded: number;
};

// ✅ 희귀도에 따른 샤드 보상량 계산
export function calcShardRewardForDuplicate(
    species: QuizmonSpeciesRow,
): number {
    const rarity = species.rarity ?? 1; // 1~5 가정
    const BASE = 5;
    const PER_RARITY = 3;
    return BASE + (rarity - 1) * PER_RARITY;
}

// 🔹 프로필 스탯 갱신 RPC 호출 헬퍼
async function refreshQuizmonProfileStats(profileId: string) {
    const { error } = await supabase.rpc("refresh_quizmon_profile_stats", {
        _profile_id: profileId,
    });

    if (error) {
        console.error(
            "[grantMonsterOrShards] refresh_quizmon_profile_stats error",
            error,
        );
    }
}

// 몬스터 생성 시 기본값
function getNewOwnedMonsterPayload(
    profileId: string,
    speciesId: string,
): Omit<QuizmonOwnedMonsterRow, "id" | "created_at" | "updated_at"> {
    return {
        profile_id: profileId,
        species_id: speciesId,
        level: 1,
        exp: 0,
        party_slot: null,
        current_hp: null,
        is_fainted: false,
        learned_moves: [] as string[],
    } as any;
}

/**
 * ✅ 핵심: 주어진 프로필 + 종에 대해
 *   - 처음이면 → owned_monsters insert + monster_owned 업적 이벤트 + 프로필 스탯 갱신
 *   - 이미 있으면 → star_shards 증가
 */
export async function grantMonsterOrShards(opts: {
    profileId: string;
    speciesId: string;
    source: AcquisitionSource;
}): Promise<GrantMonsterOrShardsResult> {
    const { profileId, speciesId } = opts;

    // 0) 프로필 로드
    const { data: profileRow, error: profileError } = await supabase
        .from("quizmon_profiles")
        .select("*")
        .eq("id", profileId)
        .maybeSingle();

    if (profileError || !profileRow) {
        console.error(
            "[grantMonsterOrShards] profile select error",
            profileError,
        );
        throw profileError ?? new Error("profile not found");
    }

    const profile = profileRow as QuizmonProfileRow;

    // 0-1) 종 정보 로드
    const { data: speciesRow, error: speciesError } = await supabase
        .from("quizmon_species")
        .select("*")
        .eq("id", speciesId)
        .maybeSingle();

    if (speciesError || !speciesRow) {
        console.error(
            "[grantMonsterOrShards] species select error",
            speciesError,
        );
        throw speciesError ?? new Error("species not found");
    }

    const species = speciesRow as QuizmonSpeciesRow;

    // 1) 이미 이 종을 가진 적 있는지 확인
    const { data: ownedRows, error: ownedError } = await supabase
        .from("quizmon_owned_monsters")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("species_id", species.id);

    if (ownedError) {
        console.error("[grantMonsterOrShards] owned check error", ownedError);
        throw ownedError;
    }

    const alreadyOwned = (ownedRows ?? []).length > 0;

    if (!alreadyOwned) {
        // ✅ 처음 획득 → 몬스터 생성
        const payload = getNewOwnedMonsterPayload(profile.id, species.id);

        const { data: inserted, error: insertError } = await supabase
            .from("quizmon_owned_monsters")
            .insert(payload)
            .select("*")
            .single();

        if (insertError || !inserted) {
            console.error(
                "[grantMonsterOrShards] insert owned_monster error",
                insertError,
            );
            throw insertError ?? new Error("insert failed");
        }

        // ✅ 업적 이벤트: 처음 소유한 퀴즈몬 수
        void pushAchievementEvent(profileId, "monster_owned", 1);

        // ✅ 프로필 스탯 갱신 (total_owned_monsters, dex_species_count 등)
        void refreshQuizmonProfileStats(profileId);

        return {
            kind: "new-monster",
            ownedMonster: inserted as QuizmonOwnedMonsterRow,
            profile, // 샤드는 안 변했으니 이전 프로필 그대로
            shardsAwarded: 0,
        };
    }

    // ✅ 중복 → Star Shards 지급
    const shardAmount = calcShardRewardForDuplicate(species);
    const currentShards = profile.star_shards ?? 0;
    const newShards = currentShards + shardAmount;

    const { data: updatedProfile, error: updateError } = await supabase
        .from("quizmon_profiles")
        .update({ star_shards: newShards })
        .eq("id", profile.id)
        .select("*")
        .single();

    if (updateError || !updatedProfile) {
        console.error(
            "[grantMonsterOrShards] update star_shards error",
            updateError,
        );
        throw updateError ?? new Error("update profile failed");
    }

    return {
        kind: "duplicate",
        ownedMonster: null,
        profile: updatedProfile as QuizmonProfileRow,
        shardsAwarded: shardAmount,
    };
}
