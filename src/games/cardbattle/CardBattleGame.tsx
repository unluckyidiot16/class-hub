// src/games/cardbattle/CardBattleGame.tsx
import { useEffect, useMemo, useState } from "react";
import type { GameState, PlayerId, AttackCard } from "./cardBattleTypes";
import {
    createInitialGameState,
    handleTimeout,
    playAttackCard,
    useDefenseCard,
    resolveQuizResult,
} from "./cardBattleLogic";
import quizPack from "./packs/grade4-mixed.json";

// 카드배틀 전용 로컬 타입 (QuizPackJsonV1 대신 사용)
type CardBattleQuestion = {
    id: string;
    index: number;
    subject: string;
    prompt: string;
    options: string[];
    answerIndex: number;
};

type CardBattlePack = {
    type: string;
    version: string;
    meta?: any;
    pack?: any;
    questions: CardBattleQuestion[];
};

const PACK = quizPack as CardBattlePack;

type Props = {
    p1Name?: string;
    p2Name?: string;
};

export function CardBattleGame({ p1Name = "Player 1", p2Name = "Player 2" }: Props) {
    const [game, setGame] = useState<GameState>(() =>
        createInitialGameState(p1Name, p2Name),
    );

    // 타이머용 현재 시각
    const [nowMs, setNowMs] = useState<number>(() => Date.now());

    // 문제 타이머용 이펙트
    useEffect(() => {
        if (!game.activeQuestion || game.status !== "playing") return;
        const timer = setInterval(() => {
            setNowMs(Date.now());
        }, 200);
        return () => clearInterval(timer);
    }, [game.activeQuestion, game.status]);

    // 시간 초과 처리
    useEffect(() => {
        if (!game.activeQuestion || game.status !== "playing") return;
        if (nowMs >= game.activeQuestion.deadlineAt) {
            setGame((prev) => handleTimeout(prev));
        }
    }, [nowMs, game.activeQuestion, game.status]);

    const p1 = game.players.P1;
    const p2 = game.players.P2;

    const activeQuestion = game.activeQuestion;
    const currentQuestion = useMemo(() => {
        if (!activeQuestion) return null;
        return PACK.questions.find((q) => q.id === activeQuestion.questionId) ?? null;
    }, [activeQuestion]);

    const remainingSeconds = useMemo(() => {
        if (!activeQuestion) return 0;
        const diff = Math.ceil((activeQuestion.deadlineAt - nowMs) / 1000);
        return diff > 0 ? diff : 0;
    }, [activeQuestion, nowMs]);

    function resetGame() {
        setGame(createInitialGameState(p1Name, p2Name));
    }

    function pickRandomQuestionId(subject: string): string | null {
        const candidates = PACK.questions.filter((q: any) => q.subject === subject);
        if (candidates.length === 0) return null;
        const idx = Math.floor(Math.random() * candidates.length);
        const choice = candidates[idx];
        if (!choice) return null;
        return choice.id;
    }

    function handlePlayAttack(card: AttackCard) {
        setGame((prev) => {
            if (prev.status !== "playing") return prev;
            if (prev.activeQuestion) return prev;
            if (prev.currentTurn !== getMyTurnForAttack(prev)) return prev;

            const qid = pickRandomQuestionId(card.subject);
            if (!qid) return prev;

            const updated = playAttackCard(
                prev,
                prev.currentTurn,
                card.id,
                card.subject,
                qid,
                Date.now(),
                7000,
            );
            return updated;
        });
    }

    // 로컬 테스트에서는 currentTurn 플레이어만 공격 가능하도록 체크
    function getMyTurnForAttack(state: GameState): PlayerId {
        return state.currentTurn;
    }

    function handleAnswer(optionIndex: number) {
        if (!activeQuestion || !currentQuestion) return;
        const correct = optionIndex === currentQuestion.answerIndex;
        setGame((prev) => resolveQuizResult(prev, correct));
    }

    function handleUseDefense() {
        if (!activeQuestion) return;
        setGame((prev) => useDefenseCard(prev, activeQuestion.defenderId));
    }

    const defender = activeQuestion ? game.players[activeQuestion.defenderId] : null;
    const defenderDefenseCount =
        defender?.hand.filter((c) => c.type === "defense").length ?? 0;

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                padding: "1rem",
                fontSize: "0.9rem",
            }}
        >
            {/* 상단: 플레이어 정보 / 점수 */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.5rem 0.75rem",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    background: "#f9fafb",
                }}
            >
                <div>
                    <div>
                        <strong>{p1.name}</strong> (P1)
                    </div>
                    <div>공격 성공: {p1.hitsGiven} / 3</div>
                </div>
                <div>
                    <div>
                        <strong>{p2.name}</strong> (P2)
                    </div>
                    <div>공격 성공: {p2.hitsGiven} / 3</div>
                </div>
                <div>
                    {game.status === "finished" ? (
                        <div>
                            <strong>승자:</strong>{" "}
                            {game.winnerId ? game.players[game.winnerId].name : "-"}
                        </div>
                    ) : (
                        <div>
                            <strong>현재 턴:</strong>{" "}
                            {game.players[game.currentTurn].name}
                        </div>
                    )}
                    <button
                        onClick={resetGame}
                        style={{
                            marginTop: "0.25rem",
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.75rem",
                            borderRadius: 6,
                            border: "1px solid #e5e7eb",
                            background: "#fff",
                            cursor: "pointer",
                        }}
                    >
                        다시 시작
                    </button>
                </div>
            </div>

            {/* 중단: 로그 대체 간단 설명 */}
            <div
                style={{
                    minHeight: 60,
                    borderRadius: 8,
                    border: "1px dashed #cbd5f5",
                    padding: "0.5rem 0.75rem",
                    background: "#eef2ff",
                }}
            >
                {game.status === "finished" ? (
                    <div>
                        게임 종료!{" "}
                        {game.winnerId
                            ? `${game.players[game.winnerId].name}의 승리입니다.`
                            : ""}
                    </div>
                ) : game.activeQuestion ? (
                    <div>
                        <strong>
                            {
                                game.players[game.activeQuestion.attackerId]
                                    .name
                            }
                        </strong>
                        이(가){" "}
                        <strong>
                            {subjectLabel(game.activeQuestion.subject)}
                        </strong>{" "}
                        공격 카드를 사용했습니다!
                    </div>
                ) : (
                    <div>
                        <strong>
                            {game.players[game.currentTurn].name}
                        </strong>
                        의 차례입니다. 공격 카드를 선택해 보세요.
                    </div>
                )}
            </div>

            {/* 하단: P1 / P2 손패 보여주기 (테스트용) */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.75rem",
                }}
            >
                <PlayerHandView
                    label="P1 손패"
                    player={p1}
                    isCurrentTurn={game.currentTurn === "P1"}
                    onPlayAttack={handlePlayAttack}
                />
                <PlayerHandView
                    label="P2 손패"
                    player={p2}
                    isCurrentTurn={game.currentTurn === "P2"}
                    onPlayAttack={handlePlayAttack}
                />
            </div>

            {/* 문제 모달 */}
            {activeQuestion && currentQuestion && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(15,23,42,0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 50,
                    }}
                >
                    <div
                        style={{
                            width: "min(480px, 100% - 2rem)",
                            background: "#fff",
                            borderRadius: 12,
                            padding: "1rem",
                            boxShadow: "0 10px 30px rgba(15,23,42,0.35)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <div>
                                <strong>
                                    {
                                        game.players[activeQuestion.defenderId]
                                            .name
                                    }
                                </strong>
                                님, 문제를 풀어주세요!
                            </div>
                            <div
                                style={{
                                    fontSize: "0.8rem",
                                    padding: "0.2rem 0.5rem",
                                    borderRadius: 999,
                                    background:
                                        remainingSeconds <= 3
                                            ? "#fee2e2"
                                            : "#eff6ff",
                                    color:
                                        remainingSeconds <= 3
                                            ? "#b91c1c"
                                            : "#1d4ed8",
                                }}
                            >
                                남은 시간: {remainingSeconds}초
                            </div>
                        </div>

                        <div
                            style={{
                                padding: "0.5rem 0.75rem",
                                borderRadius: 8,
                                background: "#f9fafb",
                                whiteSpace: "pre-line",
                            }}
                        >
                            {currentQuestion.prompt}
                        </div>

                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.5rem",
                            }}
                        >
                            {currentQuestion.options.map(
                                (opt: string, idx: number) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleAnswer(idx)}
                                        style={{
                                            textAlign: "left",
                                            padding: "0.4rem 0.6rem",
                                            borderRadius: 8,
                                            border: "1px solid #e5e7eb",
                                            background: "#fff",
                                            cursor: "pointer",
                                            fontSize: "0.85rem",
                                        }}
                                    >
                                        {String.fromCharCode(65 + idx)}. {opt}
                                    </button>
                                ),
                            )}
                        </div>

                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginTop: "0.5rem",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "0.8rem",
                                    color: "#6b7280",
                                }}
                            >
                                과목: {subjectLabel(activeQuestion.subject)}
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button
                                    disabled={defenderDefenseCount <= 0}
                                    onClick={handleUseDefense}
                                    style={{
                                        padding: "0.35rem 0.7rem",
                                        borderRadius: 999,
                                        border: "1px solid #e5e7eb",
                                        background:
                                            defenderDefenseCount > 0
                                                ? "#eef2ff"
                                                : "#f9fafb",
                                        cursor:
                                            defenderDefenseCount > 0
                                                ? "pointer"
                                                : "not-allowed",
                                        fontSize: "0.8rem",
                                    }}
                                >
                                    방어 카드 사용 (
                                    {defenderDefenseCount}장 남음)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

type PlayerHandViewProps = {
    label: string;
    player: GameState["players"][PlayerId];
    isCurrentTurn: boolean;
    onPlayAttack: (card: AttackCard) => void;
};

function PlayerHandView({
                            label,
                            player,
                            isCurrentTurn,
                            onPlayAttack,
                        }: PlayerHandViewProps) {
    return (
        <div
            style={{
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                padding: "0.5rem 0.75rem",
                background: "#fff",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "0.25rem",
                    fontSize: "0.8rem",
                }}
            >
                <div>
                    <strong>{label}</strong> — {player.name}
                </div>
                <div>
                    덱 {player.deck.length} / 버림 {player.discard.length}
                </div>
            </div>
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.35rem",
                }}
            >
                {player.hand.map((card) => {
                    const isAttack = card.type === "attack";
                    const canUse = isAttack && isCurrentTurn;
                    return (
                        <button
                            key={card.id}
                            disabled={!canUse}
                            onClick={() =>
                                isAttack && onPlayAttack(card as AttackCard)
                            }
                            style={{
                                minWidth: 80,
                                padding: "0.3rem 0.4rem",
                                borderRadius: 8,
                                border: "1px solid #e5e7eb",
                                fontSize: "0.75rem",
                                background: isAttack
                                    ? canUse
                                        ? "#fefce8"
                                        : "#f9fafb"
                                    : "#eef2ff",
                                cursor: canUse ? "pointer" : "default",
                            }}
                        >
                            {card.type === "attack"
                                ? `공격: ${subjectLabel(card.subject)}`
                                : "방어 카드"}
                        </button>
                    );
                })}
                {player.hand.length === 0 && (
                    <div
                        style={{
                            fontSize: "0.8rem",
                            color: "#9ca3af",
                        }}
                    >
                        손패가 없습니다.
                    </div>
                )}
            </div>
        </div>
    );
}

function subjectLabel(subject: string): string {
    switch (subject) {
        case "kor":
            return "국어";
        case "eng":
            return "영어";
        case "math":
            return "수학";
        case "social":
            return "사회";
        case "science":
            return "과학";
        default:
            return subject;
    }
}
