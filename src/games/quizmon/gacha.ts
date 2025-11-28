// src/games/quizmon/gacha.ts
import { supabase } from "../../lib/supabaseClient";
import type {
    QuizmonOwnedMonsterRow,
    QuizmonProfileRow,
    QuizmonSpeciesRow,
} from "./types";

// TODO: 나중에 rarity 기반으로 확장
const GACHA_POOL: string[] = ["poke-0001", "poke-0004", "poke-0007"];

function rollSpeciesId(): string {
    const idx = Math.floor(Math.random() * GACHA_POOL.length);
    return GACHA_POOL[idx];
}

export type GachaCostType = "gems" | "free"; // ← 타입은 유지하되
// 실제 게임에서는 "gems"만 사용(테스트용으로 free 남겨둔 상태)

export type GachaDrawResult = {
    kind: "new" | "duplicate";
    species: QuizmonSpeciesRow;
    ownedMonster: QuizmonOwnedMonsterRow | null;
    starShardsGained: number;
    gachaGemsConsumed: number;
};

export async function performSingleGachaDraw(params: {
    profile: QuizmonProfileRow;
    costType?: GachaCostType;
}): Promise<{ result: GachaDrawResult; updatedProfile: QuizmonProfileRow }> {
    const { profile, costType = "gems" } = params;
    const profileId = profile.id;

    const currentGems = profile.gems ?? 0;
    const gemCost = costType === "gems" ? 1 : 0;

    if (gemCost > 0 && currentGems < gemCost) {
        throw new Error("가챠 재화가 부족합니다.");
    }

    // 1) 종 선택
    const speciesId = rollSpeciesId();

    // 2) 해당 프로필의 owned_monsters 불러오기
    const { data: ownedRows, error: ownedError } = await supabase
        .from("quizmon_owned_monsters")
        .select("*")
        .eq("profile_id", profileId);

    if (ownedError) {
        console.error("[performSingleGachaDraw] owned select error", ownedError);
        throw new Error("몬스터 정보를 불러오는 중 오류가 발생했습니다.");
    }

    const ownedList = (ownedRows ?? []) as QuizmonOwnedMonsterRow[];
    const existing = ownedList.find((m) => m.species_id === speciesId) ?? null;

    // 3) 종 마스터 데이터
    const { data: speciesRow, error: speciesError } = await supabase
        .from("quizmon_species")
        .select("*")
        .eq("id", speciesId)
        .maybeSingle();

    if (speciesError || !speciesRow) {
        console.error(
            "[performSingleGachaDraw] species select error",
            speciesError,
        );
        throw new Error("종 정보를 불러오는 중 오류가 발생했습니다.");
    }

    const species = speciesRow as QuizmonSpeciesRow;

    let starShardsGained = 0;
    let ownedMonster: QuizmonOwnedMonsterRow | null = existing ?? null;

    if (existing) {
        // ✅ 중복 → StarShard 지급
        const rarity = species.rarity ?? 1;
        starShardsGained = Math.max(1, rarity);
    } else {
        // ✅ 신규 → owned_monsters에 생성
        const usedSlots = new Set(
            ownedList
                .map((m) => m.party_slot)
                .filter((s): s is number => typeof s === "number"),
        );

        let newPartySlot: number | null = null;
        for (let slot = 1; slot <= 3; slot++) {
            if (!usedSlots.has(slot)) {
                newPartySlot = slot;
                break;
            }
        }

        const { data: insertedRow, error: insertError } = await supabase
            .from("quizmon_owned_monsters")
            .insert({
                profile_id: profileId,
                species_id: speciesId,
                level: 1,
                exp: 0,
                party_slot: newPartySlot,
                current_hp: null,
                is_fainted: false,
                learned_moves: [],
                // ability_id, equipped_moves, held_item_id 는
                // DB default/추후 패치로 처리
            })
            .select("*")
            .single();

        if (insertError || !insertedRow) {
            console.error(
                "[performSingleGachaDraw] owned insert error",
                insertError,
            );
            throw new Error("몬스터를 소환하는 중 오류가 발생했습니다.");
        }

        ownedMonster = insertedRow as QuizmonOwnedMonsterRow;
    }

    // 4) 프로필 재화 업데이트 (gems / star_shards)
    const { data: updatedProfileRow, error: profileError } = await supabase
        .from("quizmon_profiles")
        .update({
            gacha_gems: currentGems - gemCost,
            star_shards: (profile.star_shards ?? 0) + starShardsGained,
        })
        .eq("id", profileId)
        .select("*")
        .single();

    if (profileError || !updatedProfileRow) {
        console.error(
            "[performSingleGachaDraw] profile update error",
            profileError,
        );
        throw new Error("프로필 정보를 저장하는 중 오류가 발생했습니다.");
    }

    const updatedProfile = updatedProfileRow as QuizmonProfileRow;

    const result: GachaDrawResult = {
        kind: existing ? "duplicate" : "new",
        species,
        ownedMonster,
        starShardsGained,
        gachaGemsConsumed: gemCost,
    };

    return { result, updatedProfile };
}
