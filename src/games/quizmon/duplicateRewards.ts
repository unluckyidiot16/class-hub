// src/games/quizmon/duplicateRewards.ts
import type {
    QuizmonProfileRow,
    QuizmonOwnedMonsterRow,
    QuizmonSpeciesRow,
} from "./types";
import { supabase } from "../../lib/supabaseClient";

export type AcquisitionSource = "capture" | "gacha";

export type GrantMonsterOrShardsResult =
    | {
    kind: "new-monster";
    monster: QuizmonOwnedMonsterRow;
    profile: QuizmonProfileRow;
    shardsGained: 0;
}
    | {
    kind: "duplicate";
    monster: null;
    profile: QuizmonProfileRow;
    shardsGained: number;
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

// 몬스터 생성 시 기본값 (기존 QuizmonProvider starter insert 참고)
function getNewOwnedMonsterPayload(
    profileId: string,
    speciesId: string,
): Omit<QuizmonOwnedMonsterRow, "id" | "created_at" | "updated_at"> {
    return {
        profile_id: profileId,
        species_id: speciesId,
        level: 1,
        exp: 0,
        party_slot: null,      // 자동 파티 편성 안 함 (UI에서 관리)
        current_hp: null,      // 배틀 입장 시 계산
        is_fainted: false,
        learned_moves: [] as string[],
        // 필요하면 나중에 obtain_method 같은 필드도 추가
    } as any;
}

/**
 * ✅ 핵심: 주어진 프로필 + 종에 대해
 *   - 처음이면 → owned_monsters insert
 *   - 이미 있으면 → star_shards 증가
 */
export async function grantMonsterOrShards(opts: {
    profile: QuizmonProfileRow;
    species: QuizmonSpeciesRow;
    source: AcquisitionSource;
}): Promise<GrantMonsterOrShardsResult> {
    const { profile, species } = opts;

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

        return {
            kind: "new-monster",
            monster: inserted as QuizmonOwnedMonsterRow,
            profile, // 프로필은 그대로 (샤드 변화 없음)
            shardsGained: 0,
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
        monster: null,
        profile: updatedProfile as QuizmonProfileRow,
        shardsGained: shardAmount,
    };
}
