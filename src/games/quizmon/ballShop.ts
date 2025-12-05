// src/games/quizmon/ballShop.ts
import { supabase } from "../../lib/supabaseClient";
import type { QuizmonProfileRow } from "./types";

/**
 * quizmon_ball_shop 테이블 row
 *  - item_id: quizmon_items.id (capture_ball 타입)
 */
type BallShopRow = {
    item_id: string;
    ball_type: string | null;
    gold_price: number;
    gem_price: number | null;
    is_enabled: boolean;
    sort_order: number;
};

/**
 * quizmon_items 최소 필드
 *  - capture_ball 타입만 사용
 */
type QuizmonItemRow = {
    id: string;
    name: string;
    description: string;
    item_type: string;
    rarity: string;
};

/**
 * quizmon_inventory 최소 필드
 */
type InventoryRow = {
    profile_id: string;
    item_id: string;
    quantity: number | null;
};

/**
 * 상점에서 쓸 포켓볼 엔트리
 */
export type BallShopEntry = {
    item: QuizmonItemRow;
    ballType: string | null;
    goldPrice: number;
    gemPrice: number | null;
    quantityOwned: number;
};

export type BallPurchaseResult = {
    itemId: string;
    name: string;
    quantityPurchased: number;
    newQuantity: number;
    goldSpent: number;
};

// ✅ 포획용 볼 정보(배틀 캡처 UI에서 사용할 최소 정보)
export type CaptureBallStock = {
        id: string;
        label: string;
        quantity: number;
        rateBonus?: number;
    };

    export type CaptureBallMeta = {
        id: string;
        label: string;
        rateBonus?: number;
    };

    // ✅ ball_type / rarity 에 따른 포획 보너스 값 계산 (원하면 나중에 조정)
function getRateBonusForBall(ballType: string | null): number {
    switch (ballType) {
        case "ultra":
            return 0.25;
        case "great":
            return 0.1;
        case "poke":
        default:
            return 0;
    }
}

/**
 * 포켓볼 상점 목록 불러오기
 *  - quizmon_ball_shop (is_enabled = true)
 *  - quizmon_items (item_type = 'capture_ball')
 *  - quizmon_inventory (해당 프로필의 보유 수량)
 */
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

    // 2) 아이템 마스터 로드 (capture_ball 타입만 허용)
    const { data: itemData, error: itemError } = await supabase
        .from("quizmon_items")
        .select(
            "id, name, description, item_type, rarity",
        )
        .in("id", itemIds);

    if (itemError) {
        console.error("[ballShop] loadBallShopEntries item error", itemError);
        throw new Error("아이템 정보를 불러오는 중 오류가 발생했습니다.");
    }

    const itemRows = (itemData ?? []) as QuizmonItemRow[];
    const itemMap = new Map<string, QuizmonItemRow>();
    for (const it of itemRows) {
        itemMap.set(it.id, it);
    }

    // 3) 인벤토리(보유 수량) 조회
    let invMap = new Map<string, number>();
    if (profileId) {
        const { data: invData, error: invError } = await supabase
            .from("quizmon_inventory")
            .select("item_id, quantity")
            .eq("profile_id", profileId)
            .in("item_id", itemIds);

        if (invError) {
            console.error(
                "[ballShop] loadBallShopEntries inv error",
                invError,
            );
            throw new Error("인벤토리 정보를 불러오는 중 오류가 발생했습니다.");
        }

        const invRows =
            (invData ?? []) as { item_id: string; quantity: number | null }[];

        invMap = new Map(
            invRows.map((row) => [row.item_id, row.quantity ?? 0]),
        );
    }

    // 4) 최종 엔트리 구성
    const entries: BallShopEntry[] = shopRows
        .map((row) => {
            const item = itemMap.get(row.item_id);
            if (!item) {
                console.warn(
                    "[ballShop] item not found for shop row, ignoring:",
                    row.item_id,
                );
                return null;
            }

            // item_type이 capture_ball 이 아니면 로직 상 잘못된 데이터
            if (item.item_type !== "capture_ball") {
                console.warn(
                    "[ballShop] item is not capture_ball, ignoring:",
                    item.id,
                    item.item_type,
                );
                return null;
            }

            const quantityOwned = invMap.get(row.item_id) ?? 0;

            return {
                item,
                ballType: row.ball_type,
                goldPrice: row.gold_price,
                gemPrice: row.gem_price,
                quantityOwned,
            } as BallShopEntry;
        })
        .filter((e): e is BallShopEntry => e !== null);

    return entries;
}

export async function getCaptureBallStocks(
    profileId: string | null,
    ): Promise<CaptureBallStock[]> {
    const entries = await loadBallShopEntries({ profileId });

        return entries
            .filter((e) => e.quantityOwned > 0)
        .map((e) => ({
                id: e.item.id,
                label: e.item.name,
                quantity: e.quantityOwned,
                rateBonus: getRateBonusForBall(e.ballType),
        }));
}

/*
 * ✅ 특정 포켓볼(item_id)에 대한 메타 정보 (라벨, rateBonus)
 *  - 배틀 포획 시, 선택된 볼의 이름과 보너스를 표시/계산할 때 사용
 */
export async function getCaptureBallMeta(
    itemId: string,
    ): Promise<CaptureBallMeta> {
    // 1) 상점 정보에서 ball_type 조회
    const { data: shopRow, error: shopError } = await supabase
        .from("quizmon_ball_shop")
        .select("item_id, ball_type")
        .eq("item_id", itemId)
        .maybeSingle();

        if (shopError) {
            console.error("[ballShop] getCaptureBallMeta shop error", shopError);
            throw new Error("포켓볼 정보를 불러오는 중 오류가 발생했습니다.");
        }

        const ballType = (shopRow as BallShopRow | null)?.ball_type ?? null;

        // 2) 아이템 마스터에서 이름/희귀도 조회
            const { data: itemRow, error: itemError } = await supabase
        .from("quizmon_items")
        .select("id, name, rarity, item_type")
        .eq("id", itemId)
        .maybeSingle();

        if (itemError || !itemRow) {
            console.error("[ballShop] getCaptureBallMeta item error", itemError);
            throw new Error("아이템 정보를 불러오는 중 오류가 발생했습니다.");
        }

        const item = itemRow as QuizmonItemRow;

        if (item.item_type !== "capture_ball") {
            throw new Error("이 아이템은 포획용 볼이 아닙니다.");
        }
        
        return {
            id: item.id,
            label: item.name,
            rateBonus: getRateBonusForBall(ballType),
        };
}

/**
 * 골드로 포켓볼 구매
 *  - quizmon_ball_shop 에서 가격 확인
 *  - quizmon_profiles.gold 차감
 *  - quizmon_inventory 에 수량 추가 (insert / update)
 */
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
    if (unitPrice == null || unitPrice < 0) {
        throw new Error("이 포켓볼은 Gold로 구매할 수 없습니다.");
    }

    const totalCost = unitPrice * quantity;

    // 2) 최신 골드 잔액 확인 (낡은 profile 스냅샷 방지)
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
        throw new Error("Gold가 부족합니다.");
    }

    // 3) item 마스터 로드 (capture_ball 타입인지 최종 확인)
    const { data: itemRow, error: itemError } = await supabase
        .from("quizmon_items")
        .select("id, name, description, item_type, rarity")
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

    if (item.item_type !== "capture_ball") {
        throw new Error("이 아이템은 포켓볼이 아닙니다.");
    }

    // 4) 인벤토리 조회 (기존 수량 확인)
    const {
        data: invRow,
        error: invError,
    } = await supabase
        .from("quizmon_inventory")
        .select("profile_id, item_id, quantity")
        .eq("profile_id", profileId)
        .eq("item_id", itemId)
        .maybeSingle();

    if (invError) {
        console.error(
            "[ballShop] purchaseBallWithGold inventory select error",
            invError,
        );
        throw new Error("인벤토리 정보를 불러오는 중 오류가 발생했습니다.");
    }

    const existing = invRow as InventoryRow | null;
    const prevQty = existing?.quantity ?? 0;
    const newQty = prevQty + quantity;

    // 5) 인벤토리 insert / update
    let invResult: { quantity: number } | null = null;

    if (existing) {
        // update
        const { data: updatedInvRow, error: invUpdateError } = await supabase
            .from("quizmon_inventory")
            .update({
                quantity: newQty,
            })
            .eq("profile_id", profileId)
            .eq("item_id", itemId)
            .select("quantity")
            .single();

        if (invUpdateError || !updatedInvRow) {
            console.error(
                "[ballShop] purchaseBallWithGold inventory update error",
                invUpdateError,
            );
            throw new Error("인벤토리를 갱신하는 중 오류가 발생했습니다.");
        }

        invResult = updatedInvRow as { quantity: number };
    } else {
        // insert
        const { data: insertedInvRow, error: invInsertError } = await supabase
            .from("quizmon_inventory")
            .insert({
                profile_id: profileId,
                item_id: itemId,
                quantity: newQty,
            })
            .select("quantity")
            .single();

        if (invInsertError || !insertedInvRow) {
            console.error(
                "[ballShop] purchaseBallWithGold inventory insert error",
                invInsertError,
            );
            throw new Error("인벤토리를 추가하는 중 오류가 발생했습니다.");
        }

        invResult = insertedInvRow as { quantity: number };
    }

    // 6) 프로필 gold 차감
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
