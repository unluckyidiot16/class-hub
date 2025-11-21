// src/games/quizmon/QuizMonGame.tsx
import { useEffect, useMemo, useState } from "react";
import { quizPackToLiteQuestions } from "./quizSource";
import { logGameEvent } from "../../api/gameSessions";
import {
    applyDamageToMonster,
    calcDamage,
    calcHitChance,
    calcQuizMod,
    pushLog,
    rollHit,
} from "./logic";
import {
    createInitialBattleState,
} from "./mockData"; // 트레이너/몬스터 기본값은 일단 mockData에서


import type {
    BattleState,
    Move,
    QuizAnswerResult,
    QuizQuestionLite,
} from "./types";
import type { QuizPackJsonV1 } from "../../types/quizPackJson";

type QuizMonGameProps = {
    quizpack: QuizPackJsonV1;

    /** 정답 제출 시 호출 (이미 있음) */
    onQuizAnswer?: (result: QuizAnswerResult) => void;

    /** 배틀이 끝났을 때 한 번 호출 */
    onBattleEnd?: (summary: { correct: number; total: number }) => void;

    /** Supabase game_events 로그용 식별자들 (없으면 로깅 스킵) */
    roomId?: string | null;
    gameSessionId?: string | null;
    studentId?: string | null;
};


export function QuizMonGame(props: QuizMonGameProps) {
    const {
        quizpack,
        onQuizAnswer,
        onBattleEnd,
        roomId,
        gameSessionId,
        studentId,
    } = props;

    // 1) 전투 상태
    const [state, setState] = useState<BattleState>(() =>
        createInitialBattleState(),
    );
    const [questionIndex, setQuestionIndex] = useState(0);

    // 이번 배틀에서 학생이 푼 퀴즈 집계
    const [battleStats, setBattleStats] = useState({ correct: 0, total: 0 });
    const [hasReportedEnd, setHasReportedEnd] = useState(false);


    // 2) 퀴즈 소스: quizpackJson → Lite 배열
    const questions: QuizQuestionLite[] = useMemo(
        () => quizPackToLiteQuestions(quizpack),
        [quizpack],
    );

    const playerMon = useMemo(
        () => state.player.monsters[state.player.activeIndex],
        [state.player],
    );
    const enemyMon = useMemo(
        () => state.enemy.monsters[state.enemy.activeIndex],
        [state.enemy],
    );

    // 적은 일단 영구히 첫 번째 기술만 쓰는 더미 AI
    useEffect(() => {
        if (!state.pendingEnemyMove && state.phase === "command") {
            const enemyMove = enemyMon.moves[0];
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


    /** 현재 질문 선택 (없으면 null) */
    const getNextQuestion = (): QuizQuestionLite | null => {
        if (!questions || questions.length === 0) return null;
        return questions[questionIndex % questions.length];
    };

    const handleSelectMove = (move: Move) => {
        if (state.phase !== "command") return;
        if (playerMon.hp <= 0 || enemyMon.hp <= 0) return;
        if (!questions.length) {
            // 퀴즈가 없으면 실행 불가
            setState((prev) =>
                pushLog(prev, "[시스템] 이 퀴즈팩에는 문제가 없습니다."),
            );
            return;
        }

        const question = getNextQuestion();
        const now = Date.now();

        setQuestionIndex((idx) => idx + 1);

        setState((prev) => ({
            ...prev,
            pendingPlayerMove: { side: "player", move },
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

        // 🔹 이번 배틀 통계에 반영
        setBattleStats((prev) => ({
            correct: prev.correct + (correct ? 1 : 0),
            total: prev.total + 1,
        }));

        // 밖으로도 한번 전달 (부모에서 별도 처리할 수 있도록)
        onQuizAnswer?.(quizResult);

        // 🎯 Supabase game_events 로깅
        // QDD 통계 파이프라인을 그대로 재사용할 수 있도록
        // payload는 questionId / answerIndex / correct / timeMs 형태로 맞춘다.
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
                },
            }).catch((err) => {
                console.warn(
                    "[QuizMonGame] failed to log game event",
                    err,
                );
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
                prevEnemyMon,                    // defender
                prev.pendingPlayerMove.move,
                quizMod,
            );

            let logText = `[플레이어] ${
                prev.pendingPlayerMove.move.name
            } (명중률 ${hitChance.toFixed(1)}%) → `;

            if (rollHit(hitChance)) {
                const dmg = calcDamage(
                    prevPlayerMon,
                    prevEnemyMon,
                    prev.pendingPlayerMove.move,
                );
                const newEnemyMon = applyDamageToMonster(
                    prevEnemyMon,
                    dmg,
                );
                const newEnemyMons = [...prev.enemy.monsters];
                newEnemyMons[prev.enemy.activeIndex] = newEnemyMon;

                next = {
                    ...next,
                    enemy: { ...prev.enemy, monsters: newEnemyMons },
                };
                logText += `${dmg} 데미지! (HP ${prevEnemyMon.hp} → ${newEnemyMon.hp})`;
            } else {
                logText += "빗나갔다!";
            }

            next = pushLog(next, logText);

            // 2) 적이 살아 있으면 적 공격도 처리 (퀴즈 영향 없이 평균값으로)
            const enemyStillAlive =
                next.enemy.monsters[next.enemy.activeIndex].hp > 0;
            if (enemyStillAlive && prev.pendingEnemyMove) {
                const enemyQuizMod = 1.0; // 적은 항상 평균 정도라고 가정
                const enemyHitChance = calcHitChance(
                    prevPlayerMon,                   // defender
                    prev.pendingEnemyMove.move,
                    enemyQuizMod,
                );
                let enemyLog = `[적] ${
                    prev.pendingEnemyMove.move.name
                } (명중률 ${enemyHitChance.toFixed(1)}%) → `;

                if (rollHit(enemyHitChance)) {
                    const dmg = calcDamage(
                        prevEnemyMon,
                        prevPlayerMon,
                        prev.pendingEnemyMove.move,
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

            // 3) 승패 체크
            const playerHp =
                next.player.monsters[next.player.activeIndex].hp;
            const enemyHp =
                next.enemy.monsters[next.enemy.activeIndex].hp;
            let phase: typeof next.phase = "command";

            if (playerHp <= 0 || enemyHp <= 0) {
                phase = "finished";
                const resultText =
                    playerHp <= 0 && enemyHp <= 0
                        ? "무승부!"
                        : playerHp <= 0
                            ? "패배…"
                            : "승리!";
                next = pushLog(next, `[시스템] 배틀 종료: ${resultText}`);
            }

            return {
                ...next,
                phase,
                currentQuestion: null,
                questionStartedAt: null,
                pendingPlayerMove: null,
                pendingEnemyMove: null,
                turn: prev.turn + 1,
            };
        });
    };

    const handleReset = () => {
        setState(createInitialBattleState());
        setQuestionIndex(0);
        setBattleStats({ correct: 0, total: 0 });
        setHasReportedEnd(false);
    };


    return (
        <div style={{ padding: "1.5rem", maxWidth: 960, margin: "0 auto" }}>
            <h1>QuizMon Class – Battle Core</h1>
            <p style={{ fontSize: 13, color: "#aaa" }}>
                현재는 quizpackJson 기반 전투 코어 테스트용 UI입니다.
            </p>

            <section
                style={{
                    display: "flex",
                    gap: "1rem",
                    marginTop: "1rem",
                    alignItems: "flex-start",
                }}
            >
                {/* 플레이어 측 */}
                <div
                    style={{
                        flex: 1,
                        border: "1px solid #444",
                        padding: "0.75rem",
                        borderRadius: 8,
                    }}
                >
                    <h2>플레이어</h2>
                    <p>
                        트레이너:{" "}
                        <strong>{state.player.trainer.name}</strong>
                    </p>
                    <p>
                        몬스터:{" "}
                        <strong>{playerMon.name}</strong> (HP {playerMon.hp}/
                        {playerMon.maxHp})
                    </p>

                    <h3>기술 선택</h3>
                    {state.phase !== "command" && (
                        <p style={{ fontSize: 12, color: "#888" }}>
                            현재 턴에서는 기술을 선택할 수 없습니다.
                        </p>
                    )}
                    {!questions.length && (
                        <p style={{ fontSize: 12, color: "#f66" }}>
                            이 퀴즈팩에는 문제가 없습니다. (질문 0개)
                        </p>
                    )}
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.5rem",
                        }}
                    >
                        {playerMon.moves.map((move) => (
                            <button
                                key={move.id}
                                onClick={() => handleSelectMove(move)}
                                disabled={
                                    state.phase !== "command" ||
                                    !questions.length
                                }
                                style={{
                                    padding: "0.5rem 0.75rem",
                                    borderRadius: 6,
                                    border: "1px solid #666",
                                    cursor:
                                        state.phase === "command" &&
                                        questions.length
                                            ? "pointer"
                                            : "not-allowed",
                                }}
                            >
                                <div style={{ fontWeight: 600 }}>
                                    {move.name}
                                </div>
                                <div style={{ fontSize: 12 }}>
                                    위력 {move.power} / 명중{" "}
                                    {move.baseAcc}%
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 적 측 */}
                <div
                    style={{
                        flex: 1,
                        border: "1px solid #444",
                        padding: "0.75rem",
                        borderRadius: 8,
                    }}
                >
                    <h2>적</h2>
                    <p>
                        트레이너:{" "}
                        <strong>{state.enemy.trainer.name}</strong>
                    </p>
                    <p>
                        몬스터:{" "}
                        <strong>{enemyMon.name}</strong> (HP {enemyMon.hp}/
                        {enemyMon.maxHp})
                    </p>
                </div>
            </section>

            {/* 퀴즈 영역 */}
            {state.phase === "quiz" && state.currentQuestion && (
                <section
                    style={{
                        marginTop: "1rem",
                        padding: "0.75rem",
                        borderRadius: 8,
                        border: "1px solid #555",
                        background: "#111",
                    }}
                >
                    <h3>퀴즈</h3>
                    <p>{state.currentQuestion.prompt}</p>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                        }}
                    >
                        {state.currentQuestion.options.map((opt, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleAnswer(idx)}
                                style={{
                                    textAlign: "left",
                                    padding: "0.5rem 0.75rem",
                                    borderRadius: 6,
                                    border: "1px solid #666",
                                }}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                    <p
                        style={{
                            fontSize: 12,
                            marginTop: "0.5rem",
                            color: "#aaa",
                        }}
                    >
                        ※ 타이머 UI는 추후 연동. 현재는 클릭 시점까지 시간만 측정합니다.
                    </p>
                </section>
            )}

            {/* 컨트롤 */}
            <section style={{ marginTop: "1rem" }}>
                <button onClick={handleReset}>배틀 리셋</button>
                <span
                    style={{
                        marginLeft: "1rem",
                        fontSize: 12,
                    }}
                >
                    턴: {state.turn}, 현재 단계: {state.phase}
                </span>
            </section>

            {/* 로그 */}
            <section
                style={{
                    marginTop: "1rem",
                    padding: "0.75rem",
                    borderRadius: 8,
                    border: "1px solid #333",
                    maxHeight: 240,
                    overflowY: "auto",
                    background: "#050505",
                    fontSize: 13,
                }}
            >
                <h3>전투 로그</h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {state.logs.map((log) => (
                        <li key={log.id} style={{ marginBottom: 4 }}>
                            {log.text}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
