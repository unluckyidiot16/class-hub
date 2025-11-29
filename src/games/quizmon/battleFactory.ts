// src/games/quizmon/battleFactory.ts
import type {
    Monster,
    Move,
    QuizmonOwnedMonsterRow,
    QuizmonSpeciesRow,
} from "./types";
import { calcDerivedStats } from "./stats";
import { MOVE_DB, getMovesForSpeciesAndLevel } from "./moveData";

export type BattleMonsterCore = Monster;
export type QuizmonSpeciesLike = QuizmonSpeciesRow;

const MAX_EQUIPPED_MOVES = 4;

/**
 * Move 배열을 id 기준으로 중복 제거
 */
function dedupMoves(moves: (Move | null | undefined)[]): Move[] {
    const map = new Map<string, Move>();
    for (const m of moves) {
        if (!m) continue;
        map.set(m.id, m);
    }
    return Array.from(map.values());
}

/**
 * 배틀에서 사용할 기술 목록 결정
 *
 * 우선순위:
 *  1) equipped_moves 가 있으면 → 그 id 순서대로 장착 (MOVE_DB lookup)
 *  2) 없으면: 종 + 레벨 기준 레벨업 기술 + learned_moves (TM 등)
 *  3) 아무 것도 없으면: tackle 등 기본기 1개라도 보장
 */
function resolveMovesForBattle(
    species: QuizmonSpeciesRow,
    owned?: QuizmonOwnedMonsterRow | null,
): Move[] {
    const anySpecies: any = species;
    const level = owned?.level ?? anySpecies.base_level ?? 1;

    // 1) 기본: 종 + 레벨 기반 자동 기술 (코드에서 계산)
    const baseFromLearnset = getMovesForSpeciesAndLevel(species.id, level);

    // 2) (선택) 추가로 배운 기술 (TM 등)
    const learnedIds: string[] = Array.isArray(owned?.learned_moves)
        ? owned!.learned_moves
        : [];
    const learnedMoves: Move[] = learnedIds
        .map((id) => MOVE_DB[id])
        .filter((m): m is Move => !!m);

    // 3) equipped_moves 가 지정되어 있으면, 그것만 사용 (id 배열)
    const equippedIds: string[] = Array.isArray(owned?.equipped_moves)
        ? owned!.equipped_moves
        : [];

    if (equippedIds.length > 0) {
        const equippedMoves: Move[] = equippedIds
            .map((id) => MOVE_DB[id])
            .filter((m): m is Move => !!m);

        const deduped = dedupMoves(equippedMoves).slice(0, MAX_EQUIPPED_MOVES);
        if (deduped.length > 0) {
            return deduped;
        }
    }

    // 4) 장착 정보가 없으면: 레벨업 기술 + learned_moves 합쳐서 뒤에서 4개 사용
    const merged = dedupMoves([...baseFromLearnset, ...learnedMoves]);
    let trimmed = merged.slice(-MAX_EQUIPPED_MOVES);

    // 5) 그래도 아무것도 없으면: tackle 등 기본기 하나라도
    if (trimmed.length === 0) {
        const fallback = MOVE_DB["tackle"] ?? Object.values(MOVE_DB)[0];
        if (fallback) {
            trimmed = [fallback];
        }
    }

    return trimmed;
}

/**
 * 종 + 소유 개체 정보로 배틀용 Monster를 생성
 *
 * - 레벨 / 스탯: calcDerivedStats 로 계산
 * - HP:
 *   - owned.current_hp 가 있으면 그대로 사용
 *   - 없으면 maxHp로 초기화
 * - 기술:
 *   - 위의 resolveMovesForBattle 로 결정
 */
export function buildBattleMonsterFromSpecies(
    species: QuizmonSpeciesRow,
    owned?: QuizmonOwnedMonsterRow | null,
    extra?: Partial<Monster>,
): Monster {
    const anySpecies: any = species;
    const level = owned?.level ?? anySpecies.base_level ?? 1;

    const derived = calcDerivedStats(species, level);

    const currentHp =
        typeof owned?.current_hp === "number" && owned.current_hp > 0
            ? owned.current_hp
            : derived.maxHp;

    const moves = resolveMovesForBattle(species, owned);

    const baseMonster: Monster = {
        // 기본 전투 상태값
        accStage: 0,
        evaStage: 0,
        exp: owned?.exp ?? 0,

        // HP
        hp: currentHp,
        maxHp: derived.maxHp,
        currentHp,

        // 식별자 / 메타
        id: owned?.id ?? `wild-${species.id}`,
        name:
            anySpecies.display_name ??
            anySpecies.name ??
            `몬스터 ${species.id}`,
        speciesId: species.id,
        level,
        element: anySpecies.element ?? "normal",

        // 스탯
        atk: derived.atk,
        def: derived.def,
        spd: derived.spd,

        // 기술
        moves,

        // extra 로 덮어쓸 수 있도록 최소 필드만 채움
    };

    const monster: Monster = extra
        ? ({ ...baseMonster, ...extra } as Monster)
        : baseMonster;

    return monster;
}
