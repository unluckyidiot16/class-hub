// src/games/quizmon/battleFactory.ts
import type {
    AbilityMeta,
    Monster,
    Move,
    QuizmonOwnedMonsterRow,
    QuizmonSpeciesRow,
} from "./types";
import { calcDerivedStats } from "./stats";
import { MOVE_DB, getMovesForSpeciesAndLevel } from "./moveData";
import { ABILITY_DB } from "./abilityData";            // 추가
import { getTypeEffectiveness } from "./elementUtils";

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

    // 🔹 포켓덱스 번호 + 키/몸무게 계산 (m/kg 단위)
    const pokedexNo = species.pokedex_no ?? null;

    const heightM =
        species.height_m ??
        (typeof species.height_dm === "number"
            ? species.height_dm / 10
            : null);

    const weightKg =
        species.weight_kg ??
        (typeof species.weight_hg === "number"
            ? species.weight_hg / 10
            : null);

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
        element2: anySpecies.element2 ?? null,

        // 🔹 덩치 정보 (logic.ts에서 명중률 계산에 사용)
        pokedexNo,
        heightM: heightM ?? undefined,
        weightKg: weightKg ?? undefined,

        // 스탯
        atk: derived.atk,
        def: derived.def,
        spd: derived.spd,

        // 기술
        moves,

        // 특성
        abilityId: (owned as any)?.ability_id ?? null,
    };


    const monster: Monster = extra
        ? ({ ...baseMonster, ...extra } as Monster)
        : baseMonster;

    return monster;
}

// ---- 대미지 보정: STAB + 타입 상성 + 특성(meta) ----

function getHpRatio(mon: Monster): number {
    if (!mon.maxHp || mon.maxHp <= 0) return 1;
    return Math.max(0, Math.min(1, mon.hp / mon.maxHp));
}

function getAbilityMetaById(abilityId: string | null | undefined): AbilityMeta | undefined {
    if (!abilityId) return undefined;
    const ability = ABILITY_DB[abilityId];
    return ability?.meta;
}

function computeAbilityDamageOutModifier(
    meta: AbilityMeta | undefined,
    attacker: Monster,
    move: Move,
): number {
    if (!meta?.damageOut || !Array.isArray(meta.damageOut)) return 1;

    const hpRatio = getHpRatio(attacker);
    let mul = 1;

    for (const rule of meta.damageOut) {
        const elementOk =
            !rule.element || rule.element === move.element;
        const hpOk =
            typeof rule.whenHpBelowOrEqual === "number"
                ? hpRatio <= rule.whenHpBelowOrEqual
                : true;

        if (elementOk && hpOk && typeof rule.multiplier === "number") {
            mul *= rule.multiplier;
        }
    }

    return mul;
}

function computeAbilityDamageInModifier(
    meta: AbilityMeta | undefined,
    defender: Monster,
    move: Move,
): number {
    if (!meta?.damageIn || !Array.isArray(meta.damageIn)) return 1;

    const hpRatio = getHpRatio(defender);
    let mul = 1;

    for (const rule of meta.damageIn) {
        const elementOk =
            !rule.element || rule.element === move.element;
        const hpOk =
            typeof rule.whenHpBelowOrEqual === "number"
                ? hpRatio <= rule.whenHpBelowOrEqual
                : true;

        if (elementOk && hpOk && typeof rule.multiplier === "number") {
            mul *= rule.multiplier;
        }
    }

    return mul;
}

export type DamageMultiplierBreakdown = {
    stab: number;
    type: number;
    ability: number;
    total: number;
};

/**
 * STAB + 타입 상성 + 특성(meta) 보정을 한 번에 계산
 */
export function computeDamageMultiplier(
    attacker: Monster,
    defender: Monster,
    move: Move,
): DamageMultiplierBreakdown {
    const moveElement = move.element;

    // 1) STAB
    const atkAbilityMeta = getAbilityMetaById(attacker.abilityId ?? null);
    const hasStab =
        attacker.element === moveElement ||
        attacker.element2 === moveElement;

    const baseStab = hasStab ? 1.5 : 1.0;
    const abilityStab = hasStab && typeof atkAbilityMeta?.stabMultiplier === "number"
        ? atkAbilityMeta.stabMultiplier
        : baseStab;
    const stab = abilityStab;

    // 2) 타입 상성 (1차/2차 모두 반영)
    const defenderTypes = [
        defender.element ?? null,
        defender.element2 && defender.element2 !== defender.element
            ? defender.element2
            : null,
    ];
    const typeMult = getTypeEffectiveness(moveElement, defenderTypes);

    // 3) 특성(meta) 보정
    const defAbilityMeta = getAbilityMetaById(defender.abilityId ?? null);
    const abilityOut = computeAbilityDamageOutModifier(
        atkAbilityMeta,
        attacker,
        move,
    );
    const abilityIn = computeAbilityDamageInModifier(
        defAbilityMeta,
        defender,
        move,
    );
    const abilityMult = abilityOut * abilityIn;

    const total = stab * typeMult * abilityMult;

    return {
        stab,
        type: typeMult,
        ability: abilityMult,
        total,
    };
}

