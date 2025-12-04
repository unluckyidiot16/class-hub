// src/games/quizmon/gacha.ts
import { supabase } from "../../lib/supabaseClient";
import type {
    QuizmonOwnedMonsterRow,
    QuizmonProfileRow,
    QuizmonSpeciesRow,
} from "./types";

/**
 * 가챠에서 사용할 종 정보 최소셋
 */
/**
 * 가챠에서 사용할 종 정보 최소셋
 */
type GachaSpecies = Pick<
    QuizmonSpeciesRow,
    | "id"
    | "rarity"
    | "gacha_weight"
    | "popularity_rank"
    | "generation"
    | "is_playable"
    | "is_legendary"
    | "is_mythical"
    | "battle_stat_total"
    | "evolves_to_id"
>;


/**
 * 가챠 풀 로드
 *
 * 조건:
 *  - generation = 1
 *  - is_playable = true
 *  - gacha_weight > 0
 *  - 전설 / 환상 제외
 *  - 600족(또는 그 이상) 제외
 *  - "진화 전" 폼만 포함 (포켓몬 GO 느낌)
 */
async function loadGachaPool(): Promise<GachaSpecies[]> {
    const { data, error } = await supabase
        .from("quizmon_species")
        .select(
            [
                "id",
                "rarity",
                "gacha_weight",
                "popularity_rank",
                "generation",
                "is_playable",
                "is_legendary",
                "is_mythical",
                "battle_stat_total",
                "evolves_to_id",
            ].join(", "),
        )
        .eq("generation", 1)
        .eq("is_playable", true)
        .gt("gacha_weight", 0);

    if (error) {
        console.error("[gacha] loadGachaPool error", error);
        throw new Error("가챠 풀을 불러오는 중 오류가 발생했습니다.");
    }

    // ⚠️ TS2352 회피: data가 GenericStringError[] | ... 로 잡히는 케이스 대응
    const rawList = ((data ?? []) as unknown) as GachaSpecies[];

    if (!rawList.length) {
        console.warn("[gacha] 가챠 풀이 비어 있습니다. (quizmon_species 확인)");
        return rawList;
    }

    // 1) 어떤 종의 evolves_to_id 로 등장하는 id = "진화체들"
    //    → 그 대상이 아닌 애들을 '베이스폼(진화 전)'으로 간주
    const evolvedIds = new Set(
        rawList
            .map((sp) => sp.evolves_to_id)
            .filter(
                (id): id is string =>
                    typeof id === "string" && id.length > 0,
            ),
    );

    // 2) 메타 규칙에 따라 필터링
    const filtered = rawList.filter((sp) => {
        // 전설 / 환상 → Dust 상점 전용
        if (sp.is_legendary || sp.is_mythical) return false;

        // 600족 이상 → Dust 상점 전용
        if (
            sp.battle_stat_total != null &&
            sp.battle_stat_total >= 600
        ) {
            return false;
        }

        // 진화 전만: 다른 종의 evolves_to_id에 잡히지 않는 애들만 포함
        if (evolvedIds.has(sp.id)) return false;

        return true;
    });

    if (!filtered.length) {
        // 조건이 너무 빡세서 전부 날아가면 일단 rawList를 쓰고 경고만
        console.warn(
            "[gacha] 필터링 이후 가챠 풀이 비어 있습니다. 필터 조건 또는 seed 데이터를 확인하세요.",
        );
        return rawList;
    }

    return filtered;
}


/**
 * 가중치 기반 랜덤 추출
 */
function weightedRandom(ids: { id: string; weight: number }[]): string {
    const total = ids.reduce((sum, x) => sum + x.weight, 0);
    if (total <= 0) {
        // fallback: 균등 랜덤
        const fallbackIdx = Math.floor(Math.random() * ids.length);
        return ids[Math.max(0, fallbackIdx)].id;
    }

    let r = Math.random() * total;
    for (const entry of ids) {
        r -= entry.weight;
        if (r <= 0) return entry.id;
    }
    return ids[ids.length - 1].id;
}

/**
 * 실제로 뽑을 종 id 하나 선택
 */
async function rollSpeciesIdFromDb(): Promise<string> {
    const pool = await loadGachaPool();

    if (!pool.length) {
        // 혹시 비어 있으면 안전하게 스타팅 3마리라도 쓰자
        const fallbackPool: string[] = ["poke-0001", "poke-0004", "poke-0007"];
        const idx = Math.floor(Math.random() * fallbackPool.length);
        return fallbackPool[idx];
    }

    const weightedPool = pool.map((sp) => ({
        id: sp.id,
        weight: sp.gacha_weight ?? 1,
    }));

    return weightedRandom(weightedPool);
}

/**
 * rarity → 중복 시 지급할 스타샤드 양
 */
function getStarShardsForRarity(rarity: number | null | undefined): number {
    const r = rarity ?? 1;
    switch (r) {
        case 5:
            return 20;
        case 4:
            return 10;
        case 3:
            return 5;
        case 2:
            return 3;
        default:
            return 1;
    }
}

export type GachaCostType = "gems";

export type GachaDrawResult = {
    kind: "new" | "duplicate";
    species: QuizmonSpeciesRow;
    ownedMonster: QuizmonOwnedMonsterRow | null;
    starShardsGained: number;
    gachaGemsConsumed: number;
};

/**
 * 단일 가챠 실행
 * - gems 1개 소비 (costType = "gems")
 * - 신규면 owned_monsters에 생성
 * - 중복이면 star_shards 지급
 */
export async function performSingleGachaDraw(params: {
    profile: QuizmonProfileRow;
    costType?: GachaCostType;
}): Promise<{ result: GachaDrawResult; updatedProfile: QuizmonProfileRow }> {
    const { profile, costType = "gems" } = params;
    const profileId = profile.id;

    // 🔹 1) 재화 체크
    const currentGems = profile.gems ?? 0;
    const gemCost = costType === "gems" ? 1 : 0;

    if (gemCost > 0 && currentGems < gemCost) {
        throw new Error("가챠 재화(젬)가 부족합니다.");
    }

    // 🔹 2) 종 선택 (DB 기반 가중치 추첨)
    const speciesId = await rollSpeciesIdFromDb();

    // 🔹 3) 해당 프로필의 owned_monsters 조회
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

    // 🔹 4) 종 마스터 로드
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

    // 🔹 5) 신규 / 중복 분기
    if (existing) {
        // ✅ 중복 → Star Shard 지급
        starShardsGained = getStarShardsForRarity(species.rarity ?? 1);
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
                // 🔴 ability_id / equipped_moves 등은 DB 기본값(null / 빈 배열)에 맡긴다
                // → FK 에러(poke-0326-basic 등) 방지
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

    // 🔹 6) 프로필 재화 업데이트 (gems / star_shards)
    const { data: updatedProfileRow, error: profileError } = await supabase
        .from("quizmon_profiles")
        .update({
            // ⚠️ 예전 gacha_gems 필드 대신 gems 사용
            gems: currentGems - gemCost,
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
