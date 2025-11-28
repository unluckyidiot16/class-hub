// src/services/quizmonInventoryService.ts
import { supabase } from "../../lib/supabaseClient";

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
    quantity: number = 1,
): Promise<void> {
    if (quantity <= 0) return;
    await modifyInventoryQuantity(profileId, itemId, -quantity);
}
