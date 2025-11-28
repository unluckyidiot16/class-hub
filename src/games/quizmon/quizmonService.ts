// src/services/quizmonService.ts (추가 부분)
import { supabase } from "../../lib/supabaseClient";
import type {
    QuizmonOwnedMonsterRow,
    QuizmonSpeciesRow,
} from "./types";
import {
    calcDerivedStats,
    type DerivedStats,
} from "./stats";



/** ===== 레벨업 관련 상수 / 유틸 ===== */

const MONSTER_MAX_LEVEL = 100;          // 몬스터 최대 레벨
const EXP_PER_DUST = 50;                // Exp Dust 1개당 경험치량 (원하면 조정)

type EvolutionContext =
    | { type: "level_up" }
    | { type: "item"; itemId: string }
    | { type: "special"; key: string };

// 레벨 N → N+1 까지 필요한 경험치량 (간단 버전, 나중에 교체 가능)
function getExpToNextLevel(level: number): number {
    return 50 + level * 10;
}

/** 인벤토리에서 강화 아이템 개수 읽기 */
export async function loadPowerItemCounts(profileId: string): Promise<{
    expDustCount: number;
    rareCandyCount: number;
}> {
    const { data, error } = await supabase
        .from("quizmon_inventory")
        .select("id, quantity, quizmon_items(item_type)")
        .eq("profile_id", profileId);

    if (error) {
        console.error("[quizmonService] loadPowerItemCounts error", error);
        throw new Error("인벤토리를 불러오는 중 오류가 발생했습니다.");
    }

    let expDustCount = 0;
    let rareCandyCount = 0;

    (data ?? []).forEach((row: any) => {
        const q = row.quantity ?? 0;
        const t = row.quizmon_items?.item_type as string | undefined;
        if (t === "exp_dust") expDustCount += q;
        if (t === "rare_candy") rareCandyCount += q;
    });

    return { expDustCount, rareCandyCount };
}

/** 인벤토리에서 특정 타입 아이템 소비 (exp_dust / rare_candy) */
async function consumePowerItems(
    profileId: string,
    itemType: "exp_dust" | "rare_candy",
    amount: number,
): Promise<void> {
    if (amount <= 0) return;

    const { data, error } = await supabase
        .from("quizmon_inventory")
        .select("id, quantity, quizmon_items(item_type)")
        .eq("profile_id", profileId)
        .eq("quizmon_items.item_type", itemType);

    if (error) {
        console.error(
            "[quizmonService] consumePowerItems select error",
            error,
        );
        throw new Error("인벤토리를 불러오는 중 오류가 발생했습니다.");
    }

    const rows = data ?? [];
    if (rows.length === 0) {
        throw new Error("해당 종류의 아이템이 인벤토리에 없습니다.");
    }
    if (rows.length > 1) {
        console.warn(
            "[quizmonService] consumePowerItems: 같은 타입 인벤토리 행이 여러 개입니다. 첫 번째 행만 사용합니다.",
        );
    }

    const row = rows[0] as any;
    const currentQty: number = row.quantity ?? 0;
    if (currentQty < amount) {
        throw new Error("아이템 수가 부족합니다.");
    }

    const newQty = currentQty - amount;

    const { error: updateError } = await supabase
        .from("quizmon_inventory")
        .update({ quantity: newQty })
        .eq("id", row.id);

    if (updateError) {
        console.error(
            "[quizmonService] consumePowerItems update error",
            updateError,
        );
        throw new Error("인벤토리 업데이트 중 오류가 발생했습니다.");
    }
}

/** 한 마리 몬스터 + 종 정보 + Everstone 여부 읽기 */
export async function loadMonsterWithSpecies(
    monsterId: string,
    profileId: string,
): Promise<{
    monster: QuizmonOwnedMonsterRow;
    species: QuizmonSpeciesRow;
    everstoneEquipped: boolean;
}> {
    const { data: monRow, error: monError } = await supabase
        .from("quizmon_owned_monsters")
        .select("*")
        .eq("id", monsterId)
        .eq("profile_id", profileId)
        .maybeSingle();

    if (monError || !monRow) {
        console.error(
            "[quizmonService] loadMonsterWithSpecies monster error",
            monError,
        );
        throw new Error("몬스터 정보를 불러오는 중 오류가 발생했습니다.");
    }

    const monster = monRow as QuizmonOwnedMonsterRow;

    const { data: speciesRow, error: spError } = await supabase
        .from("quizmon_species")
        .select("*")
        .eq("id", monster.species_id)
        .maybeSingle();

    if (spError || !speciesRow) {
        console.error(
            "[quizmonService] loadMonsterWithSpecies species error",
            spError,
        );
        throw new Error("종 정보를 불러오는 중 오류가 발생했습니다.");
    }

    const species = speciesRow as QuizmonSpeciesRow;

    // held_item_id 에 everstone 이 들려 있으면 진화 억제
    let everstoneEquipped = false;
    const anyMon = monster as any;
    const heldItemId: string | null = anyMon.held_item_id ?? null;

    if (heldItemId) {
        const { data: heldItemRow, error: heldError } = await supabase
            .from("quizmon_items")
            .select("item_type")
            .eq("id", heldItemId)
            .maybeSingle();

        if (!heldError && heldItemRow?.item_type === "everstone") {
            everstoneEquipped = true;
        }
    }

    return { monster, species, everstoneEquipped };
}

export type MonsterLevelUpResult = {
    monster: QuizmonOwnedMonsterRow; // 최종 개체 상태
    species: QuizmonSpeciesRow;      // 최종 종 정보 (진화 반영)

    usedExpDust: number;
    usedRareCandy: number;

    levelBefore: number;
    levelAfter: number;

    // 🔹 진화 연출용 플래그 / 정보
    evolved: boolean;
    previousSpeciesId: string; // 진화 전 종 ID
    newSpeciesId?: string;     // 진화 후 종 ID (진화했을 때만)

    // 🔹 레벨업 전/후 스탯 스냅샷 (연출/표시용)
    statsBefore: DerivedStats;
    statsAfter: DerivedStats;

    // 인벤토리 잔여 수량 (UI 갱신용)
    remainingExpDust: number;
    remainingRareCandy: number;
};


/** 레벨업 후 진화 체크 + 종 교체 */
export async function maybeApplyEvolution(
    monster: QuizmonOwnedMonsterRow,
    species: QuizmonSpeciesRow,
    everstoneEquipped: boolean,
    ctx: EvolutionContext = { type: "level_up" },
): Promise<{
    monster: QuizmonOwnedMonsterRow;
    species: QuizmonSpeciesRow;
    evolved: boolean;
    previousSpeciesId: string;
    newSpeciesId?: string;
}> {
    const previousSpeciesId = species.id;

    // 🔒 변화없음의 돌(everstone) 들고 있으면 무조건 진화 막기
    if (everstoneEquipped) {
        return {
            monster,
            species,
            evolved: false,
            previousSpeciesId,
        };
    }

    const trigger =
        species.evolution_trigger ??
        // 옛날 데이터와 호환: level / item 필드 존재 여부로 추론
        (species.evolution_item_id
            ? "item"
            : species.evolution_level
                ? "level"
                : null);

    const evolvesToId = species.evolves_to_id ?? null;

    if (!evolvesToId || !trigger) {
        // 진화 정보 없음
        return {
            monster,
            species,
            evolved: false,
            previousSpeciesId,
        };
    }

    let canEvolve = false;

    if (trigger === "level") {
        const reqLevel = species.evolution_level ?? 0;
        if (ctx.type === "level_up" && monster.level >= reqLevel) {
            canEvolve = true;
        }
    } else if (trigger === "item") {
        const reqItemId = species.evolution_item_id;
        if (
            reqItemId &&
            ctx.type === "item" &&
            ctx.itemId === reqItemId
        ) {
            canEvolve = true;
        }
    } else if (trigger === "special") {
        const key = species.evolution_special_key;
        if (
            key &&
            ctx.type === "special" &&
            ctx.key === key
        ) {
            canEvolve = true;
        }
    }

    if (!canEvolve) {
        return {
            monster,
            species,
            evolved: false,
            previousSpeciesId,
        };
    }

    // 🔄 실제 진화: 타겟 종 로드 후 owned_monsters.species_id 교체
    const { data: evoSpeciesRow, error: evoError } = await supabase
        .from("quizmon_species")
        .select("*")
        .eq("id", evolvesToId)
        .maybeSingle();

    if (evoError || !evoSpeciesRow) {
        console.error(
            "[quizmonService] maybeApplyEvolution evo species error",
            evoError,
        );
        return {
            monster,
            species,
            evolved: false,
            previousSpeciesId,
        };
    }

    const newSpecies = evoSpeciesRow as QuizmonSpeciesRow;

    const { data: updatedMonRow, error: updateError } = await supabase
        .from("quizmon_owned_monsters")
        .update({ species_id: newSpecies.id })
        .eq("id", monster.id)
        .select("*")
        .maybeSingle();

    if (updateError || !updatedMonRow) {
        console.error(
            "[quizmonService] maybeApplyEvolution monster update error",
            updateError,
        );
        return {
            monster,
            species,
            evolved: false,
            previousSpeciesId,
        };
    }

    const evolvedMonster = updatedMonRow as QuizmonOwnedMonsterRow;

    return {
        monster: evolvedMonster,
        species: newSpecies,
        evolved: true,
        previousSpeciesId,
        newSpeciesId: newSpecies.id,
    };
}


/**
 * 1 레벨 업 서비스
 * - 레어 캔디가 있으면: 레어 캔디 1개 소비 → 즉시 +1레벨 (새 레벨의 0 EXP)
 * - 없으면: Exp Dust 를 "정확히 1레벨 오를 만큼" 소비
 * - 아이템 부족 시 에러 throw
 */
export async function levelUpMonsterSingleService(params: {
    profileId: string;
    monsterId: string;
}): Promise<MonsterLevelUpResult> {
    const { profileId, monsterId } = params;

    const {
        monster: initialMonster,
        species: initialSpecies,
        everstoneEquipped,
    } = await loadMonsterWithSpecies(monsterId, profileId);

    const levelBefore = initialMonster.level;
    const expBefore = initialMonster.exp ?? 0;

    if (levelBefore >= MONSTER_MAX_LEVEL) {
        throw new Error("이미 최대 레벨입니다.");
    }

    // 🔹 레벨업 전 스탯 스냅샷
    const statsBefore = calcDerivedStats(initialSpecies, levelBefore);

    const { expDustCount, rareCandyCount } =
        await loadPowerItemCounts(profileId);

    let usedExpDust = 0;
    let usedRareCandy = 0;
    let level = levelBefore;
    let exp = expBefore;

    if (rareCandyCount > 0) {
        // 레어 캔디 1개 → 정확히 +1 레벨
        usedRareCandy = 1;
        level = Math.min(MONSTER_MAX_LEVEL, level + 1);
        exp = 0;
    } else {
        // Exp Dust만으로 1 레벨업 보장
        const expToNext = getExpToNextLevel(level);
        const missingExp = expToNext - exp;
        const neededDust = Math.max(
            1,
            Math.ceil(missingExp / EXP_PER_DUST),
        );

        if (expDustCount < neededDust) {
            throw new Error(
                "1레벨 업을 하기 위한 Exp Dust가 부족합니다.",
            );
        }

        usedExpDust = neededDust;
        exp += usedExpDust * EXP_PER_DUST;

        if (exp >= expToNext) {
            exp -= expToNext;
            level = Math.min(MONSTER_MAX_LEVEL, level + 1);
        }
    }

    // 인벤토리에서 실제로 소비
    if (usedRareCandy > 0) {
        await consumePowerItems(profileId, "rare_candy", usedRareCandy);
    }
    if (usedExpDust > 0) {
        await consumePowerItems(profileId, "exp_dust", usedExpDust);
    }

    // 몬스터 레벨/EXP 업데이트
    const { data: updatedMonRow, error: updateMonError } =
        await supabase
            .from("quizmon_owned_monsters")
            .update({ level, exp })
            .eq("id", initialMonster.id)
            .select("*")
            .maybeSingle();

    if (updateMonError || !updatedMonRow) {
        console.error(
            "[quizmonService] levelUpMonsterSingleService monster update error",
            updateMonError,
        );
        throw new Error(
            "몬스터 레벨을 저장하는 중 오류가 발생했습니다.",
        );
    }

    let monster = updatedMonRow as QuizmonOwnedMonsterRow;
    let species = initialSpecies;

    // 🔹 진화 체크 (Everstone이면 진화 막음)
    const evoResult = await maybeApplyEvolution(
        monster,
        species,
        everstoneEquipped,
        { type: "level_up" },   // ✅ 명시적으로 레벨 업 컨텍스트 전달
    );
    monster = evoResult.monster;
    species = evoResult.species;

    const levelAfter = monster.level;

    // 🔹 레벨업 후 스탯 스냅샷 (진화했으면 새 종 기준)
    const statsAfter = calcDerivedStats(species, levelAfter);

    const { expDustCount: finalDust, rareCandyCount: finalCandy } =
        await loadPowerItemCounts(profileId);

    return {
        monster,
        species,
        usedExpDust,
        usedRareCandy,
        levelBefore,
        levelAfter,
        evolved: evoResult.evolved,
        previousSpeciesId: evoResult.previousSpeciesId,
        newSpeciesId: evoResult.newSpeciesId,
        statsBefore,
        statsAfter,
        remainingExpDust: finalDust,
        remainingRareCandy: finalCandy,
    };
}

/**
 * 최대 레벨 업 서비스
 * - 보유한 레어 캔디를 먼저 모두 사용해 가능한 만큼 +1씩
 * - 이후 남은 Exp Dust 전부를 EXP로 바꿔서 올라갈 수 있을 만큼 추가 레벨업
 */
export async function levelUpMonsterMaxService(params: {
    profileId: string;
    monsterId: string;
}): Promise<MonsterLevelUpResult> {
    const { profileId, monsterId } = params;

    const {
        monster: initialMonster,
        species: initialSpecies,
        everstoneEquipped,
    } = await loadMonsterWithSpecies(monsterId, profileId);

    const levelBefore = initialMonster.level;
    let level = levelBefore;
    let exp = initialMonster.exp ?? 0;

    if (level >= MONSTER_MAX_LEVEL) {
        throw new Error("이미 최대 레벨입니다.");
    }

    // 🔹 레벨업 전 스탯 스냅샷
    const statsBefore = calcDerivedStats(initialSpecies, levelBefore);

    const {
        expDustCount: startDust,
        rareCandyCount: startCandy,
    } = await loadPowerItemCounts(profileId);

    let remainingDust = startDust;
    let remainingCandy = startCandy;

    let usedExpDust = 0;
    let usedRareCandy = 0;

    // 1) 레어 캔디 먼저 몽땅 사용
    while (remainingCandy > 0 && level < MONSTER_MAX_LEVEL) {
        remainingCandy -= 1;
        usedRareCandy += 1;
        level = Math.min(MONSTER_MAX_LEVEL, level + 1);
        exp = 0;
    }

    // 2) 남은 Dust → EXP로 모두 변환
    if (remainingDust > 0 && level < MONSTER_MAX_LEVEL) {
        usedExpDust = remainingDust;
        remainingDust = 0;
        exp += usedExpDust * EXP_PER_DUST;

        while (level < MONSTER_MAX_LEVEL) {
            const expToNext = getExpToNextLevel(level);
            if (exp < expToNext) break;
            exp -= expToNext;
            level += 1;
        }
    }

    // 실제 인벤토리 차감
    if (usedRareCandy > 0) {
        await consumePowerItems(profileId, "rare_candy", usedRareCandy);
    }
    if (usedExpDust > 0) {
        await consumePowerItems(profileId, "exp_dust", usedExpDust);
    }

    // 몬스터 레벨/EXP 업데이트
    const { data: updatedMonRow, error: updateMonError } =
        await supabase
            .from("quizmon_owned_monsters")
            .update({ level, exp })
            .eq("id", initialMonster.id)
            .select("*")
            .maybeSingle();

    if (updateMonError || !updatedMonRow) {
        console.error(
            "[quizmonService] levelUpMonsterMaxService monster update error",
            updateMonError,
        );
        throw new Error(
            "몬스터 레벨을 저장하는 중 오류가 발생했습니다.",
        );
    }

    let monster = updatedMonRow as QuizmonOwnedMonsterRow;
    let species = initialSpecies;

    // 진화 체크
    const evoResult = await maybeApplyEvolution(
        monster,
        species,
        everstoneEquipped,
    );
    monster = evoResult.monster;
    species = evoResult.species;

    const levelAfter = monster.level;

    // 🔹 레벨업 후 스탯 스냅샷
    const statsAfter = calcDerivedStats(species, levelAfter);

    const { expDustCount: finalDust, rareCandyCount: finalCandy } =
        await loadPowerItemCounts(profileId);

    return {
        monster,
        species,
        usedExpDust,
        usedRareCandy,
        levelBefore,
        levelAfter,
        evolved: evoResult.evolved,
        previousSpeciesId: evoResult.previousSpeciesId,
        newSpeciesId: evoResult.newSpeciesId,
        statsBefore,
        statsAfter,
        remainingExpDust: finalDust,
        remainingRareCandy: finalCandy,
    };

}
