import { useEffect, useMemo, useRef, useState } from "react";
import type { AttackCard, GameState, PlayerId, Subject } from "./cardBattleTypes";
import {
    createInitialGameState,
    handleTimeout,
    playAttackCard,
    useDefenseCard,
    resolveQuizResult,
} from "./cardBattleLogic";
import { supabase } from "../../lib/supabaseClient";
import quizPack from "./packs/grade4-mixed.json";

// ---- 로컬 퀴즈팩 타입 ----
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

// 공통 스냅샷 / 액션 타입 (Realtime 용)
type CardBattleSnapshot = {
    game: GameState;
    p1ProfileId: string;
    p2ProfileId: string;
};

type CardBattleAction =
    | { type: "PLAY_ATTACK"; playerId: PlayerId; cardId: string; subject: Subject }
    | { type: "ANSWER"; correct: boolean }
    | { type: "DEFENSE" }
    | { type: "TIMEOUT" };

// 공통: 과목별 문제 뽑기
function pickRandomQuestionId(subject: Subject): string | null {
    const candidates = PACK.questions.filter((q) => q.subject === subject);
    if (candidates.length === 0) return null;
    const idx = Math.floor(Math.random() * candidates.length);
    const choice = candidates[idx];
    if (!choice) return null;
    return choice.id;
}

// 공통: 과목 라벨
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

// ======================
// 최상위: CardBattleGame
//  - room/me 정보가 있으면 Realtime 모드
//  - 아니면 로컬 2P 디버그 모드
// ======================
type CardBattleGameProps = any;

export function CardBattleGame(rawProps: CardBattleGameProps) {
    const roomId: string | undefined =
        rawProps?.room?.id ?? rawProps?.roomId ?? rawProps?.room_id;

    const me: any = rawProps?.me ?? rawProps?.profile ?? null;
    const myProfileId: string | undefined = me?.id ?? me?.profile_id;
    const myName: string =
        me?.display_name || me?.nickname || me?.name || "Player";

    if (roomId && myProfileId) {
        return (
            <NetworkCardBattleInner
                roomId={roomId}
                myProfileId={myProfileId}
                myName={myName}
            />
        );
    }

    // room 정보가 없으면 로컬 테스트 버전으로 동작
    return <LocalCardBattleGame />;
}

// ======================
// 1) 로컬 전용 2P 디버그 모드
// ======================
function LocalCardBattleGame() {
    const [game, setGame] = useState<GameState>(() =>
        createInitialGameState("Player 1", "Player 2"),
    );

    const [nowMs, setNowMs] = useState<number>(() => Date.now());

    useEffect(() => {
        if (!game.activeQuestion || game.status !== "playing") return;
        const timer = setInterval(() => {
            setNowMs(Date.now());
        }, 200);
        return () => clearInterval(timer);
    }, [game.activeQuestion, game.status]);

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
        setGame(createInitialGameState("Player 1", "Player 2"));
    }

    function handlePlayAttack(card: AttackCard, owner: PlayerId) {
        setGame((prev) => {
            if (prev.status !== "playing") return prev;
            if (prev.activeQuestion) return prev;
            if (prev.currentTurn !== owner) return prev;

            const qid = pickRandomQuestionId(card.subject);
            if (!qid) return prev;

            const updated = playAttackCard(
                prev,
                owner,
                card.id,
                card.subject,
                qid,
                Date.now(),
                7000,
            );
            return updated;
        });
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
                            <strong>현재 턴:</strong> {game.players[game.currentTurn].name}
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

            {/* 중단: 간단 안내 */}
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
                            {game.players[game.activeQuestion.attackerId].name}
                        </strong>
                        이(가){" "}
                        <strong>{subjectLabel(game.activeQuestion.subject)}</strong>{" "}
                        공격 카드를 사용했습니다!
                    </div>
                ) : (
                    <div>
                        <strong>{game.players[game.currentTurn].name}</strong>
                        의 차례입니다. 공격 카드를 선택해 보세요.
                    </div>
                )}
            </div>

            {/* 하단: P1 / P2 손패 (테스트) */}
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
                    isMine={true}
                    onPlayAttack={(card) => handlePlayAttack(card, "P1")}
                />
                <PlayerHandView
                    label="P2 손패"
                    player={p2}
                    isCurrentTurn={game.currentTurn === "P2"}
                    isMine={true}
                    onPlayAttack={(card) => handlePlayAttack(card, "P2")}
                />
            </div>

            {/* 문제 모달 */}
            {activeQuestion && currentQuestion && (
                <QuestionModal
                    defenderName={defender?.name ?? ""}
                    subject={activeQuestion.subject}
                    remainingSeconds={remainingSeconds}
                    currentQuestion={currentQuestion}
                    defenderDefenseCount={defenderDefenseCount}
                    onAnswer={handleAnswer}
                    onUseDefense={handleUseDefense}
                />
            )}
        </div>
    );
}

// ======================
// 2) Realtime 1:1 모드
// ======================
type NetworkInnerProps = {
    roomId: string;
    myProfileId: string;
    myName: string;
};

function NetworkCardBattleInner({ roomId, myProfileId, myName }: NetworkInnerProps) {
    const [snapshot, setSnapshot] = useState<CardBattleSnapshot | null>(null);
    const [joinedPlayers, setJoinedPlayers] = useState<
        Record<string, { profileId: string; name: string }>
    >({});
    const [nowMs, setNowMs] = useState<number>(() => Date.now());

    const channelRef = useRef<any>(null);
    const iAmHostRef = useRef(false);

    const sortedIds = useMemo(
        () => Object.keys(joinedPlayers).sort(),
        [joinedPlayers],
    );
    const hostProfileId = sortedIds.length >= 2 ? sortedIds[0] : undefined;
    const iAmHost = !!hostProfileId && hostProfileId === myProfileId;

    useEffect(() => {
        iAmHostRef.current = iAmHost;
    }, [iAmHost]);

    // 타이머 (전체 클라이언트에서 UI용으로만 사용)
    useEffect(() => {
        const timer = setInterval(() => {
            setNowMs(Date.now());
        }, 200);
        return () => clearInterval(timer);
    }, []);

    // Realtime 채널 연결
    useEffect(() => {
        const ch = supabase.channel(`cardbattle:${roomId}`);
        channelRef.current = ch;

        ch.on(
            "broadcast",
            { event: "join" },
            ({ payload }: { payload: { profileId: string; name: string } }) => {
                const { profileId, name } = payload;
                setJoinedPlayers((prev) => {
                    if (prev[profileId]) return prev;
                    return { ...prev, [profileId]: { profileId, name } };
                });
            },
        );

        ch.on(
            "broadcast",
            { event: "state" },
            ({ payload }: { payload: CardBattleSnapshot }) => {
                setSnapshot(payload);
            },
        );

        ch.on(
            "broadcast",
            { event: "action" },
            ({ payload }: { payload: CardBattleAction }) => {
                if (!iAmHostRef.current) return;
                applyActionAsHost(payload);
            },
        );

        ch.subscribe();

        // 나 자신 join 브로드캐스트
        ch.send({
            type: "broadcast",
            event: "join",
            payload: { profileId: myProfileId, name: myName },
        });

        return () => {
            supabase.removeChannel(ch);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, myProfileId, myName]);

    // host 전용: 액션 처리 후 state 브로드캐스트
    function applyActionAsHost(action: CardBattleAction) {
        setSnapshot((prev) => {
            if (!prev) return prev;
            const next = reduceSnapshot(prev, action);
            if (channelRef.current) {
                channelRef.current.send({
                    type: "broadcast",
                    event: "state",
                    payload: next,
                });
            }
            return next;
        });
    }

    // host 전용: 두 명이 다 들어오면 초기 게임 생성
    useEffect(() => {
        if (!iAmHost) return;
        if (snapshot) return;
        if (sortedIds.length < 2) return;

        const [p1Id, p2Id] = sortedIds;
        const p1Name = joinedPlayers[p1Id]?.name ?? "Player 1";
        const p2Name = joinedPlayers[p2Id]?.name ?? "Player 2";

        const base = createInitialGameState(p1Name, p2Name);
        const snap: CardBattleSnapshot = {
            game: base,
            p1ProfileId: p1Id,
            p2ProfileId: p2Id,
        };
        setSnapshot(snap);
        if (channelRef.current) {
            channelRef.current.send({
                type: "broadcast",
                event: "state",
                payload: snap,
            });
        }
    }, [iAmHost, snapshot, sortedIds, joinedPlayers]);

    // host 전용: 시간 초과 체크 → TIMEOUT 액션 발행
    useEffect(() => {
        if (!iAmHost) return;
        if (!snapshot?.game.activeQuestion) return;
        if (snapshot.game.status !== "playing") return;

        const deadline = snapshot.game.activeQuestion.deadlineAt;
        if (nowMs >= deadline) {
            applyActionAsHost({ type: "TIMEOUT" });
        }
    }, [iAmHost, snapshot, nowMs]);

    const game = snapshot?.game;
    const myPlayerId: PlayerId | null = useMemo(() => {
        if (!snapshot) return null;
        if (snapshot.p1ProfileId === myProfileId) return "P1";
        if (snapshot.p2ProfileId === myProfileId) return "P2";
        return null;
    }, [snapshot, myProfileId]);

    const activeQuestion = game?.activeQuestion;
    const currentQuestion = useMemo(() => {
        if (!activeQuestion) return null;
        return PACK.questions.find((q) => q.id === activeQuestion.questionId) ?? null;
    }, [activeQuestion]);

    const remainingSeconds = useMemo(() => {
        if (!activeQuestion) return 0;
        const diff = Math.ceil((activeQuestion.deadlineAt - nowMs) / 1000);
        return diff > 0 ? diff : 0;
    }, [activeQuestion, nowMs]);

    function sendAction(action: CardBattleAction) {
        if (!channelRef.current) return;
        channelRef.current.send({
            type: "broadcast",
            event: "action",
            payload: action,
        });
    }

    function handlePlayAttack(card: AttackCard, owner: PlayerId) {
        if (!game || !myPlayerId) return;
        if (game.status !== "playing") return;
        if (game.activeQuestion) return;
        if (game.currentTurn !== owner) return;
        if (owner !== myPlayerId) return;
        sendAction({
            type: "PLAY_ATTACK",
            playerId: myPlayerId,
            cardId: card.id,
            subject: card.subject,
        });
    }

    function handleAnswer(optionIndex: number) {
        if (!activeQuestion || !currentQuestion) return;
        if (!myPlayerId) return;
        // 방어자만 답변 가능 (나중에 교사용 관전 모드 등은 따로 분기)
        if (activeQuestion.defenderId !== myPlayerId) return;
        const correct = optionIndex === currentQuestion.answerIndex;
        sendAction({ type: "ANSWER", correct });
    }

    function handleUseDefense() {
        if (!activeQuestion) return;
        if (!myPlayerId) return;
        if (activeQuestion.defenderId !== myPlayerId) return;
        sendAction({ type: "DEFENSE" });
    }

    if (!game || !myPlayerId) {
        return (
            <div
                style={{
                    padding: "1rem",
                    fontSize: "0.9rem",
                }}
            >
                <div>상대를 기다리는 중입니다… (이 페이지를 두 명이 동시에 열어야 합니다)</div>
                <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#6b7280" }}>
                    Room: <code>{roomId}</code>, 나: {myName}
                </div>
            </div>
        );
    }

    const p1 = game.players.P1;
    const p2 = game.players.P2;

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
                        {snapshot?.p1ProfileId === myProfileId ? " ← 나" : ""}
                    </div>
                    <div>공격 성공: {p1.hitsGiven} / 3</div>
                </div>
                <div>
                    <div>
                        <strong>{p2.name}</strong> (P2)
                        {snapshot?.p2ProfileId === myProfileId ? " ← 나" : ""}
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
                            <strong>현재 턴:</strong> {game.players[game.currentTurn].name}
                        </div>
                    )}
                    <div
                        style={{
                            marginTop: "0.25rem",
                            fontSize: "0.75rem",
                            color: "#6b7280",
                        }}
                    >
                        Host:{" "}
                        {hostProfileId
                            ? joinedPlayers[hostProfileId]?.name ?? hostProfileId
                            : "—"}
                        {iAmHost ? " (나)" : ""}
                    </div>
                </div>
            </div>

            {/* 중단: 간단 안내 */}
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
                            {game.players[game.activeQuestion.attackerId].name}
                        </strong>
                        이(가){" "}
                        <strong>{subjectLabel(game.activeQuestion.subject)}</strong>{" "}
                        공격 카드를 사용했습니다!
                    </div>
                ) : (
                    <div>
                        <strong>{game.players[game.currentTurn].name}</strong>
                        의 차례입니다. 공격 카드를 선택해 보세요.
                    </div>
                )}
            </div>

            {/* 하단: 두 플레이어 손패 (임시로 둘 다 보이게) */}
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
                    isMine={myPlayerId === "P1"}
                    onPlayAttack={(card) => handlePlayAttack(card, "P1")}
                />
                <PlayerHandView
                    label="P2 손패"
                    player={p2}
                    isCurrentTurn={game.currentTurn === "P2"}
                    isMine={myPlayerId === "P2"}
                    onPlayAttack={(card) => handlePlayAttack(card, "P2")}
                />
            </div>

            {/* 문제 모달 */}
            {activeQuestion && currentQuestion && (
                <QuestionModal
                    defenderName={defender?.name ?? ""}
                    subject={activeQuestion.subject}
                    remainingSeconds={remainingSeconds}
                    currentQuestion={currentQuestion}
                    defenderDefenseCount={defenderDefenseCount}
                    onAnswer={handleAnswer}
                    onUseDefense={handleUseDefense}
                />
            )}
        </div>
    );
}

// ======================
// 공통: 스냅샷 리듀서 (host만 사용)
// ======================
function reduceSnapshot(
    prev: CardBattleSnapshot,
    action: CardBattleAction,
): CardBattleSnapshot {
    const state = prev.game;

    switch (action.type) {
        case "PLAY_ATTACK": {
            if (state.status !== "playing") return prev;
            if (state.activeQuestion) return prev;
            if (state.currentTurn !== action.playerId) return prev;

            const qid = pickRandomQuestionId(action.subject);
            if (!qid) return prev;

            const updated = playAttackCard(
                state,
                action.playerId,
                action.cardId,
                action.subject,
                qid,
                Date.now(),
                7000,
            );

            return { ...prev, game: updated };
        }
        case "ANSWER": {
            const updated = resolveQuizResult(state, action.correct);
            return { ...prev, game: updated };
        }
        case "DEFENSE": {
            if (!state.activeQuestion) return prev;
            const defenderId = state.activeQuestion.defenderId;
            const updated = useDefenseCard(state, defenderId);
            return { ...prev, game: updated };
        }
        case "TIMEOUT": {
            const updated = handleTimeout(state);
            return { ...prev, game: updated };
        }
        default:
            return prev;
    }
}

// ======================
// 공통 UI 컴포넌트들
// ======================
type PlayerHandViewProps = {
    label: string;
    player: GameState["players"]["P1"];
    isCurrentTurn: boolean;
    isMine: boolean;
    onPlayAttack: (card: AttackCard) => void;
};

function PlayerHandView({
                            label,
                            player,
                            isCurrentTurn,
                            isMine,
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
                    {isMine ? " (나)" : ""}
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
                    const canUse = isAttack && isCurrentTurn && isMine;
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

type QuestionModalProps = {
    defenderName: string;
    subject: Subject;
    remainingSeconds: number;
    currentQuestion: CardBattleQuestion;
    defenderDefenseCount: number;
    onAnswer: (optionIndex: number) => void;
    onUseDefense: () => void;
};

function QuestionModal({
                           defenderName,
                           subject,
                           remainingSeconds,
                           currentQuestion,
                           defenderDefenseCount,
                           onAnswer,
                           onUseDefense,
                       }: QuestionModalProps) {
    return (
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
                        <strong>{defenderName}</strong> 님, 문제를 풀어주세요!
                    </div>
                    <div
                        style={{
                            fontSize: "0.8rem",
                            padding: "0.2rem 0.5rem",
                            borderRadius: 999,
                            background:
                                remainingSeconds <= 3 ? "#fee2e2" : "#eff6ff",
                            color:
                                remainingSeconds <= 3 ? "#b91c1c" : "#1d4ed8",
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
                    {currentQuestion.options.map((opt, idx) => (
                        <button
                            key={idx}
                            onClick={() => onAnswer(idx)}
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
                    ))}
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
                        과목: {subjectLabel(subject)}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                            disabled={defenderDefenseCount <= 0}
                            onClick={onUseDefense}
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
                            방어 카드 사용 ({defenderDefenseCount}장 남음)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
