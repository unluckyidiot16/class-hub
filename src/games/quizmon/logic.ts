// src/games/quizmon/logic.ts
import type {
    BattleState,
    BattleLogEntry,
    Monster,
    Move,
    QuizAnswerResult,
} from "./types";

/** 퀴즈 결과 → quizMod 계산 (수업용 A 모드 기준) */
export function calcQuizMod(result: QuizAnswerResult): number {
    const sec = result.timeMs / 1000;
    if (!result.correct) {
        // 오답
        return 0.6;
    }
    // 정답일 때 속도 구간
    if (sec <= 3) return 1.5;
    if (sec <= 8) return 1.25;
    return 1.0;
}

/** 현재 명중/회피 스테이지 보정값 계산 (간단 버전) */
export function getStageMod(stage: number): number {
    // 일단은 stage 자체를 곱해 쓰는 구조로 시작 (추후 포켓몬식 랭크로 교체 가능)
    return stage;
}

/** 최종 명중률(0~100) 계산 */
export function calcHitChance(
    attacker: Monster,
    defender: Monster,
    move: Move,
    quizMod: number,
): number {
    const baseAcc = move.baseAcc;
    const accStage = getStageMod(attacker.accStage);
    const evaStage = getStageMod(defender.evaStage);

    const raw = baseAcc * quizMod * (accStage / evaStage);
    const clamped = Math.max(0, Math.min(100, raw));
    return clamped;
}

/** 명중 여부 랜덤 판정 */
export function rollHit(hitChance: number): boolean {
    const r = Math.random() * 100;
    return r <= hitChance;
}

/** 아주 단순화된 데미지 공식 (MVP용 임시) */
export function calcDamage(attacker: Monster, defender: Monster, move: Move): number {
    if (move.power <= 0) return 0;
    const base = move.power;
    const atkFactor = attacker.atk;
    const defFactor = defender.def;
    const raw = base + atkFactor * 0.5 - defFactor * 0.3;
    return Math.max(1, Math.round(raw));
}

/** 로그에 한 줄 추가 */
export function pushLog(state: BattleState, text: string): BattleState {
    const entry: BattleLogEntry = {
        id: `${Date.now()}-${state.logs.length}`,
        text,
    };
    return {
        ...state,
        logs: [entry, ...state.logs],
    };
}

/** 몬스터 HP 감소 처리 */
export function applyDamageToMonster(mon: Monster, damage: number): Monster {
    const nextHp = Math.max(0, mon.hp - damage);
    return { ...mon, hp: nextHp };
}
