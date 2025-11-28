// src/services/quizmonInventoryService.ts
import { supabase } from "../../lib/supabaseClient";
import {
    type MonsterLevelUpResult,
    loadMonsterWithSpecies,
    maybeApplyEvolution,
    loadPowerItemCounts
} from "./quizmonService.ts";
import {calcDerivedStats} from "./stats.ts";

export type InventoryRow = {
    id: string;
    profile_id: string;
    item_id: string;
    quantity: number;
    created_at: string;
    updated_at: string;
};

/**
 * 프로필의 인벤토리 전체 조회
 */
export async function fetchInventory(profileId: string): Promise<InventoryRow[]> {
    const { data, error } = await supabase
        .from("quizmon_inventory")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: true });

    if (error) {
        throw error;
    }

    return (data ?? []) as InventoryRow[];
}

/**
 * 인벤토리에서 item 수량 증감 (deltaQty: +면 추가, -면 소비)
 * - row가 없고 delta > 0 이면 새 row 생성
 * - 결과 quantity가 0이면 row 삭제
 */
export async function modifyInventoryQuantity(
    profileId: string,
    itemId: string,
    deltaQty: number,
): Promise<void> {
    if (!profileId || !itemId || deltaQty === 0) return;

    const { data: existingRows, error: selectError } = await supabase
        .from("quizmon_inventory")
        .select("*")
        .eq("profile_id", profileId)
        .eq("item_id", itemId)
        .limit(1);

    if (selectError) {
        throw selectError;
    }

    const existing = existingRows?.[0] as InventoryRow | undefined;

    if (!existing) {
        if (deltaQty < 0) {
            // 가진 적도 없는데 소비하려 하면 에러
            throw new Error("해당 아이템을 가지고 있지 않습니다.");
        }
        // 새 row 생성
        const { error: insertError } = await supabase
            .from("quizmon_inventory")
            .insert({
                profile_id: profileId,
                item_id: itemId,
                quantity: deltaQty,
            });

        if (insertError) {
            throw insertError;
        }
        return;
    }

    const nextQty = existing.quantity + deltaQty;
    if (nextQty < 0) {
        throw new Error("아이템 수량이 부족합니다.");
    } else if (nextQty === 0) {
        // 수량 0 되면 삭제
        const { error: deleteError } = await supabase
            .from("quizmon_inventory")
            .delete()
            .eq("id", existing.id);

        if (deleteError) {
            throw deleteError;
        }
    } else {
        const { error: updateError } = await supabase
            .from("quizmon_inventory")
            .update({ quantity: nextQty })
            .eq("id", existing.id);

        if (updateError) {
            throw updateError;
        }
    }
}

/**
 * 특정 아이템을 n개 소비하는 헬퍼
 */
export async function consumeInventoryItem(
    profileId: string,
    itemId: string,
    amount: number,
): Promise<void> {
    if (amount <= 0) return;

    const { data, error } = await supabase
        .from("quizmon_inventory")
        .select("id, quantity")
        .eq("profile_id", profileId)
        .eq("item_id", itemId)
        .maybeSingle();

    if (error || !data) {
        throw new Error("인벤토리에서 아이템을 찾을 수 없습니다.");
    }

    const currentQty: number = data.quantity ?? 0;
    if (currentQty < amount) {
        throw new Error("해당 아이템 수가 부족합니다.");
    }

    const newQty = currentQty - amount;

    const { error: updateError } = await supabase
        .from("quizmon_inventory")
        .update({ quantity: newQty })
        .eq("id", data.id);

    if (updateError) {
        throw new Error("인벤토리 갱신 중 오류가 발생했습니다.");
    }
}

export async function evolveMonsterWithItemService(params: {
    profileId: string;
    monsterId: string;
    itemId: string; // quizmon_items.id (예: "item-fire-stone")
}): Promise<MonsterLevelUpResult> {
    const { profileId, monsterId, itemId } = params;

    const {
        monster: initialMonster,
        species: initialSpecies,
        everstoneEquipped,
    } = await loadMonsterWithSpecies(monsterId, profileId);

    const levelBefore = initialMonster.level;
    const statsBefore = calcDerivedStats(initialSpecies, levelBefore);

    // 🔍 종 정보가 아이템 진화를 요구하는지 확인
    if (
        (initialSpecies.evolution_trigger ?? "item") !== "item" ||
        initialSpecies.evolution_item_id !== itemId
    ) {
        throw new Error("이 아이템으로는 해당 몬스터가 진화하지 않습니다.");
    }

    // 🔑 진화 시도 (item 컨텍스트)
    const evoResult = await maybeApplyEvolution(
        initialMonster,
        initialSpecies,
        everstoneEquipped,
        { type: "item", itemId },
    );

    if (!evoResult.evolved) {
        throw new Error("진화 조건이 충족되지 않았습니다.");
    }

    // 🎁 진화 성공했을 때만 아이템 실제 소비
    await consumeInventoryItem(profileId, itemId, 1);

    const monster = evoResult.monster;
    const species = evoResult.species;
    const levelAfter = monster.level; // 보통 동일

    const statsAfter = calcDerivedStats(species, levelAfter);

    const { expDustCount, rareCandyCount } =
        await loadPowerItemCounts(profileId);

    return {
        monster,
        species,
        usedExpDust: 0,
        usedRareCandy: 0,
        levelBefore,
        levelAfter,
        evolved: evoResult.evolved,
        previousSpeciesId: evoResult.previousSpeciesId,
        newSpeciesId: evoResult.newSpeciesId,
        statsBefore,
        statsAfter,
        remainingExpDust: expDustCount,
        remainingRareCandy: rareCandyCount,
    };
}
