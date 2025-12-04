// src/games/quizmon/starShop.ts
import { supabase } from "../../lib/supabaseClient";
import type {
    QuizmonOwnedMonsterRow,
    QuizmonProfileRow,
    QuizmonSpeciesRow,
} from "./types";

type StarShopRow = {
    species_id: string;
    star_shards_price: number;
    is_enabled: boolean;
    sort_order: number;
};

export type StarShopEntry = {
    species: QuizmonSpeciesRow;
    starShardsPrice: number;
    alreadyOwned: boolean;
};

// ✅ 600족 / 전설 / 환상 여부 체크
function isStarShardEligible(species: QuizmonSpeciesRow): boolean {
    const sp: any = species;
    const bst = sp.battle_stat_total as number | null | undefined;
    const isLegendary = !!sp.is_legendary;
    const isMythical = !!sp.is_mythical;

    return (
        isLegendary ||
        isMythical ||
        (bst != null && bst >= 600)
    );
}

export async function loadStarShopEntries(options: {
    profileId: string | null;
}): Promise<StarShopEntry[]> {
    const { profileId } = options;

    // 1) 상점 row 조회 (현재 코드 그대로)
    const { data: shopData, error: shopError } = await supabase
        .from("quizmon_star_shop")
        .select("species_id, star_shards_price, is_enabled, sort_order")
        .eq("is_enabled", true)
        .order("sort_order", { ascending: true });

    if (shopError) {
        console.error("[starShop] loadStarShopEntries shop error", shopError);
        throw new Error("포켓몬 상점 목록을 불러오는 중 오류가 발생했습니다.");
    }

    const shopRows = (shopData ?? []) as StarShopRow[];
    if (!shopRows.length) return [];

    const speciesIds = shopRows.map((r) => r.species_id);

    // 2) 종 마스터 로드 (현재 코드 그대로지만 *필요한 필드가 들어있는지*는 DDL 기준으로 확인)
    const { data: speciesData, error: speciesError } = await supabase
        .from("quizmon_species")
        .select("*")
        .in("id", speciesIds);

    if (speciesError) {
        console.error("[starShop] loadStarShopEntries species error", speciesError);
        throw new Error("종 정보를 불러오는 중 오류가 발생했습니다.");
    }

    const speciesList = (speciesData ?? []) as QuizmonSpeciesRow[];
    const speciesMap = new Map<string, QuizmonSpeciesRow>();
    for (const sp of speciesList) {
        speciesMap.set(sp.id, sp);
    }

    // 3) 보유 종 집합 (중복 구매 막기용) - 그대로
    let ownedSpeciesSet = new Set<string>();
    if (profileId) {
        const { data: ownedData, error: ownedError } = await supabase
            .from("quizmon_owned_monsters")
            .select("species_id")
            .eq("profile_id", profileId);

        if (ownedError) {
            console.error("[starShop] loadStarShopEntries owned error", ownedError);
            throw new Error("보유 포켓몬 정보를 불러오는 중 오류가 발생했습니다.");
        }

        ownedSpeciesSet = new Set(
            (ownedData ?? []).map((row: { species_id: string }) => row.species_id),
        );
    }

    // 4) 최종 entry 구성 + ✅ 600족/전설/환상 필터
    const entries: StarShopEntry[] = shopRows
        .map((row) => {
            const sp = speciesMap.get(row.species_id);
            if (!sp) return null;

            // ✅ 여기서 한 번 더 필터
            if (!isStarShardEligible(sp)) {
                console.warn(
                    "[starShop] species not eligible for Star Shard shop, ignoring:",
                    sp.id,
                    (sp as any).name,
                );
                return null;
            }

            return {
                species: sp,
                starShardsPrice: row.star_shards_price,
                alreadyOwned: ownedSpeciesSet.has(row.species_id),
            } as StarShopEntry;
        })
        .filter((e): e is StarShopEntry => e !== null);

    return entries;
}


export type StarPurchaseResult = {
    species: QuizmonSpeciesRow;
    ownedMonster: QuizmonOwnedMonsterRow;
    starShardsSpent: number;
};

export async function purchaseSpeciesWithStarShards(params: {
    profile: QuizmonProfileRow;
    speciesId: string;
}): Promise<{ result: StarPurchaseResult; updatedProfile: QuizmonProfileRow }> {
    const { profile, speciesId } = params;
    const profileId = profile.id;

    // 1) 상점에서 가격 확인
    const { data: shopRow, error: shopError } = await supabase
        .from("quizmon_star_shop")
        .select("species_id, star_shards_price, is_enabled")
        .eq("species_id", speciesId)
        .maybeSingle();

    if (shopError || !shopRow) {
        console.error("[starShop] purchaseSpeciesWithStarShards shop error", shopError);
        throw new Error("해당 포켓몬은 상점에서 구매할 수 없습니다.");
    }

    if (!shopRow.is_enabled) {
        throw new Error("현재 구매할 수 없는 포켓몬입니다.");
    }

    const price = shopRow.star_shards_price as number;

    // 2) star_shards 잔액 체크
    const currentStars = profile.star_shards ?? 0;
    if (currentStars < price) {
        throw new Error("Star Shards가 부족합니다.");
    }

    // 3) 보유 여부 확인 + 파티 슬롯 계산
    const { data: ownedRows, error: ownedError } = await supabase
        .from("quizmon_owned_monsters")
        .select("*")
        .eq("profile_id", profileId);

    if (ownedError) {
        console.error(
            "[starShop] purchaseSpeciesWithStarShards owned select error",
            ownedError,
        );
        throw new Error("보유 포켓몬 정보를 불러오는 중 오류가 발생했습니다.");
    }

    const ownedList = (ownedRows ?? []) as QuizmonOwnedMonsterRow[];
    const existing =
        ownedList.find((m) => m.species_id === speciesId) ?? null;

    if (existing) {
        throw new Error("이미 보유 중인 포켓몬입니다.");
    }

    // 4) 종 마스터 로드
    // 4) 종 마스터 로드
    const { data: speciesRow, error: speciesError } = await supabase
        .from("quizmon_species")
        .select("*")
        .eq("id", speciesId)
        .maybeSingle();

    if (speciesError || !speciesRow) {
        console.error(
            "[starShop] purchaseSpeciesWithStarShards species error",
            speciesError,
        );
        throw new Error("종 정보를 불러오는 중 오류가 발생했습니다.");
    }

    const species = speciesRow as QuizmonSpeciesRow;

// ✅ Star Shard 상점 대상인지 최종 확인
    if (!isStarShardEligible(species)) {
        throw new Error("이 포켓몬은 Star Shards 상점 대상이 아닙니다.");
    }


    // 5) 빈 파티 슬롯 (1~3) 계산
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

    // ✅ first_encounter_level 활용 (없으면 1)
    const spAny = species as any;
    const encounterLevel: number =
        (spAny.first_encounter_level && spAny.first_encounter_level >= 1)
            ? spAny.first_encounter_level
            : 1;

    // ✅ 기본 HP 사용
    const baseHp: number | null =
        typeof spAny.base_hp === "number" ? spAny.base_hp : null;

    // 6) owned_monsters에 새 개체 insert
    const { data: insertedRow, error: insertError } = await supabase
        .from("quizmon_owned_monsters")
        .insert({
            profile_id: profileId,
            species_id: speciesId,
            level: encounterLevel,
            exp: 0,
            party_slot: newPartySlot,
            current_hp: baseHp,
            is_fainted: false,
            learned_moves: [],
        })
        .select("*")
        .single();

    if (insertError || !insertedRow) {
        console.error(
            "[starShop] purchaseSpeciesWithStarShards owned insert error",
            insertError,
        );
        throw new Error("포켓몬을 소환하는 중 오류가 발생했습니다.");
    }

    const ownedMonster = insertedRow as QuizmonOwnedMonsterRow;

    // 7) 프로필 star_shards 차감
    const { data: updatedProfileRow, error: profileError } = await supabase
        .from("quizmon_profiles")
        .update({
            star_shards: currentStars - price,
        })
        .eq("id", profileId)
        .select("*")
        .single();

    if (profileError || !updatedProfileRow) {
        console.error(
            "[starShop] purchaseSpeciesWithStarShards profile update error",
            profileError,
        );
        throw new Error("프로필 정보를 저장하는 중 오류가 발생했습니다.");
    }

    const updatedProfile = updatedProfileRow as QuizmonProfileRow;

    const result: StarPurchaseResult = {
        species,
        ownedMonster,
        starShardsSpent: price,
    };

    return { result, updatedProfile };
}
