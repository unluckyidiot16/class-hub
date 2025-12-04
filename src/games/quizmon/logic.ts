// src/games/quizmon/logic.ts
import type { Monster, Move, QuizAnswerResult } from "./types";
import { getPokemonDimension } from "./pokemonDimensions";
import { computeDamageMultiplier } from "./battleFactory";

/**
 * 퀴즈 결과 → 공격/명중 공통 배율
 * - 틀리면 0.0 (데미지/명중 둘 다 0 취급)
 * - 빠르게 맞출수록 1.0 → 1.1 → 1.3 으로 상승
 */
export function calcQuizMod(result: QuizAnswerResult | null): number {
    if (!result) {
        // 퀴즈 정보가 없으면 평균값
        return 1.0;
    }

    if (!result.correct) {
        // 오답이면 공격이 아예 나가지 않은 것으로 처리
        return 0.0;
    }

    const t = result.timeMs ?? 9999;

    // 시간 구간은 필요에 따라 숫자만 조정해서 쓰면 됨 (ms 단위)
    if (t <= 3000) {
        // 3초 이내 빠른 정답
        return 1.3;
    }
    if (t <= 8000) {
        // 3~8초 평범한 정답
        return 1.1;
    }
    // 8초 이상 느린 정답
    return 1.0;
}

/**
 * 키/몸무게 정보를 받아서 "덩치(Bulk)" → 회피율로 바꾸기
 */
export type SizeSource = {
    heightM?: number | null;
    weightKg?: number | null;
    pokedexNo?: number | null;
};

/** 데미지 결과 컨텍스트 */
export type DamageContext = {
    damage: number;
    isCritical: boolean;
    effectiveness: number; // 타입 상성 배율 (0, 0.5, 1, 2, 4 등)
};

/** 크리티컬 히트 판정 (단순 6.25%) */
function rollCritical(): boolean {
    const CRIT_RATE = 0.0625; // 1/16
    return Math.random() < CRIT_RATE;
}

/**
 * defender(몬스터)의 덩치(키/몸무게) → 회피율로 변환
 * - heightM/weightKg가 직접 들어있으면 그걸 사용
 * - 없고 pokedexNo만 있으면 pokemonDimensions에서 자동 조회
 */
function getDefenderEvasion(mon: SizeSource | null | undefined): number {
    if (!mon) {
        // 정보 없으면 보통 체형으로 간주
        return 8;
    }

    let h = mon.heightM ?? null;
    let w = mon.weightKg ?? null;

    // height/weight가 없고 pokedexNo만 있을 경우, static JSON에서 조회
    if ((!h || !w) && mon.pokedexNo != null) {
        const dim = getPokemonDimension(mon.pokedexNo);
        if (dim) {
            h = dim.heightM;
            w = dim.weightKg;
        }
    }

    if (!h || !w || h <= 0 || w <= 0) {
        // 여전히 정보가 없으면 보통 체형
        return 8;
    }

    // 간단한 Bulk 지표 (BMI 비슷)
    const bulk = w / (h * h);

    // 구간은 대략적인 감으로 잡은 값 (필요하면 조정)
    if (bulk < 20) return 20; // Tiny : 작고 가벼워서 잘 피함
    if (bulk < 40) return 12; // Small
    if (bulk < 60) return 8;  // Medium
    if (bulk < 80) return 4;  // Large
    return 0;                 // Huge : 덩치가 커서 맞추기 쉬움
}

/**
 * 퀴즈 배율(0.0 ~ 1.3)을 명중률 보너스로 변환
 * - 매우 빠른 정답 : +20%
 * - 보통/빠른 정답 : +10%
 * - 느린 정답     : +0%
 */
function getQuizHitBonus(quizMod: number): number {
    if (quizMod <= 0) {
        // 오답은 별도 처리 (명중률 0%)
        return -999;
    }

    if (quizMod >= 1.25) return 20; // 1.3 근처: 매우 빠르게 맞춤
    if (quizMod >= 1.05) return 10; // 1.1 근처: 평범/빠르게 맞춤
    return 0; // 느리게 맞춘 경우는 보정 없음
}

/**
 * 최종 명중률 계산:
 *   baseAcc(원본 기술 명중) + 퀴즈 보정 - 상대 회피율(덩치)
 *
 * - 반환값: 0 ~ 100 (%)
 * - 퀴즈를 틀리면 무조건 0% 처리
 *
 * defender는 실제 타입이 Monster든 BattleMonsterCore든 상관 없이
 * heightM/weightKg/pokedexNo만 있으면 되고,
 * 없으면 "보통 체형"으로 처리됨.
 */
export function calcHitChance(
    defender: SizeSource | any,
    move: Move,
    quizMod: number,
): number {
    // 오답이면 공격 자체가 나가지 않는 느낌으로 처리
    if (quizMod <= 0) {
        return 0;
    }

    const baseAcc = move.baseAcc ?? 100;

    const quizBonus = getQuizHitBonus(quizMod);
    const evasion = getDefenderEvasion(defender as SizeSource);

    // - quizBonus는 +20 / +10 / 0 중 하나
    // - evasion은 0 ~ 20
    const raw = baseAcc + quizBonus - evasion;

    // 최소 5%, 최대 100%로 클램프
    const clamped = Math.max(5, Math.min(100, raw));

    return clamped;
}

/**
 * 전투용 몬스터가 만족해야 하는 최소 스탯 셰이프
 * (실제 Monster 타입이 이걸 포함하고 있으면 구조상 호환)
 */
export type MonsterLike = {
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
};

/**
 * 간단한 데미지 공식
 * - 실제 포켓몬 공식보다 단순하게:
 *   dmg ≒ (공격력 * 위력 / 방어력) * 랜덤(0.85~1.15)
 */
// 🔽 기존 calcDamage를 "컨텍스트 버전" + "숫자만 반환 버전"으로 분리

export function calcDamageWithContext(
    attacker: Monster,
    defender: Monster,
    move: Move,
): DamageContext {
    const basePower = move.power ?? 40;

    const isSpecial = move.category === "special";

    const attackStat = isSpecial
        ? attacker.spAtk ?? attacker.atk
        : attacker.atk;
    const defenseStat = isSpecial
        ? defender.spDef ?? defender.def
        : defender.def;

    // 포켓몬식 기본 공식에 가까운 형태 (단순화 버전)
    const levelFactor = (2 * attacker.level) / 5 + 2;
    const baseDamage =
        (((levelFactor * basePower * (attackStat / Math.max(1, defenseStat))) /
                50) +
            2) | 0;

    // STAB + 타입 상성 + 특성(meta) 보정
    const { total: typeAndAbilityMultiplier, type: typeMult } =
        computeDamageMultiplier(attacker, defender, move);

    // 크리티컬
    const isCritical = rollCritical();
    const critMult = isCritical ? 1.5 : 1.0;

    // 랜덤 요소 (±15%)
    const rand = 0.85 + Math.random() * 0.3;

    const raw = baseDamage * typeAndAbilityMultiplier * critMult * rand;
    const damage = Math.max(1, Math.round(raw));

    return {
        damage,
        isCritical,
        effectiveness: typeMult,
    };
}

/**
 * 기존 시그니처 유지: 숫자만 필요할 때는 이 함수 그대로 사용
 */
export function calcDamage(
    attacker: Monster,
    defender: Monster,
    move: Move,
): number {
    return calcDamageWithContext(attacker, defender, move).damage;
}



/**
 * 몬스터 HP 감소 적용
 */
export function applyDamageToMonster<T extends MonsterLike>(
    mon: T,
    damage: number,
): T {
    const newHp = Math.max(0, mon.hp - damage);
    return {
        ...mon,
        hp: newHp,
    };
}

/**
 * 배틀 로그 한 줄
 */
export type BattleLogEntry = {
    id: string;
    text: string;
};

/**
 * 최소한 logs 배열만 있으면 되는 BattleState 셰이프
 */
export type BattleStateLike = {
    logs: BattleLogEntry[];
};

/**
 * BattleState에 로그 한 줄 추가
 */
export function pushLog<TState extends BattleStateLike>(
    state: TState,
    text: string,
): TState {
    const entry: BattleLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
    };

    return {
        ...state,
        logs: [...state.logs, entry],
    };
}

/**
 * 주어진 명중률(%)로 명중 판정
 */
export function rollHit(hitChancePercent: number): boolean {
    const clamped = Math.max(0, Math.min(100, hitChancePercent));
    const roll = Math.random() * 100;
    return roll < clamped;
}
