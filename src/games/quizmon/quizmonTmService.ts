// src/services/quizmonTmService.ts
import { supabase } from "../../lib/supabaseClient";
import { consumeInventoryItem } from "./quizmonInventoryService";

type OwnedMonsterRow = {
    id: string;
    profile_id: string;
    species_id: string;
    level: number;
    learned_moves: string[];   // jsonb
    equipped_moves: string[];  // jsonb
};

type ItemRow = {
    id: string;
    item_type: string;
    tm_move_id: string | null;
};

type MoveRow = {
    id: string;
    name: string;
    // 필요하면 power, element 등 추가
};

/**
 * TM 1회 사용:
 * - quizmon_items.item_type === 'tm' 확인
 * - tm_move_id 로 기술 결정
 * - 인벤토리에서 TM 1개 소비
 * - 해당 몬스터 learned_moves / equipped_moves 업데이트
 */
export async function useTmOnMonster(
    profileId: string,
    ownedMonsterId: string,
    tmItemId: string,
): Promise<{ updatedMonster: OwnedMonsterRow; move: MoveRow }> {
    // 1) TM 아이템 정보 확인
    const { data: itemData, error: itemError } = await supabase
        .from("quizmon_items")
        .select("id, item_type, tm_move_id")
        .eq("id", tmItemId)
        .single();

    if (itemError || !itemData) {
        throw new Error("TM 정보를 불러올 수 없습니다.");
    }

    const item = itemData as ItemRow;

    if (item.item_type !== "tm" || !item.tm_move_id) {
        throw new Error("해당 아이템은 TM이 아닙니다.");
    }

    const moveId = item.tm_move_id;

    // 2) TM에 연결된 기술 정보 로딩 (이름/설명 표시용)
    const { data: moveData, error: moveError } = await supabase
        .from("quizmon_moves")
        .select("id, name")
        .eq("id", moveId)
        .single();

    if (moveError || !moveData) {
        throw new Error("해당 TM에 연결된 기술 정보를 찾을 수 없습니다.");
    }

    const move = moveData as MoveRow;

    // 3) 몬스터 정보 로딩
    const { data: monData, error: monError } = await supabase
        .from("quizmon_owned_monsters")
        .select("id, profile_id, species_id, level, learned_moves, equipped_moves")
        .eq("id", ownedMonsterId)
        .single();

    if (monError || !monData) {
        throw new Error("대상 몬스터 정보를 불러올 수 없습니다.");
    }

    const monster = monData as OwnedMonsterRow;

    if (monster.profile_id !== profileId) {
        throw new Error("다른 트레이너의 몬스터에는 TM을 사용할 수 없습니다.");
    }

    // (선택) 종이 이 기술을 배울 수 있는지 체크하고 싶으면 여기서 species 기반 검증 추가
    // const canLearn = await checkSpeciesCanLearnMove(monster.species_id, moveId);
    // if (!canLearn) { throw new Error("이 포켓몬은 해당 기술을 배울 수 없습니다."); }

    // 4) 인벤토리에서 TM 1개 소비 (여기서 수량 부족이면 에러 발생)
    await consumeInventoryItem(profileId, tmItemId, 1);

    // 5) learned_moves / equipped_moves 업데이트
    const learnedSet = new Set<string>(monster.learned_moves ?? []);
    learnedSet.add(moveId);

    let equipped = Array.isArray(monster.equipped_moves)
        ? [...monster.equipped_moves]
        : [];

    // 장착 슬롯 여유가 있으면 자동 장착
    if (equipped.length < 4 && !equipped.includes(moveId)) {
        equipped.push(moveId);
    }
    // 4개 꽉 찼으면: 여기서는 일단 자동 장착은 안 하고,
    // UI에서 따로 "기술 교체" 화면에서 equipped_moves를 수정하는 흐름으로 두는 것도 가능.
    // (또는 여기서 교체 로직을 넣을 수도 있음 – 추후 확장 포인트)

    const { data: updatedMonData, error: updateMonError } = await supabase
        .from("quizmon_owned_monsters")
        .update({
            learned_moves: Array.from(learnedSet),
            equipped_moves: equipped,
        })
        .eq("id", monster.id)
        .select("id, profile_id, species_id, level, learned_moves, equipped_moves")
        .single();

    if (updateMonError || !updatedMonData) {
        throw new Error("몬스터의 기술 정보를 업데이트하는 중 오류가 발생했습니다.");
    }

    return {
        updatedMonster: updatedMonData as OwnedMonsterRow,
        move,
    };
}
