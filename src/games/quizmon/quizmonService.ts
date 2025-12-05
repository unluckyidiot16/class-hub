// src/games/quizmon/quizmonService.ts
import { supabase } from "../../lib/supabaseClient";
import type {
    QuizmonOwnedMonsterRow,
    QuizmonProfileRow,
    QuizmonSpeciesRow,
} from "./types";
import {
    calcDerivedStats,
    type DerivedStats,
} from "./stats";
import { getNewlyLearnedMoveIds } from "./moveData";

/** =========================================================
 *  🧑‍🏫 트레이너 레벨 / EXP / 젬 보상 유틸
 *  - 몬스터를 새로 얻을 때, 던전을 돌 때마다 EXP 지급
 *  - 특정 레벨 달성 시 젬을 보상(업적처럼 동작)
 * ======================================================= */

export const TRAINER_EXP_PER_MONSTER = 5;   // 몬스터 1마리 획득 시
export const TRAINER_EXP_PER_DUNGEON = 10;  // 던전(레이드) 1판 클리어 시

export function getTrainerExpToNextLevel(level: number): number {
    // 필요 EXP: 1레벨은 20, 이후 레벨마다 +10
    return 20 + (level - 1) * 10;
}

// 레벨 달성 시 한 번만 주는 젬 보상 (원하면 나중에 확장)
const TRAINER_LEVEL_GEM_REWARD: Record<number, number> = {
    2: 5,
    3: 5,
    4: 10,
    5: 10,
    6: 15,
    7: 15,
    8: 20,
    9: 20,
    10: 30,
};

export type TrainerLevelUpResult = {
    profile: QuizmonProfileRow;
    trainerLevelBefore: number;
    trainerLevelAfter: number;
    gainedExp: number;
    gainedLevels: number;
    gainedGems: number;
};

const ITEM_ID_POKEBALL = "poke_ball";
const ITEM_ID_GREATBALL = "great_ball";
const ITEM_ID_ULTRABALL = "ultra_ball";

export async function loadBallItemCounts(profileId: string) {
    const { data, error } = await supabase
        .from("quizmon_inventory")
        .select("item_id, quantity")
        .eq("profile_id", profileId)
        .in("item_id", [
            ITEM_ID_POKEBALL,
            ITEM_ID_GREATBALL,
            ITEM_ID_ULTRABALL,
        ]);

    if (error) {
        console.error("[quizmonService] loadBallItemCounts error", error);
        return {
            pokeBallCount: 0,
            greatBallCount: 0,
            ultraBallCount: 0,
        };
    }

    const map = new Map<string, number>();
    for (const row of data ?? []) {
        map.set(row.item_id, row.quantity ?? 0);
    }

    return {
        pokeBallCount: map.get(ITEM_ID_POKEBALL) ?? 0,
        greatBallCount: map.get(ITEM_ID_GREATBALL) ?? 0,
        ultraBallCount: map.get(ITEM_ID_ULTRABALL) ?? 0,
    };
}


/**
 * 프로필에 트레이너 EXP를 더하고,
 * 필요시 레벨업 + 젬 보상을 적용한다.
 */
export function applyTrainerExpToProfile(
    profile: QuizmonProfileRow,
    gainedExp: number,
): TrainerLevelUpResult {
    let level = profile.trainer_level ?? 1;
    let exp = (profile.trainer_exp ?? 0) + gainedExp;
    let gems = profile.gems ?? 0;

    const trainerLevelBefore = level;
    let gainedLevels = 0;
    let gainedGems = 0;

    while (true) {
        const needed = getTrainerExpToNextLevel(level);
        if (exp < needed) break;

        exp -= needed;
        level += 1;
        gainedLevels += 1;

        const reward = TRAINER_LEVEL_GEM_REWARD[level] ?? 0;
        if (reward > 0) {
            gems += reward;
            gainedGems += reward;
        }
    }

    return {
        profile: {
            ...profile,
            trainer_level: level,
            trainer_exp: exp,
            gems,
        },
        trainerLevelBefore,
        trainerLevelAfter: level,
        gainedExp,
        gainedLevels,
        gainedGems,
    };
}



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

/**
 * 레벨업 전/후 구간에서 새로 배울 수 있는 기술을 learned_moves / equipped_moves 에 반영
 * - speciesBefore / speciesAfter 둘 다의 learnset 을 확인
 * - levelBefore < level <= levelAfter 인 기술만 대상
 * - 이미 learned_moves 에 있는 기술은 건너뜀
 * - 장착 슬롯이 비어 있는 경우에만 자동 장착
 *   (슬롯 꽉 찬 경우는 나중에 교체 모달 붙이고 처리)
 */
/**
 * 레벨업 전/후 구간에서 새로 배울 수 있는 기술을 learned_moves / equipped_moves 에 반영
 * - speciesBefore / speciesAfter 둘 다의 learnset 을 확인
 * - levelBefore < level <= levelAfter 인 기술만 대상
 * - 이미 learned_moves 에 있는 기술은 건너뜀
 * - 장착 슬롯이 비어 있는 경우에만 자동 장착
 */
async function applyLevelupMovesOnLevelUp(params: {
    monster: QuizmonOwnedMonsterRow;
    speciesBefore: QuizmonSpeciesRow;
    speciesAfter: QuizmonSpeciesRow;
    levelBefore: number;
    levelAfter: number;
}): Promise<QuizmonOwnedMonsterRow> {
    const { monster, speciesBefore, speciesAfter, levelBefore, levelAfter } =
        params;

    // 레벨이 그대로면 배울 기술도 없음
    if (levelAfter <= levelBefore) return monster;

    try {
        // 1) 현재까지 배운 / 장착한 기술 복사
        const learned = Array.isArray(monster.learned_moves)
            ? [...monster.learned_moves]
            : [];
        const equipped = Array.isArray(monster.equipped_moves)
            ? [...monster.equipped_moves]
            : [];

        // 2) 종별로 이번 레벨업 구간에서 새로 배우는 기술 id 계산
        const speciesIds = [
            speciesBefore.id,
            speciesAfter.id,
        ].filter((v, idx, arr) => arr.indexOf(v) === idx); // 중복 제거

        const newlyLearnedSet = new Set<string>();

        for (const sid of speciesIds) {
            const ids = getNewlyLearnedMoveIds(
                sid,
                levelBefore,
                levelAfter,
            );
            for (const id of ids) {
                if (!id) continue;
                newlyLearnedSet.add(id);
            }
        }

        // 이번 레벨업에서 배울 기술이 없으면 그대로 반환
        if (newlyLearnedSet.size === 0) {
            return monster;
        }

        // 3) learned_moves / equipped_moves 업데이트
        const newlyLearnedIds = Array.from(newlyLearnedSet);

        for (const moveId of newlyLearnedIds) {
            // 이미 배운 기술이면 learned에만 한 번 유지
            if (!learned.includes(moveId)) {
                learned.push(moveId);
            }

            // 장착 슬롯 여유가 있을 때만 자동 장착
            if (
                equipped.length < MAX_EQUIPPED_MOVES &&
                !equipped.includes(moveId)
            ) {
                equipped.push(moveId);
            }
        }

        const { data: updatedRow, error: updateError } = await supabase
            .from("quizmon_owned_monsters")
            .update({
                learned_moves: learned,
                equipped_moves: equipped,
            })
            .eq("id", monster.id)
            .select("*")
            .maybeSingle();

        if (updateError || !updatedRow) {
            console.error(
                "[quizmonService] applyLevelupMovesOnLevelUp update error",
                updateError,
            );
            return monster;
        }

        return updatedRow as QuizmonOwnedMonsterRow;
    } catch (e) {
        console.error(
            "[quizmonService] applyLevelupMovesOnLevelUp unexpected error",
            e,
        );
        return monster;
    }
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
        if (t === "xp_dust") expDustCount += q;     // ✅ 여기
        if (t === "rare_candy") rareCandyCount += q;
    });

    return { expDustCount, rareCandyCount };
}

/** 인벤토리에서 특정 타입 아이템 소비 (exp_dust / rare_candy) */
async function consumePowerItems(
    profileId: string,
    itemType: "xp_dust" | "rare_candy",
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

        if (!heldError && heldItemRow?.item_type === "no_evolve_stone") {
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
        await consumePowerItems(profileId, "xp_dust", usedExpDust);
    }

    const { data: updatedMonRow, error: updateMonError } = await supabase
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

    const evoResult = await maybeApplyEvolution(
        monster,
        species,
        everstoneEquipped,
        { type: "level_up" }, // 레벨업 컨텍스트
    );
    monster = evoResult.monster;
    species = evoResult.species;

    // 🔹 레벨업 구간에 해당하는 level-up 기술 적용
    monster = await applyLevelupMovesOnLevelUp({
        monster,
        speciesBefore: initialSpecies,
        speciesAfter: species,
        levelBefore,
        levelAfter: monster.level,
    });

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
        await consumePowerItems(profileId, "xp_dust", usedExpDust);
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

    // 🔹 레벨업 구간에 해당하는 level-up 기술 적용
    monster = await applyLevelupMovesOnLevelUp({
        monster,
        speciesBefore: initialSpecies,
        speciesAfter: species,
        levelBefore,
        levelAfter: monster.level,
    });

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


// quizmonService.ts 하단 쪽에 추가

/** 인벤토리에서 특정 item_id 아이템 소비 (TM, 진화 아이템 등 공통) */
export async function consumeInventoryItemById(
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
        console.error(
            "[quizmonService] consumeInventoryItemById select error",
            error,
        );
        throw new Error("인벤토리에서 아이템을 찾을 수 없습니다.");
    }

    const currentQty: number = (data as any).quantity ?? 0;
    if (currentQty < amount) {
        throw new Error("아이템 수가 부족합니다.");
    }

    const newQty = currentQty - amount;

    const { error: updateError } = await supabase
        .from("quizmon_inventory")
        .update({ quantity: newQty })
        .eq("id", (data as any).id);

    if (updateError) {
        console.error(
            "[quizmonService] consumeInventoryItemById update error",
            updateError,
        );
        throw new Error("인벤토리 업데이트 중 오류가 발생했습니다.");
    }
}

/**
 * equipped_moves 전체를 새 배열로 교체하는 서비스
 * - UI에서 1~4번 슬롯을 재배치하거나 해제할 때 사용
 */
export async function setEquippedMoves(params: {
    profileId: string;
    monsterId: string;
    moveIds: string[]; // 새 순서(길이 0~4)를 통째로 전달
}): Promise<QuizmonOwnedMonsterRow> {
    const { profileId, monsterId, moveIds } = params;

    const { data: monRow, error } = await supabase
        .from("quizmon_owned_monsters")
        .update({
            equipped_moves: moveIds,
        })
        .eq("id", monsterId)
        .eq("profile_id", profileId)
        .select("*")
        .maybeSingle();

    if (error || !monRow) {
        console.error("[quizmonService] setEquippedMoves error", error);
        throw new Error("장착 기술을 저장하는 중 오류가 발생했습니다.");
    }

    return monRow as QuizmonOwnedMonsterRow;
}
const MAX_EQUIPPED_MOVES = 4;

/**
 * TM 사용 서비스
 * - tmItemId로 quizmon_items 조회 → tm_move_id 확인
 * - owned_monster의 learned_moves / equipped_moves 갱신
 * - quizmon_inventory에서 해당 TM 1개 소비
 */
export async function applyTmToMonsterService(params: {
    profileId: string;
    monsterId: string;
    tmItemId: string;
}): Promise<QuizmonOwnedMonsterRow> {
    const { profileId, monsterId, tmItemId } = params;

    // 1) TM 아이템 정보 확인
    const { data: tmRow, error: tmError } = await supabase
        .from("quizmon_items")
        .select("id, item_type, tm_move_id")
        .eq("id", tmItemId)
        .maybeSingle();

    if (tmError || !tmRow) {
        console.error(
            "[quizmonService] applyTmToMonster tm select error",
            tmError,
        );
        throw new Error("TM 아이템 정보를 불러오는 중 오류가 발생했습니다.");
    }
    if ((tmRow as any).item_type !== "tm" || !(tmRow as any).tm_move_id) {
        throw new Error("유효한 TM 아이템이 아닙니다.");
    }

    const moveId: string = (tmRow as any).tm_move_id;

    // 2) 몬스터의 현재 learned_moves / equipped_moves 조회
    const { data: monRow, error: monError } = await supabase
        .from("quizmon_owned_monsters")
        .select("id, profile_id, learned_moves, equipped_moves")
        .eq("id", monsterId)
        .eq("profile_id", profileId)
        .maybeSingle();

    if (monError || !monRow) {
        console.error(
            "[quizmonService] applyTmToMonster monster select error",
            monError,
        );
        throw new Error("몬스터 정보를 불러오는 중 오류가 발생했습니다.");
    }

    let learned: string[] = Array.isArray((monRow as any).learned_moves)
        ? ((monRow as any).learned_moves as string[])
        : [];
    let equipped: string[] = Array.isArray((monRow as any).equipped_moves)
        ? ((monRow as any).equipped_moves as string[])
        : [];

    // 3) learned_moves에 추가 (없을 때만)
    if (!learned.includes(moveId)) {
        learned = [...learned, moveId];
    }

    // 4) equipped_moves 자동 장착/교체
    if (!equipped.includes(moveId)) {
        if (equipped.length < MAX_EQUIPPED_MOVES) {
            // 빈 자리가 있으면 뒤에 추가
            equipped = [...equipped, moveId];
        } else if (equipped.length > 0) {
            // 꽉 차 있으면 첫 번째 슬롯 교체 (MVP 규칙)
            equipped = [moveId, ...equipped.slice(1, MAX_EQUIPPED_MOVES)];
        } else {
            equipped = [moveId];
        }
    }

    // 5) 몬스터 업데이트 (배우기 + 장착 반영)
    const { data: updatedMon, error: updateError } = await supabase
        .from("quizmon_owned_monsters")
        .update({
            learned_moves: learned,
            equipped_moves: equipped,
        })
        .eq("id", monsterId)
        .eq("profile_id", profileId)
        .select("*")
        .maybeSingle();

    if (updateError || !updatedMon) {
        console.error(
            "[quizmonService] applyTmToMonster monster update error",
            updateError,
        );
        throw new Error("TM 사용 결과를 저장하는 중 오류가 발생했습니다.");
    }

    // 6) 인벤토리에서 TM 1개 소비
    await consumeInventoryItemById(profileId, tmItemId, 1);

    return updatedMon as QuizmonOwnedMonsterRow;
}

// 🧩 raid & shop 공통: 특정 item_type 인벤토리에 수량 더하기
async function addPowerItemsByType(params: {
    profileId: string;
    itemType: "xp_dust" | "rare_candy";
    amount: number;
}) {
    const { profileId, itemType, amount } = params;
    if (amount <= 0) return;

    // 1) item_type 으로 quizmon_items.id 찾기 (MVP: 한 종류만 있다고 가정)
    const { data: itemRows, error: itemFetchError } = await supabase
        .from("quizmon_items")
        .select("id")
        .eq("item_type", itemType)
        .limit(1);

    if (itemFetchError) {
        console.error("[addPowerItemsByType] quizmon_items 조회 오류", itemFetchError);
        throw new Error("강화 아이템 정보를 불러오지 못했습니다.");
    }

    const itemRow = itemRows?.[0];
    if (!itemRow) {
        console.warn(
            "[addPowerItemsByType] 해당 item_type의 아이템이 없습니다:",
            itemType,
        );
        return;
    }
    const itemId = itemRow.id as string;

    // 2) 기존 인벤토리 row 있는지 확인
    const { data: invRows, error: invFetchError } = await supabase
        .from("quizmon_inventory")
        .select("id, quantity")
        .eq("profile_id", profileId)
        .eq("item_id", itemId)
        .limit(1);

    if (invFetchError) {
        console.error("[addPowerItemsByType] quizmon_inventory 조회 오류", invFetchError);
        throw new Error("인벤토리를 불러오지 못했습니다.");
    }

    const existing = invRows?.[0];
    const newQuantity = (existing?.quantity ?? 0) + amount;

    if (existing) {
        const { error: updateError } = await supabase
            .from("quizmon_inventory")
            .update({ quantity: newQuantity })
            .eq("id", existing.id);

        if (updateError) {
            console.error("[addPowerItemsByType] 수량 업데이트 오류", updateError);
            throw new Error("인벤토리 수량을 업데이트하는 중 오류가 발생했습니다.");
        }
    } else {
        const { error: insertError } = await supabase
            .from("quizmon_inventory")
            .insert({
                profile_id: profileId,
                item_id: itemId,
                quantity: newQuantity,
            });

        if (insertError) {
            console.error("[addPowerItemsByType] 인벤토리 추가 오류", insertError);
            throw new Error("인벤토리에 아이템을 추가하는 중 오류가 발생했습니다.");
        }
    }
}

/**
 * 🛡 레이드 결과를 프로필/인벤토리에 반영하는 공통 서비스
 *  - 총 레이드/정답/문항 수 집계
 *  - 골드 보상
 *  - Exp Dust 보상
 */
/**
 * 🛡 레이드 결과를 프로필/인벤토리에 반영하는 공통 서비스
 *  - 총 레이드/정답/문항 수 집계
 *  - 골드 보상
 *  - Exp Dust 보상
 *  - 트레이너 EXP / 레벨업 / 젬 보상
 */
export async function applyRaidResultService(params: {
    profile: QuizmonProfileRow;
    summary: { correct: number; total: number };
}): Promise<{
    updatedProfile: QuizmonProfileRow;
    rewardedGold: number;
    rewardedExpDust: number;
    gainedTrainerExp: number;
    gainedTrainerLevels: number;
    gainedTrainerGems: number;
}> {
    const { profile, summary } = params;
    const correct = summary.correct ?? 0;
    const total = summary.total ?? 0;

    // 🎁 보상 공식 (원하면 여기 숫자만 조정해서 밸런스 맞추면 됨)
    const GOLD_PER_CORRECT = 2;
    const DUST_PER_CORRECT = 0.3; // 3문제 맞추면 대략 1개 정도

    const rewardedGold = correct * GOLD_PER_CORRECT;
    const rewardedExpDust = Math.floor(correct * DUST_PER_CORRECT);

    const nextTotalRaids = (profile.total_raids ?? 0) + 1;
    const nextTotalCorrect = (profile.total_correct ?? 0) + correct;
    const nextTotalQuestions = (profile.total_questions ?? 0) + total;
    const nextGold = (profile.gold ?? 0) + rewardedGold;

    // 🔹 트레이너 EXP: 던전 1판 기준 + 정답 수 보너스
    const gainedTrainerExp =
        TRAINER_EXP_PER_DUNGEON + correct; // 필요 시 계수 조정 가능

    // 레벨/젬 보상까지 반영한 프로필 계산
    const trainerResult = applyTrainerExpToProfile(
        {
            ...profile,
            total_raids: nextTotalRaids,
            total_correct: nextTotalCorrect,
            total_questions: nextTotalQuestions,
            gold: nextGold,
        },
        gainedTrainerExp,
    );

    const leveledProfile = trainerResult.profile;

    // 1) 프로필 집계 + 골드 + 트레이너 레벨/EXP + 젬 업데이트
    const { data, error } = await supabase
        .from("quizmon_profiles")
        .update({
            total_raids: leveledProfile.total_raids,
            total_correct: leveledProfile.total_correct,
            total_questions: leveledProfile.total_questions,
            gold: leveledProfile.gold,
            trainer_level: leveledProfile.trainer_level,
            trainer_exp: leveledProfile.trainer_exp,
            gems: leveledProfile.gems,
        })
        .eq("id", profile.id)
        .select("*")
        .single();

    if (error || !data) {
        console.error("[applyRaidResultService] 프로필 업데이트 오류", error);
        throw new Error("레이드 결과를 저장하는 중 오류가 발생했습니다.");
    }

    // 2) Exp Dust 보상 지급 (0개면 스킵)
    if (rewardedExpDust > 0) {
        await addPowerItemsByType({
            profileId: profile.id,
            itemType: "xp_dust",
            amount: rewardedExpDust,
        });
    }

    return {
        updatedProfile: data as QuizmonProfileRow,
        rewardedGold,
        rewardedExpDust,
        gainedTrainerExp,
        gainedTrainerLevels: trainerResult.gainedLevels,
        gainedTrainerGems: trainerResult.gainedGems,
    };
}


/**
 * 🛒 상점: 골드로 Exp Dust 구매
 *  - 기본값: Dust 1개당 10 Gold
 */
export async function buyExpDustWithGoldService(params: {
    profileId: string;
    quantity?: number;
    pricePerDust?: number;
}): Promise<{
    updatedProfile: QuizmonProfileRow;
    spentGold: number;
    gainedExpDust: number;
}> {
    const { profileId, quantity = 1, pricePerDust = 10 } = params;
    if (quantity <= 0) {
        return {
            updatedProfile: null as any,
            spentGold: 0,
            gainedExpDust: 0,
        };
    }

    // 1) 현재 프로필 골드 조회
    const { data: profileRow, error: profileError } = await supabase
        .from("quizmon_profiles")
        .select("*")
        .eq("id", profileId)
        .single();

    if (profileError || !profileRow) {
        console.error("[buyExpDustWithGoldService] 프로필 조회 오류", profileError);
        throw new Error("프로필 정보를 불러오지 못했습니다.");
    }

    const currentGold = profileRow.gold ?? 0;
    const cost = quantity * pricePerDust;

    if (currentGold < cost) {
        throw new Error("골드가 부족합니다.");
    }

    // 2) 골드 차감
    const { data: updatedProfileRow, error: updateError } = await supabase
        .from("quizmon_profiles")
        .update({
            gold: currentGold - cost,
        })
        .eq("id", profileId)
        .select("*")
        .single();

    if (updateError || !updatedProfileRow) {
        console.error("[buyExpDustWithGoldService] 골드 차감 오류", updateError);
        throw new Error("골드를 차감하는 중 오류가 발생했습니다.");
    }

    // 3) Exp Dust 지급
    await addPowerItemsByType({
        profileId,
        itemType: "xp_dust",
        amount: quantity,
    });

    return {
        updatedProfile: updatedProfileRow as QuizmonProfileRow,
        spentGold: cost,
        gainedExpDust: quantity,
    };
}
/**
 * 회복 비용 기본 상수
 * - HEAL_ALL_COST_GOLD: 파티 회복 최소 비용(하한선) 역할
 *   → 아주 저레벨 파티일 때도 너무 싸지 않게 막는 용도
 */
export const HEAL_ALL_COST_GOLD = 10;

// 개별 몬스터 회복 비용 (레벨에 따라 증가)
export function calcMonsterHealCostGold(
    level: number | null | undefined,
): number {
    const lv = level ?? 1;         // null/undefined/0 → 1로 최소 보정
    // 예시 공식: 레벨당 2골드, 최소 5골드
    return Math.max(5, lv * 2);
}

/**
 * 파티(최대 3마리) 회복 비용 계산
 * - 각 몬스터 개별 회복 비용을 더한 값
 * - 단, 너무 싸지 않도록 HEAL_ALL_COST_GOLD(기본 10골드)를 하한선으로 둠
 */
export function calcPartyHealCostGold(
    levels: Array<number | null | undefined>,
): number {
    const total = levels.reduce<number>(
        (sum, lv) => sum + calcMonsterHealCostGold(lv),
        0,
    );

    // 최소 비용은 HEAL_ALL_COST_GOLD
    return Math.max(HEAL_ALL_COST_GOLD, total);
}

/**
 * 파티 전체 회복
 * - 대상: party_slot 1~3에 들어 있는 몬스터만
 * - quizmon_profiles.gold 에서 "파티 레벨 합" 기반 비용 차감
 * - quizmon_owned_monsters.current_hp / is_fainted 초기화
 */
export async function healAllMonstersService(profileId: string): Promise<void> {
    // 1) 파티 몬스터 로딩
    const { data: monsters, error: monstersError } = await supabase
        .from("quizmon_owned_monsters")
        .select("id, level")
        .eq("profile_id", profileId)
        .in("party_slot", [1, 2, 3]);

    if (monstersError) {
        console.error("[healAllMonstersService] load monsters error", monstersError);
        throw monstersError;
    }

    const party = (monsters ?? []) as { id: string; level: number | null }[];

    if (!party.length) {
        return;
    }

    const levels = party.map((m) => m.level ?? 1);
    const healCost = calcPartyHealCostGold(levels);

    // 2) 프로필 로딩
    const { data: profile, error: profileError } = await supabase
        .from("quizmon_profiles")
        .select("id, gold")
        .eq("id", profileId)
        .single();

    if (profileError) {
        console.error("[healAllMonstersService] load profile error", profileError);
        throw profileError;
    }

    const currentGold = (profile as any).gold ?? 0;

    // ✅ 테스트 모드: 골드 부족이면 그냥 무료 회복 (골드 업데이트 스킵)
    const isTestFreeHeal = true; // 나중에 플래그/환경변수로 빼도 됨

    if (currentGold < healCost && !isTestFreeHeal) {
        // 실제 상용 모드용 로직 (지금은 안 씀)
        throw new Error("골드가 부족합니다. (회복 비용: " + healCost + ")");
    }

    if (currentGold >= healCost && !isTestFreeHeal) {
        // 🔹 정상 모드: 골드 차감
        const newGold = currentGold - healCost; // 0 이상이어야 DB 제약 통과

        const { error: updateProfileError } = await supabase
            .from("quizmon_profiles")
            .update({ gold: newGold })
            .eq("id", profileId);

        if (updateProfileError) {
            console.error(
                "[healAllMonstersService] update profile gold error",
                updateProfileError,
            );
            throw updateProfileError;
        }
    } else if (currentGold < healCost && isTestFreeHeal) {
        // 🔹 지금 상황: 무료 회복 모드
        console.warn(
            `[healAllMonstersService] 골드 부족이지만 테스트 모드로 무료 회복. gold=${currentGold}, cost=${healCost}`,
        );
        // 여기서는 gold 업데이트 아예 안 함
    }

    // 3) 파티 몬스터 HP 회복 (골드와 상관없이 진행)
    const monsterIds = party.map((m) => m.id);
    const { error: healError } = await supabase
        .from("quizmon_owned_monsters")
        .update({
            current_hp: null,
            is_fainted: false,
        })
        .in("id", monsterIds);

    if (healError) {
        console.error("[healAllMonstersService] heal monsters error", healError);
        throw healError;
    }
}


/**
 * 단일 몬스터 선택 회복
 * - 대상: owned_monster 한 마리
 * - 해당 개체 레벨 기반으로 비용 계산
 */
export async function healSingleMonsterService(
    profileId: string,
    ownedMonsterId: string,
): Promise<void> {
    if (!profileId || !ownedMonsterId) return;

    // 1) 대상 몬스터 정보 확인
    const { data: mon, error: monError } = await supabase
        .from("quizmon_owned_monsters")
        .select("id, profile_id, level")
        .eq("id", ownedMonsterId)
        .maybeSingle();

    if (monError || !mon) {
        throw monError ?? new Error("몬스터 정보를 불러올 수 없습니다.");
    }

    // 다른 유저 소유 몬스터 방어
    if (mon.profile_id !== profileId) {
        throw new Error("해당 몬스터를 회복할 수 없습니다.");
    }

    const level = (mon as any).level ?? 1;
    const cost = calcMonsterHealCostGold(level);

    // 2) 현재 골드 확인
    const { data: profile, error: profileError } = await supabase
        .from("quizmon_profiles")
        .select("id, gold")
        .eq("id", profileId)
        .single();

    if (profileError || !profile) {
        throw profileError ?? new Error("프로필 정보를 불러올 수 없습니다.");
    }

    const currentGold: number = profile.gold ?? 0;

    if (currentGold < cost) {
        throw new Error("골드가 부족해서 해당 몬스터를 회복할 수 없습니다.");
    }

    const nextGold = currentGold - cost;

    // 3) 골드 차감
    const { error: updateProfileError } = await supabase
        .from("quizmon_profiles")
        .update({ gold: nextGold })
        .eq("id", profileId);

    if (updateProfileError) {
        throw updateProfileError;
    }

    // 4) 해당 몬스터만 회복/부활
    const { error: updateMonsterError } = await supabase
        .from("quizmon_owned_monsters")
        .update({
            current_hp: null,
            is_fainted: false,
        })
        .eq("id", ownedMonsterId);

    if (updateMonsterError) {
        throw updateMonsterError;
    }
}
