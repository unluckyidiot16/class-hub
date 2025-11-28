// src/games/quizmon/battleFactory.ts
import type {
    Monster,
    Move,
    QuizmonOwnedMonsterRow,
    QuizmonSpeciesRow,
} from "./types";
import { calcDerivedStats } from "./stats";
import { MOVE_DB } from "./moveData"; // <- 실제 프로젝트에 맞는 move 데이터 소스 사용

export type BattleMonsterCore = Monster;
export type QuizmonSpeciesLike = QuizmonSpeciesRow;

const MAX_EQUIPPED_MOVES = 4;

/**
 * species + owned 정보를 기반으로 전투용 Monster 빌드
 * - owned.equipped_moves에 적힌 move id만 실제 moves에 반영
 * - equipped_moves가 비어 있으면 default move로 채움
 */
export function buildBattleMonsterFromSpecies(
    species: QuizmonSpeciesRow,
    owned?: QuizmonOwnedMonsterRow | null,
    extra?: any,
): Monster | null {
    if (!species) return null;
    const anySpecies = species as any;

    const level = owned?.level ?? 1;
    const derived = calcDerivedStats(species, level);

    // 🔹 장착 기술 선택
    const equippedIds: string[] =
        (owned as any)?.equipped_moves && Array.isArray((owned as any).equipped_moves)
            ? ((owned as any).equipped_moves as string[])
            : [];

    let moves: Move[] = [];

    if (equippedIds.length > 0) {
        // equipped_moves에 적힌 ID 순서대로 Move 매핑
        moves = equippedIds
            .map((id) => MOVE_DB[id])
            .filter((m): m is Move => !!m);
    }

    // 아무것도 장착 안 되어 있으면 species의 기본 기술로 채우기
    if (moves.length === 0) {
        const defaultIds: string[] =
            (anySpecies.default_moves as string[] | null) ?? [];
        moves = defaultIds
            .slice(0, MAX_EQUIPPED_MOVES)
            .map((id) => MOVE_DB[id])
            .filter((m): m is Move => !!m);
    }

    // 최악의 경우에도 1개는 보장
    if (moves.length === 0) {
        const fallback = MOVE_DB["tackle"];
        if (fallback) moves.push(fallback);
    }

    const currentHp = owned?.current_hp ?? derived.maxHp;
    
    const baseMonster: Monster = {
        accStage: 0,
        evaStage: 0,
        exp: owned?.exp ?? 0,
        hp: currentHp,                 // ✅ 현재 체력
        id: owned?.id ?? `wild-${species.id}`,
        name: anySpecies.name ?? `몬스터 ${species.id}`,
        speciesId: species.id,
        level,
        element: anySpecies.element ?? "normal",
        maxHp: derived.maxHp,
        currentHp,                     // ✅ optional 필드도 같이 세팅
        atk: derived.atk,
        def: derived.def,
        spd: derived.spd,
        moves,
        // 나머지 필드는 필요 시 extra로 병합
    };

    const monster: Monster = extra ? { ...baseMonster, ...extra } : baseMonster;

    return monster;
}
