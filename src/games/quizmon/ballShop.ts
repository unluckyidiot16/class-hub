// src/games/quizmon/ballShop.ts
import { supabase } from "../../lib/supabaseClient";
import type { QuizmonProfileRow } from "./types";

type BallShopRow = {
    item_id: string;
    ball_type: string | null;
    gold_price: number;
    gem_price: number | null;
    is_enabled: boolean;
    sort_order: number;
};

type QuizmonItemRow = {
    id: string;
    name: string;
    description: string | null;
    // 필요에 따라 필드 추가 (icon_key 등)
};

type InventoryRow = {
    profile_id: string;
    item_id: string;
    quantity: number;
};

export type BallShopEntry = {
    itemId: string;
    name: string;
    description: string | null;
    ballType: string | null;
    goldPrice: number;
    gemPrice: number | null;
    ownedCount: number;
};

export type BallPurchaseResult = {
    itemId: string;
    name: string;
    quantityPurchased: number;
    newQuantity: number;
    goldSpent: number;
};

export async function loadBallShopEntries(options: {
    profileId: string | null;
}): Promise<BallShopEntry[]> {
    const { profileId } = options;

    // 1) 상점 row 조회
    const { data: shopData, error: shopError } = await supabase
        .from("quizmon_ball_shop")
        .select(
            "item_id, ball_type, gold_price, gem_price, is_enabled, sort_order",
        )
        .eq("is_enabled", true)
        .order("sort_order", { ascending: true });

    if (shopError) {
        console.error("[ballShop] loadBallShopEntries shop error", shopError);
        throw new Error("포켓볼 상점 목록을 불러오는 중 오류가 발생했습니다.");
    }

    const shopRows = (shopData ?? []) as BallShopRow[];
    if (!shopRows.length) return [];

    const itemIds = shopRows.map((r) => r.item_id);

    // 2) 아이템 마스터 로드
    const { data: itemData, error: itemError } = await supabase
        .from("quizmon_items")
        .select("id, name, description")
        .in("id", itemIds);

    if (itemError) {
        console.error("[ballShop] loadBallShopEntries item error", itemError);
        throw new Error("아이템 정보를 불러오는 중 오류가 발생했습니다.");
    }

    const items = (itemData ?? []) as QuizmonItemRow[];
    const itemMap = new Map<string, QuizmonItemRow>();
    for (const it of items) {
        itemMap.set(it.id, it);
    }

    // 3) 인벤토리 로드 (현재 보유 수량)
    let invMap = new Map<string, number>();
    if (profileId) {
        const { data: invData, error: invError } = await supabase
            .from("quizmon_inventory")
            .select("item_id, quantity")
            .eq("profile_id", profileId)
            .in("item_id", itemIds);

        if (invError) {
            console.error("[ballShop] loadBallShopEntries inv error", invError);
            throw new Error(
                "인벤토리 정보를 불러오는 중 오류가 발생했습니다.",
            );
        }

        const invRows =
            (invData ?? []) as {
            item_id: string;
            quantity: number | null;
        }[];
        
        invMap = new Map(
            invRows.map((row) => [row.item_id, row.quantity ?? 0]),
        );
    }

    // 4) 최종 entry 구성
    const entries: BallShopEntry[] = shopRows
        .map((row) => {
            const item = itemMap.get(row.item_id);
            if (!item) return null;

            return {
                itemId: row.item_id,
                name: item.name,
                description: item.description,
                ballType: row.ball_type,
                goldPrice: row.gold_price,
                gemPrice: row.gem_price,
                ownedCount: invMap.get(row.item_id) ?? 0,
            } satisfies BallShopEntry;
        })
        .filter((e): e is BallShopEntry => e !== null);

    return entries;
}

export async function purchaseBallWithGold(params: {
    profile: QuizmonProfileRow;
    itemId: string;
    quantity?: number;
}): Promise<{ result: BallPurchaseResult; updatedProfile: QuizmonProfileRow }> {
    const { profile, itemId, quantity = 1 } = params;
    const profileId = profile.id;

    if (quantity <= 0) {
        throw new Error("구매 수량이 올바르지 않습니다.");
    }

    // 1) 상점에서 가격 확인
    const { data: shopRow, error: shopError } = await supabase
        .from("quizmon_ball_shop")
        .select("item_id, ball_type, gold_price, gem_price, is_enabled")
        .eq("item_id", itemId)
        .maybeSingle();

    if (shopError || !shopRow) {
        console.error("[ballShop] purchaseBallWithGold shop error", shopError);
        throw new Error("해당 포켓볼은 상점에서 구매할 수 없습니다.");
    }

    if (!shopRow.is_enabled) {
        throw new Error("현재 구매할 수 없는 포켓볼입니다.");
    }

    const unitPrice = shopRow.gold_price as number;
    const totalCost = unitPrice * quantity;

    // 2) 최신 골드 조회
    const {
        data: profileRow,
        error: profileSelectError,
    } = await supabase
        .from("quizmon_profiles")
        .select("id, gold")
        .eq("id", profileId)
        .single();

    if (profileSelectError || !profileRow) {
        console.error(
            "[ballShop] purchaseBallWithGold profile select error",
            profileSelectError,
        );
        throw new Error("프로필 정보를 불러오는 중 오류가 발생했습니다.");
    }

    const currentGold = (profileRow.gold as number) ?? 0;
    if (currentGold < totalCost) {
        throw new Error("골드가 부족합니다.");
    }

    // 3) 아이템 정보 조회 (이름용)
    const { data: itemRow, error: itemError } = await supabase
        .from("quizmon_items")
        .select("id, name")
        .eq("id", itemId)
        .maybeSingle();

    if (itemError || !itemRow) {
        console.error(
            "[ballShop] purchaseBallWithGold item error",
            itemError,
        );
        throw new Error("아이템 정보를 불러오는 중 오류가 발생했습니다.");
    }

    const item = itemRow as QuizmonItemRow;

    // 4) 인벤토리 현재 수량 조회
    const { data: invExisting, error: invSelectError } = await supabase
        .from("quizmon_inventory")
        .select("profile_id, item_id, quantity")
        .eq("profile_id", profileId)
        .eq("item_id", itemId)
        .maybeSingle();

    if (invSelectError) {
        console.error(
            "[ballShop] purchaseBallWithGold inv select error",
            invSelectError,
        );
        throw new Error("인벤토리 정보를 불러오는 중 오류가 발생했습니다.");
    }

    const existingQty = (invExisting?.quantity as number) ?? 0;
    const newQty = existingQty + quantity;

    // 5) 인벤토리 upsert
    let invResult: InventoryRow | null = null;
    if (invExisting) {
        const { data: updatedInv, error: invUpdateError } = await supabase
            .from("quizmon_inventory")
            .update({ quantity: newQty })
            .eq("profile_id", profileId)
            .eq("item_id", itemId)
            .select("*")
            .single();

        if (invUpdateError || !updatedInv) {
            console.error(
                "[ballShop] purchaseBallWithGold inv update error",
                invUpdateError,
            );
            throw new Error("인벤토리를 갱신하는 중 오류가 발생했습니다.");
        }
        invResult = updatedInv as InventoryRow;
    } else {
        const { data: insertedInv, error: invInsertError } = await supabase
            .from("quizmon_inventory")
            .insert({
                profile_id: profileId,
                item_id: itemId,
                quantity: quantity,
            })
            .select("*")
            .single();

        if (invInsertError || !insertedInv) {
            console.error(
                "[ballShop] purchaseBallWithGold inv insert error",
                invInsertError,
            );
            throw new Error("인벤토리에 추가하는 중 오류가 발생했습니다.");
        }
        invResult = insertedInv as InventoryRow;
    }

    // 6) 골드 차감
    const {
        data: updatedProfileRow,
        error: profileUpdateError,
    } = await supabase
        .from("quizmon_profiles")
        .update({
            gold: currentGold - totalCost,
        })
        .eq("id", profileId)
        .select("*")
        .single();

    if (profileUpdateError || !updatedProfileRow) {
        console.error(
            "[ballShop] purchaseBallWithGold profile update error",
            profileUpdateError,
        );
        throw new Error("프로필 정보를 저장하는 중 오류가 발생했습니다.");
    }

    const updatedProfile = updatedProfileRow as QuizmonProfileRow;

    const result: BallPurchaseResult = {
        itemId,
        name: item.name,
        quantityPurchased: quantity,
        newQuantity: invResult?.quantity ?? newQty,
        goldSpent: totalCost,
    };

    return { result, updatedProfile };
}
