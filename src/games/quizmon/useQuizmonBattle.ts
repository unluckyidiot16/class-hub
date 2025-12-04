// src/games/quizmon/useQuizmonBattle.ts
import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
    BattleState,
    Move,
    QuizAnswerResult,
    QuizQuestionLite,
    Monster,
    ElementType, DamagePopup,
} from "./types";
import type { QuizPackJsonV1 } from "../../types/quizPackJson";
import { quizPackToLiteQuestions } from "./quizSource";
import { logGameEvent } from "../../api/gameSessions";
import {
    applyDamageToMonster,
    calcDamageWithContext,
    calcHitChance,
    calcQuizMod,
    pushLog,
    rollHit,
} from "./logic";
import { createInitialBattleState } from "./mockData";

// 간단한 셔플 유틸 (QuizMonGame.tsx 에 있는 것과 동일한 구현)
function shuffleArray<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
// 🔹 실제 18타입 상성 테이블 (Gen 6+ 기준)
const TYPE_EFFECTIVENESS: Partial<
    Record<ElementType, Partial<Record<ElementType, number>>>
> = {
    normal: {
        rock: 0.5,
        ghost: 0,
        steel: 0.5,
    },
    fire: {
        fire: 0.5,
        water: 0.5,
        grass: 2,
        ice: 2,
        bug: 2,
        rock: 0.5,
        dragon: 0.5,
        steel: 2,
    },
    water: {
        fire: 2,
        water: 0.5,
        grass: 0.5,
        ground: 2,
        rock: 2,
        dragon: 0.5,
    },
    grass: {
        fire: 0.5,
        water: 2,
        grass: 0.5,
        poison: 0.5,
        ground: 2,
        flying: 0.5,
        bug: 0.5,
        rock: 2,
        dragon: 0.5,
        steel: 0.5,
    },
    electric: {
        water: 2,
        electric: 0.5,
        grass: 0.5,
        ground: 0,
        flying: 2,
        dragon: 0.5,
    },
    ice: {
        fire: 0.5,
        water: 0.5,
        grass: 2,
        ice: 0.5,
        ground: 2,
        flying: 2,
        dragon: 2,
        steel: 0.5,
    },
    fighting: {
        normal: 2,
        ice: 2,
        rock: 2,
        dark: 2,
        steel: 2,
        poison: 0.5,
        flying: 0.5,
        psychic: 0.5,
        bug: 0.5,
        fairy: 0.5,
        ghost: 0,
    },
    poison: {
        grass: 2,
        fairy: 2,
        poison: 0.5,
        ground: 0.5,
        rock: 0.5,
        ghost: 0.5,
        steel: 0,
    },
    ground: {
        fire: 2,
        electric: 2,
        poison: 2,
        rock: 2,
        steel: 2,
        grass: 0.5,
        bug: 0.5,
        flying: 0,
    },
    flying: {
        grass: 2,
        fighting: 2,
        bug: 2,
        electric: 0.5,
        rock: 0.5,
        steel: 0.5,
    },
    psychic: {
        fighting: 2,
        poison: 2,
        psychic: 0.5,
        steel: 0.5,
        dark: 0,
    },
    bug: {
        grass: 2,
        psychic: 2,
        dark: 2,
        fire: 0.5,
        fighting: 0.5,
        poison: 0.5,
        flying: 0.5,
        ghost: 0.5,
        steel: 0.5,
        fairy: 0.5,
    },
    rock: {
        fire: 2,
        ice: 2,
        flying: 2,
        bug: 2,
        fighting: 0.5,
        ground: 0.5,
        steel: 0.5,
    },
    ghost: {
        psychic: 2,
        ghost: 2,
        dark: 0.5,
        normal: 0,
    },
    dragon: {
        dragon: 2,
        steel: 0.5,
        fairy: 0,
    },
    dark: {
        psychic: 2,
        ghost: 2,
        fighting: 0.5,
        dark: 0.5,
        fairy: 0.5,
    },
    steel: {
        ice: 2,
        rock: 2,
        fairy: 2,
        fire: 0.5,
        water: 0.5,
        electric: 0.5,
        steel: 0.5,
    },
    fairy: {
        fighting: 2,
        dragon: 2,
        dark: 2,
        fire: 0.5,
        poison: 0.5,
        steel: 0.5,
    },
};



function getTypeMultiplier(
    attack: ElementType,
    defend?: ElementType | null,
): number {
    if (!defend) return 1;
    const row = TYPE_EFFECTIVENESS[attack];
    if (!row) return 1;
    return row[defend] ?? 1;
}

/**
 * 기술 속성 vs 상대 속성을 보고 포켓몬식 코멘트 생성
 */
function getEffectivenessComment(
    moveElement: ElementType | undefined,
    defender: Monster,
): string | null {
    if (!moveElement) return null;

    const m1 = getTypeMultiplier(moveElement, defender.element);
    const m2 = getTypeMultiplier(moveElement, defender.element2 ?? null);
    const total = m1 * m2;

    if (total === 0) return "그러나 아무 효과도 없는 것 같다...";
    if (total > 1.01) return "효과가 굉장했다!";
    if (total < 1) return "별로 효과가 없는 것 같다.";
    return null;
}


export type UseQuizmonBattleOptions = {
    quizpack: QuizPackJsonV1 | null;
    roomId?: string | null;
    gameSessionId?: string | null;
    studentId?: string | null;
    onQuizAnswer?: (result: QuizAnswerResult) => void;
    onBattleEnd?: (summary: { correct: number; total: number }) => void;
};

export type UseQuizmonBattleResult = {
    // 배틀 상태 + setter (외부에서 resetBattleWithProfileParty 등에서 사용)
    state: BattleState;
    setState: Dispatch<SetStateAction<BattleState>>;

    // 퀴즈 관련
    questions: QuizQuestionLite[];
    questionIndex: number;
    setQuestionIndex: Dispatch<SetStateAction<number>>;
    questionOrder: number[];
    setQuestionOrder: Dispatch<SetStateAction<number[]>>;

    // 통계
    battleStats: { correct: number; total: number };
    setBattleStats: Dispatch<
        SetStateAction<{ correct: number; total: number }>
    >;
    hasReportedEnd: boolean;
    setHasReportedEnd: Dispatch<SetStateAction<boolean>>;

    // 파생 값들
    playerMon: Monster;
    enemyMon: Monster;
    canSelectMove: boolean;
    accuracyPercent: number | null;
    battleFinished: boolean;

    damagePopups: DamagePopup[];
    
    // 액션
    handleSelectMove: (move: Move) => void;
    handleAnswer: (optionIndex: number) => void;
    handleSwitch: (targetIndex: number) => void;
};

export function useQuizmonBattle(
    options: UseQuizmonBattleOptions,
): UseQuizmonBattleResult {
    const {
        quizpack,
        roomId,
        gameSessionId,
        studentId,
        onQuizAnswer,
        onBattleEnd,
    } = options;

    // 1) 전투 상태
    const [state, setState] = useState<BattleState>(() =>
        createInitialBattleState(),
    );
    const [questionIndex, setQuestionIndex] = useState(0);
    const [questionOrder, setQuestionOrder] = useState<number[]>([]);
    const [battleStats, setBattleStats] = useState({ correct: 0, total: 0 });
    const [hasReportedEnd, setHasReportedEnd] = useState(false);

    const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);

    const spawnDamagePopup = (
        target: "player" | "enemy",
        amount: number,
        isCritical: boolean,
        effectiveness: number,
    ) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const popup: DamagePopup = {
            id,
            target,
            amount,
            isCritical,
            effectiveness,
        };
        setDamagePopups((prev) => [...prev, popup]);

        // 0.8초 후 자동 제거
        window.setTimeout(() => {
            setDamagePopups((prev) => prev.filter((p) => p.id !== id));
        }, 800);
    };

    // 2) 퀴즈 소스: quizpackJson → Lite 배열
    const questions: QuizQuestionLite[] = useMemo(
        () => (quizpack ? quizPackToLiteQuestions(quizpack) : []),
        [quizpack],
    );

    // 🔹 quizpack이 준비되면 한 번 문제 순서를 섞어 둔다
    useEffect(() => {
        if (!questions.length) {
            setQuestionOrder([]);
            setQuestionIndex(0);
            return;
        }

        const indices = questions.map((_, idx) => idx);
        setQuestionOrder(shuffleArray(indices));
        setQuestionIndex(0);
    }, [questions]);

    // 현재 출전 중인 포켓몬 (참조)
    const playerMon = useMemo(
        () => state.player.monsters[state.player.activeIndex],
        [state.player],
    );
    const enemyMon = useMemo(
        () => state.enemy.monsters[state.enemy.activeIndex],
        [state.enemy],
    );

    /** 현재 질문 선택 (없으면 null)
     *  - questions: 원본 질문 배열
     *  - questionOrder: 랜덤으로 섞인 인덱스 배열
     *  - 보기(option)도 매번 섞어서 반환
     */
    const getNextQuestion = (): QuizQuestionLite | null => {
        if (!questions || questions.length === 0) return null;
        if (!questionOrder.length) return null;

        const orderIdx = questionIndex % questionOrder.length;
        const baseIdx = questionOrder[orderIdx];
        const baseQuestion = questions[baseIdx];
        if (!baseQuestion) return null;

        // 보기 인덱스를 셔플해서
        const optionIndices = baseQuestion.options.map((_, idx) => idx);
        const shuffledOptionIndices = shuffleArray(optionIndices);

        // 새 보기 배열과 정답 인덱스 계산
        const shuffledOptions = shuffledOptionIndices.map(
            (optIdx) => baseQuestion.options[optIdx],
        );

        const newAnswerIndex = shuffledOptionIndices.indexOf(
            baseQuestion.answerIndex,
        );

        // questionIndex +1
        setQuestionIndex((idx) => idx + 1);

        return {
            ...baseQuestion,
            options: shuffledOptions,
            answerIndex: newAnswerIndex,
        };
    };

    const handleSelectMove = (move: Move) => {
        // 최소한의 안전 가드만 유지
        if (state.phase === "finished") return;
        if (playerMon.hp <= 0 || enemyMon.hp <= 0) return;
        if (!questions.length) {
            setState((prev) =>
                pushLog(prev, "[시스템] 이 퀴즈팩에는 문제가 없습니다."),
            );
            return;
        }

        const question = getNextQuestion();
        if (!question) {
            setState((prev) =>
                pushLog(prev, "[시스템] 문제를 불러오는 중 오류가 발생했습니다."),
            );
            return;
        }

        const now = Date.now();

        setState((prev) => ({
            ...prev,
            pendingPlayerMove: { side: "player", move },
            pendingPlayerSwitchIndex: null,
            currentQuestion: question,
            questionStartedAt: now,
            lastQuizResult: null,
            // 여기서 phase를 확실히 quiz 로 전환
            phase: "quiz",
        }));
    };
    const handleSwitch = (targetIndex: number) => {
        // v2: 커맨드 단계에서만, 살아있는 다른 포켓몬으로만 교체 예약
        if (state.phase === "finished") return;
        if (state.phase !== "command") return;

        const targetMon = state.player.monsters[targetIndex];
        if (!targetMon) return;
        if (targetIndex === state.player.activeIndex) return;
        if (targetMon.hp <= 0) return;

        if (!questions.length) {
            setState((prev) =>
                pushLog(prev, "[시스템] 이 퀴즈팩에는 문제가 없습니다."),
            );
            return;
        }

        const question = getNextQuestion();
        if (!question) {
            setState((prev) =>
                pushLog(prev, "[시스템] 문제를 불러오는 중 오류가 발생했습니다."),
            );
            return;
        }

        const now = Date.now();

        setState((prev) => ({
            ...prev,
            // 공격은 예약하지 않고, 교체 대상 인덱스만 기억
            pendingPlayerMove: null,
            pendingEnemyMove: null,
            pendingPlayerSwitchIndex: targetIndex,
            currentQuestion: question,
            questionStartedAt: now,
            lastQuizResult: null,
            phase: "quiz",
        }));
    };


    const handleAnswer = (optionIndex: number) => {
        if (state.phase !== "quiz" || !state.currentQuestion) return;
        const now = Date.now();
        const timeMs =
            state.questionStartedAt != null
                ? now - state.questionStartedAt
                : 9999;

        const correct = optionIndex === state.currentQuestion.answerIndex;
        const quizResult: QuizAnswerResult = {
            questionId: state.currentQuestion.id,
            chosenIndex: optionIndex,
            correct,
            timeMs,
        };

        // 🔹 이번 정답이 레이드에서 줄 "누적 데미지" 점수
        //    v1에서는 "정답 1개 = 10 데미지"로 단순하게 고정
        const raidDamage = correct ? 10 : 0;

        // 🔹 이번 배틀 통계에 반영
        setBattleStats((prev) => ({
            correct: prev.correct + (correct ? 1 : 0),
            total: prev.total + 1,
        }));

        // 밖으로도 한번 전달 (부모에서 별도 처리할 수 있도록)
        onQuizAnswer?.(quizResult);

        // 🎯 Supabase game_events 로깅
        if (roomId && gameSessionId && studentId) {
            logGameEvent({
                roomId,
                gameSessionId,
                studentId,
                eventType: "quizmon-answer",
                payload: {
                    source: "quizmon",
                    questionId: quizResult.questionId,
                    answerIndex: quizResult.chosenIndex,
                    correct: quizResult.correct,
                    timeMs: quizResult.timeMs ?? null,
                    // 🔹 클래스 레이드용 누적 데미지
                    raidDamage,
                },
            });
        } else {
            console.warn("[QuizMonGame] skip logGameEvent – missing ids", {
                roomId,
                gameSessionId,
                studentId,
            });
        }

        // 한 번에 player → enemy 순으로만 처리 (샌드박스 단순화)
        setState((prev) => {
            const hasPendingSwitch = prev.pendingPlayerSwitchIndex != null;
            const hasPendingMove = !!prev.pendingPlayerMove;
            if (!hasPendingMove && !hasPendingSwitch) {
                return {
                    ...prev,
                    lastQuizResult: quizResult,
                    phase: "command",
                    currentQuestion: null,
                    questionStartedAt: null,
                };
            }

            let next: BattleState = { ...prev, lastQuizResult: quizResult };

            // 🔹 1) 교체 액션 우선 처리
            if (hasPendingSwitch) {
                const switchIndex = prev.pendingPlayerSwitchIndex!;
                const targetMonBeforeCheck = prev.player.monsters[switchIndex];

                // 타겟이 없거나 이미 쓰러져 있으면 교체 취소
                if (!targetMonBeforeCheck || targetMonBeforeCheck.hp <= 0) {
                    next = pushLog(
                        next,
                        "[시스템] 교체 대상 포켓몬이 유효하지 않아 교체에 실패했습니다.",
                    );

                    return {
                        ...next,
                        pendingPlayerMove: null,
                        pendingEnemyMove: null,
                        pendingPlayerSwitchIndex: null,
                        currentQuestion: null,
                        questionStartedAt: null,
                        phase: "command",
                    };
                }

                // 1-1) 우선 교체부터 반영
                next = {
                    ...next,
                    player: {
                        ...next.player,
                        activeIndex: switchIndex,
                    },
                };

                const switchedMon =
                    next.player.monsters[next.player.activeIndex];

                // ✅ 정답인 경우: 데미지 없이 안전하게 교체만 하고 턴 종료
                if (quizResult.correct) {
                    next = pushLog(
                        next,
                        `[시스템] 문제를 맞추고 ${switchedMon.name}(으)로 안전하게 교체했습니다.`,
                    );

                    return {
                        ...next,
                        pendingPlayerMove: null,
                        pendingEnemyMove: null,
                        pendingPlayerSwitchIndex: null,
                        currentQuestion: null,
                        questionStartedAt: null,
                        phase: "command",
                    };
                }

                // ❌ 오답인 경우: 교체는 되지만 적의 무료 공격 1회 허용
                next = pushLog(
                    next,
                    `[시스템] 문제를 틀려 교체 도중 공격을 받았습니다!`,
                );

// ▶ "지금" 전투에 나와 있는 적과 교체된 우리 포켓몬 기준으로 다시 계산
                const enemyActive =
                    next.enemy.monsters[next.enemy.activeIndex];
                const defenderBefore =
                    next.player.monsters[next.player.activeIndex];

// 적이 살아 있고, 사용할 기술이 하나라도 있을 때만 무료 공격
                const enemyMove = enemyActive?.moves?.[0];

                if (enemyActive && enemyActive.hp > 0 && enemyMove) {
                    const enemyQuizMod = 1.0;
                    const enemyHitChance = calcHitChance(
                        defenderBefore, // 수비: 방금 교체된 포켓몬
                        enemyMove, // 공격 기술
                        enemyQuizMod,
                    );

                    let enemyLog = `[적] ${enemyMove.name}으로 교체한 ${defenderBefore.name}(을)를 노렸습니다! `;
                    if (rollHit(enemyHitChance)) {
                        const {
                            damage: dmg,
                            isCritical,
                            effectiveness,
                        } = calcDamageWithContext(
                            enemyActive,
                            defenderBefore,
                            enemyMove,
                        );

                        const damaged = applyDamageToMonster(
                            defenderBefore,
                            dmg,
                        );
                        const newPlayerMons = [...next.player.monsters];
                        newPlayerMons[next.player.activeIndex] = damaged;

                        next = {
                            ...next,
                            player: {
                                ...next.player,
                                monsters: newPlayerMons,
                            },
                        };

                        enemyLog += `${dmg} 데미지! (HP ${defenderBefore.hp} → ${damaged.hp})`;

                        const effComment = getEffectivenessComment(
                            enemyMove.element,
                            defenderBefore,
                        );
                        if (effComment) {
                            enemyLog += ` ${effComment}`;
                        }
                        if (isCritical) {
                            enemyLog += " 급소에 맞았다!";
                        }

                        // 🔹 팝업 (타겟: player)
                        spawnDamagePopup(
                            "player",
                            dmg,
                            isCritical,
                            effectiveness,
                        );
                    } else {
                        enemyLog += "하지만 빗나갔다!";
                    }

                    next = pushLog(next, enemyLog);
                }


                // 🧹 교체 후에도 쓰러진 포켓몬/승패 여부는 챙겨줘야 함
                const playerMonsAfter = next.player.monsters;
                const enemyMonsAfter = next.enemy.monsters;

                // 자동 교체 (플레이어)
                if (
                    playerMonsAfter[next.player.activeIndex] &&
                    playerMonsAfter[next.player.activeIndex].hp <= 0
                ) {
                    const nextAliveIndex = playerMonsAfter.findIndex(
                        (m) => m.hp > 0,
                    );
                    if (
                        nextAliveIndex >= 0 &&
                        nextAliveIndex !== next.player.activeIndex
                    ) {
                        next = {
                            ...next,
                            player: {
                                ...next.player,
                                activeIndex: nextAliveIndex,
                            },
                        };
                        next = pushLog(
                            next,
                            `[시스템] ${playerMonsAfter[nextAliveIndex].name}(이)가 대신 싸우러 나왔습니다!`,
                        );
                    }
                }

                // 자동 교체 (적)
                if (
                    enemyMonsAfter[next.enemy.activeIndex] &&
                    enemyMonsAfter[next.enemy.activeIndex].hp <= 0
                ) {
                    const nextAliveIndex = enemyMonsAfter.findIndex(
                        (m) => m.hp > 0,
                    );
                    if (
                        nextAliveIndex >= 0 &&
                        nextAliveIndex !== next.enemy.activeIndex
                    ) {
                        next = {
                            ...next,
                            enemy: {
                                ...next.enemy,
                                activeIndex: nextAliveIndex,
                            },
                        };
                        next = pushLog(
                            next,
                            `[시스템] 상대의 ${enemyMonsAfter[nextAliveIndex].name}(이)가 대신 나왔습니다!`,
                        );
                    }
                }

                // 전멸 체크
                const playerAllFainted = next.player.monsters.every(
                    (m) => m.hp <= 0,
                );
                const enemyAllFainted = next.enemy.monsters.every(
                    (m) => m.hp <= 0,
                );

                if (playerAllFainted || enemyAllFainted) {
                    next = {
                        ...next,
                        phase: "finished",
                    };
                    const resultText = playerAllFainted
                        ? enemyAllFainted
                            ? "무승부!"
                            : "패배…"
                        : "승리!";
                    next = pushLog(
                        next,
                        `[시스템] 배틀 종료: ${resultText}`,
                    );
                } else {
                    next = {
                        ...next,
                        phase: "command",
                    };
                }

                return {
                    ...next,
                    pendingPlayerMove: null,
                    pendingEnemyMove: null,
                    pendingPlayerSwitchIndex: null,
                    currentQuestion: null,
                    questionStartedAt: null,
                };
            }

            //  최신 몬스터 상태는 prev에서 다시 뽑자 (클로저 오염 방지)
            const prevPlayerMon =
                prev.player.monsters[prev.player.activeIndex];
            const prevEnemyMon =
                prev.enemy.monsters[prev.enemy.activeIndex];

            // 🔒 여기서 한 번 더 널 가드 (TS18047 방지용)
            const pendingPlayerMove = prev.pendingPlayerMove;
            if (!pendingPlayerMove) {
                // 논리상 거의 안 오는 분기지만, 안전하게 커맨드로 복귀
                return {
                    ...next,
                    pendingPlayerMove: null,
                    pendingEnemyMove: null,
                    pendingPlayerSwitchIndex: null,
                    currentQuestion: null,
                    questionStartedAt: null,
                    phase: "command",
                };
            }


            // 1) 플레이어 공격
            const quizMod = calcQuizMod(quizResult);
            const hitChance = calcHitChance(
                prevEnemyMon, // defender
                pendingPlayerMove.move,
                quizMod,
            );

            let playerLog = `[플레이어] ${pendingPlayerMove.move.name}을(를) 사용했다! (명중률 ${hitChance.toFixed(
                1,
            )}%) `;
            if (rollHit(hitChance)) {
                const {
                    damage: dmg,
                    isCritical,
                    effectiveness,
                } = calcDamageWithContext(
                    prevPlayerMon,
                    prevEnemyMon,
                    pendingPlayerMove.move,
                );

                const newEnemyMon = applyDamageToMonster(prevEnemyMon, dmg);

                const newEnemyMons = [...prev.enemy.monsters];
                newEnemyMons[prev.enemy.activeIndex] = newEnemyMon;

                next = {
                    ...next,
                    enemy: {
                        ...prev.enemy,
                        monsters: newEnemyMons,
                    },
                };

                playerLog += `${dmg} 데미지! (HP ${prevEnemyMon.hp} → ${newEnemyMon.hp})`;

                // 🔹 상성 코멘트 추가
                const effComment = getEffectivenessComment(
                    pendingPlayerMove.move.element,
                    prevEnemyMon,
                );
                if (effComment) {
                    playerLog += ` ${effComment}`;
                }

                // 🔹 크리티컬 코멘트
                if (isCritical) {
                    playerLog += " 급소에 맞았다!";
                }

                // 🔹 데미지 팝업 (타겟: enemy)
                spawnDamagePopup("enemy", dmg, isCritical, effectiveness);
            } else {
                playerLog += "하지만 빗나갔다!";
            }

            next = pushLog(next, playerLog);


            // 2) 적이 살아있으면 적도 공격 (퀴즈 보정 없이 평균값 가정)
            if (next.enemy.monsters[next.enemy.activeIndex].hp > 0) {
                const pendingEnemyMove = prev.pendingEnemyMove;
                if (pendingEnemyMove) {
                    const enemyQuizMod = 1.0;
                    const enemyHitChance = calcHitChance(
                        prevPlayerMon, // defender
                        pendingEnemyMove.move,
                        enemyQuizMod,
                    );

                    let enemyLog = `[적] ${pendingEnemyMove.move.name}을(를) 사용했다! `;
                    if (rollHit(enemyHitChance)) {
                        const {
                            damage: dmg,
                            isCritical,
                            effectiveness,
                        } = calcDamageWithContext(
                            prevEnemyMon,
                            prevPlayerMon,
                            pendingEnemyMove.move,
                        );

                        const newPlayerMon = applyDamageToMonster(
                            prevPlayerMon,
                            dmg,
                        );

                        const newPlayerMons = [...prev.player.monsters];
                        newPlayerMons[prev.player.activeIndex] = newPlayerMon;

                        next = {
                            ...next,
                            player: {
                                ...prev.player,
                                monsters: newPlayerMons,
                            },
                        };

                        enemyLog += `${dmg} 데미지! (HP ${prevPlayerMon.hp} → ${newPlayerMon.hp})`;

                        const effComment = getEffectivenessComment(
                            pendingEnemyMove.move.element,
                            prevPlayerMon,
                        );
                        if (effComment) {
                            enemyLog += ` ${effComment}`;
                        }
                        if (isCritical) {
                            enemyLog += " 급소에 맞았다!";
                        }

                        // 🔹 팝업 (타겟: player)
                        spawnDamagePopup(
                            "player",
                            dmg,
                            isCritical,
                            effectiveness,
                        );
                    } else {
                        enemyLog += "빗나갔다!";
                    }

                    next = pushLog(next, enemyLog);
                }
            }


            // 3) 승패 체크 + 파티 교체 로직
            const playerMons = next.player.monsters;
            const enemyMons = next.enemy.monsters;
            
            // 🔁 플레이어: 현재 포켓몬이 쓰러졌으면 다음 살아있는 파티원으로 자동 교체
            if (playerMons[next.player.activeIndex]?.hp <= 0) {
                const nextAliveIndex = playerMons.findIndex((m) => m.hp > 0);
                if (
                    nextAliveIndex >= 0 &&
                    nextAliveIndex !== next.player.activeIndex
                ) {
                    next = {
                        ...next,
                            player: {
                            ...next.player,
                                    activeIndex: nextAliveIndex,
                            },
                    };
                    next = pushLog(
                        next,
                        `[시스템] ${playerMons[nextAliveIndex].name}(이)가 대신 싸우러 나왔습니다!`,
                    );
                }
            }
            
            // 🔁 적도 동일하게 처리 (던전에서 적 여러 마리 대비)
            if (enemyMons[next.enemy.activeIndex]?.hp <= 0) {
                const nextAliveIndex = enemyMons.findIndex((m) => m.hp > 0);
                if (
                    nextAliveIndex >= 0 &&
                    nextAliveIndex !== next.enemy.activeIndex
                ) {
                    next = {
                        ...next,
                            enemy: {
                            ...next.enemy,
                                    activeIndex: nextAliveIndex,
                            },
                    };
                    next = pushLog(
                        next,
                        `[시스템] 상대의 ${enemyMons[nextAliveIndex].name}(이)가 대신 나왔습니다!`,
                    );
                }
            }
            
            // 🔚 진짜로 모든 포켓몬이 쓰러졌는지 체크
            const playerAllFainted = next.player.monsters.every(
                (m) => m.hp <= 0,
            );
            const enemyAllFainted = next.enemy.monsters.every(
                (m) => m.hp <= 0,
            );
            
            if (playerAllFainted || enemyAllFainted) {
                // 배틀 종료
                next = {
                    ...next,
                        phase: "finished",
                };
                const resultText = playerAllFainted
                    ? enemyAllFainted
                        ? "무승부!"
                        : "패배…"
                    : "승리!";
                next = pushLog(
                    next,
                    `[시스템] 배틀 종료: ${resultText}`,
                );
            } else {
                // 그 외에는 다시 커맨드 phase로
                next = {
                    ...next,
                    phase: "command",
                };
            }

            return {
                ...next,
                pendingPlayerMove: null,
                pendingEnemyMove: null,
                pendingPlayerSwitchIndex: null,
                currentQuestion: null,
                questionStartedAt: null,
            };
        });
    };

    // 적은 일단 영구히 첫 번째 기술만 쓰는 더미 AI
    useEffect(() => {
        if (!state.pendingEnemyMove && state.phase === "command") {
            const enemyMove = enemyMon.moves[0];
            if (!enemyMove) return;
            setState((prev) => ({
                ...prev,
                pendingEnemyMove: {
                    side: "enemy",
                    move: enemyMove,
                },
            }));
        }
    }, [state.phase, state.pendingEnemyMove, enemyMon]);

    // 배틀이 끝난 시점에 한 번만 onBattleEnd 호출
    useEffect(() => {
        if (!onBattleEnd) return;
        if (state.phase !== "finished") return;
        if (hasReportedEnd) return;
        if (battleStats.total <= 0) return; // 한 문제도 풀지 않았다면 스킵

        onBattleEnd({ ...battleStats });
        setHasReportedEnd(true);
    }, [state.phase, battleStats, onBattleEnd, hasReportedEnd]);

    const canSelectMove =
        state.phase !== "finished" &&
        questions.length > 0 &&
        playerMon.hp > 0 &&
        enemyMon.hp > 0;

    const accuracyPercent =
        battleStats.total > 0
            ? Math.round((battleStats.correct / battleStats.total) * 100)
            : null;

    const battleFinished =
        state.player.monsters.every((m) => m.hp <= 0) ||
        state.enemy.monsters.every((m) => m.hp <= 0);

    return {
        state,
        setState,
        questions,
        questionIndex,
        setQuestionIndex,
        questionOrder,
        setQuestionOrder,
        battleStats,
        setBattleStats,
        hasReportedEnd,
        setHasReportedEnd,
        playerMon,
        enemyMon,
        canSelectMove,
        accuracyPercent,
        battleFinished,
        damagePopups,
        handleSelectMove,
        handleAnswer,
        handleSwitch,
    };
}
