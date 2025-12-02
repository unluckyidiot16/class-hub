// src/games/quizmon/useQuizmonBattle.ts
import { useEffect, useMemo, useState } from "react";
import type {
    BattleState,
    Move,
    QuizAnswerResult,
    QuizQuestionLite,
    Monster,
} from "./types";
import type { QuizPackJsonV1 } from "../../types/quizPackJson";
import { quizPackToLiteQuestions } from "./quizSource";
import { logGameEvent } from "../../api/gameSessions";
import {
    applyDamageToMonster,
    calcDamage,
    calcHitChance,
    calcQuizMod,
    pushLog,
    rollHit,
    applyAbilityDamageModifier,
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
    setState: React.Dispatch<React.SetStateAction<BattleState>>;

    // 퀴즈 관련
    questions: QuizQuestionLite[];
    questionIndex: number;
    setQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
    questionOrder: number[];
    setQuestionOrder: React.Dispatch<React.SetStateAction<number[]>>;

    // 통계
    battleStats: { correct: number; total: number };
    setBattleStats: React.Dispatch<
        React.SetStateAction<{ correct: number; total: number }>
    >;
    hasReportedEnd: boolean;
    setHasReportedEnd: React.Dispatch<React.SetStateAction<boolean>>;

    // 파생 값들
    playerMon: Monster;
    enemyMon: Monster;
    canSelectMove: boolean;
    accuracyPercent: number | null;
    battleFinished: boolean;

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
            currentQuestion: question,
            questionStartedAt: now,
            lastQuizResult: null,
            // 여기서 phase를 확실히 quiz 로 전환
            phase: "quiz",
        }));
    };
    const handleSwitch = (targetIndex: number) => {
        // v1: 커맨드 단계에서만, 살아있는 다른 포켓몬으로만 교체 허용
        setState((prev) => {
            if (prev.phase === "finished") return prev;
            if (prev.phase !== "command") return prev;

            const nextMon = prev.player.monsters[targetIndex];
            if (!nextMon) return prev;
            if (targetIndex === prev.player.activeIndex) return prev;
            if (nextMon.hp <= 0) return prev;

            let next: BattleState = {
                ...prev,
                player: {
                    ...prev.player,
                    activeIndex: targetIndex,
                },
            };

            next = pushLog(
                next,
                `[시스템] ${nextMon.name}(으)로 교체했습니다.`,
            );

            return next;
        });
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
            if (!prev.pendingPlayerMove) {
                return {
                    ...prev,
                    lastQuizResult: quizResult,
                    phase: "command",
                    currentQuestion: null,
                    questionStartedAt: null,
                };
            }

            let next: BattleState = { ...prev, lastQuizResult: quizResult };

            // 최신 몬스터 상태는 prev에서 다시 뽑자 (클로저 오염 방지)
            const prevPlayerMon =
                prev.player.monsters[prev.player.activeIndex];
            const prevEnemyMon =
                prev.enemy.monsters[prev.enemy.activeIndex];

            // 1) 플레이어 공격
            const quizMod = calcQuizMod(quizResult);
            const hitChance = calcHitChance(
                prevEnemyMon, // defender
                prev.pendingPlayerMove.move,
                quizMod,
            );
            
            let playerLog = `[플레이어] ${prev.pendingPlayerMove.move.name}을(를) 사용했다! (명중률 ${hitChance.toFixed(1)}%) `;
            if (rollHit(hitChance)) {
                const baseDmg = calcDamage(
                    prevPlayerMon,
                    prevEnemyMon,
                    prev.pendingPlayerMove.move,
                );
                const dmg = applyAbilityDamageModifier(
                    prevPlayerMon,
                    prevEnemyMon,
                    prev.pendingPlayerMove.move,
                    baseDmg,
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
            } else {
                playerLog += "하지만 빗나갔다!";
            }

            next = pushLog(next, playerLog);

            // 2) 적이 살아있으면 적도 공격 (퀴즈 보정 없이 평균값 가정)
            if (next.enemy.monsters[next.enemy.activeIndex].hp > 0) {
                if (prev.pendingEnemyMove) {
                    const enemyQuizMod = 1.0;
                    const enemyHitChance = calcHitChance(
                        prevPlayerMon, // defender
                        prev.pendingEnemyMove.move,
                        enemyQuizMod,
                    );

                    let enemyLog = `[적] ${prev.pendingEnemyMove.move.name}을(를) 사용했다! `;
                    if (rollHit(enemyHitChance)) {
                        const baseDmg = calcDamage(
                            prevEnemyMon,
                            prevPlayerMon,
                            prev.pendingEnemyMove.move,
                        );
                        const dmg = applyAbilityDamageModifier(
                            prevEnemyMon,
                            prevPlayerMon,
                            prev.pendingEnemyMove.move,
                            baseDmg,
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
        handleSelectMove,
        handleAnswer,
        handleSwitch,
    };
}
