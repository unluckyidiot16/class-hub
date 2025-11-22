// src/games/quizmon/QuizMonGame.tsx
import { useEffect, useMemo, useState } from "react";
import type {
    BattleState,
    Move,
    QuizAnswerResult,
    QuizQuestionLite,
    Monster,
    QuizmonOwnedMonsterRow,
    QuizmonSpeciesRow,
} from "./types";
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
import { createInitialBattleState } from "./mockData";
import { supabase } from "../../lib/supabaseClient";
import { buildBattleMonsterFromSpecies } from "./battleFactory";
import type { QuizPackJsonV1 } from "../../types/quizPackJson"; // ← 기존 import 유지
import { getArenaSprite, getMonsterAnimJson, getMonsterSprite } from "./assets";
import { SpriteAnimation } from "./SpriteAnimation";

// =========================
// 🌆 배틀 BG / 하단 패널용 헬퍼
// =========================
const BATTLE_BG_URL = getArenaSprite("forest_bg");
const PLAYER_SPECIES_ID = "0001";

function HpBar({ current, max }: { current: number; max: number }) {
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;

    let color = "#22c55e"; // green
    if (ratio < 0.25) color = "#ef4444"; // red
    else if (ratio < 0.5) color = "#facc15"; // yellow

    return (
        <div
            style={{
                background: "#111827",
                borderRadius: 999,
                overflow: "hidden",
                height: 6,
            }}
        >
            <div
                style={{
                    width: `${ratio * 100}%`,
                    height: "100%",
                    background: color,
                    transition: "width 0.2s ease",
                }}
            />
        </div>
    );
}

type QuizBottomPanelProps = {
    phase: BattleState["phase"];
    currentQuestion: QuizQuestionLite | null;
    playerName: string;
    playerMoves: Move[];
    canSelectMove: boolean;
    hasQuestions: boolean;
    onSelectMove: (move: Move) => void;
    onAnswer: (index: number) => void;
    logs: BattleState["logs"];
};

function QuizBottomPanel(props: QuizBottomPanelProps) {
    const {
        phase,
        currentQuestion,
        playerName,
        playerMoves,
        canSelectMove,
        hasQuestions,
        onSelectMove,
        onAnswer,
        logs,
    } = props;

    const isQuizPhase = phase === "quiz" && !!currentQuestion;

    let mainText: string;
    if (isQuizPhase && currentQuestion) {
        mainText = currentQuestion.prompt;
    } else if (!hasQuestions) {
        mainText = "이 퀴즈팩에는 문제가 없습니다. (질문 0개)";
    } else if (phase === "finished") {
        mainText =
            "배틀이 종료되었습니다. 위의 결과를 확인한 뒤 결산창에서 다음 행동을 선택해 보세요.";
    } else {
        mainText = `${playerName}은(는) 무엇을 할까?`;
    }

    const recentLogs = logs.slice(-6);

    return (
        <div
            style={{
                borderRadius: 8,
                border: "1px solid #111827",
                background:
                    "linear-gradient(180deg, rgba(15,23,42,1) 0%, #020617 100%)",
                padding: "0.6rem 0.75rem",
                color: "#e5e7eb",
                fontSize: 13,
            }}
        >
            {/* 상단 텍스트 영역 (질문/명령) */}
            <div
                style={{
                    minHeight: 44,
                    padding: "0.25rem 0.25rem 0.5rem",
                    borderBottom: "1px solid #1f2937",
                    marginBottom: "0.5rem",
                    whiteSpace: "pre-wrap",
                }}
            >
                {mainText}
            </div>

            {/* 하단: 왼쪽(기술/보기) + 오른쪽(로그) */}
            <div
                style={{
                    display: "flex",
                    gap: "0.75rem",
                }}
            >
                <div style={{ flex: 2 }}>
                    {isQuizPhase && currentQuestion ? (
                        // 🔹 보기 선택 영역
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "0.5rem",
                            }}
                        >
                            {currentQuestion.options.map((opt, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => onAnswer(idx)}
                                    style={{
                                        textAlign: "left",
                                        padding: "0.5rem 0.75rem",
                                        borderRadius: 8,
                                        border: "1px solid #4b5563",
                                        background: "#020617",
                                        color: "#e5e7eb",
                                        fontSize: 13,
                                        cursor: "pointer",
                                    }}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    ) : (
                        // 🔹 기술 선택 영역
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "0.5rem",
                            }}
                        >
                            {playerMoves.map((move) => (
                                <button
                                    key={move.id}
                                    type="button"
                                    disabled={!canSelectMove}
                                    onClick={() => onSelectMove(move)}
                                    style={{
                                        textAlign: "left",
                                        padding: "0.5rem 0.75rem",
                                        borderRadius: 8,
                                        border: "1px solid #4b5563",
                                        background: canSelectMove
                                            ? "#020617"
                                            : "#020617aa",
                                        color: "#e5e7eb",
                                        cursor: canSelectMove
                                            ? "pointer"
                                            : "default",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontWeight: 600,
                                            marginBottom: 2,
                                        }}
                                    >
                                        {move.name}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            opacity: 0.8,
                                        }}
                                    >
                                        위력 {move.power} / 명중 {move.baseAcc}%
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 전투 로그 박스 */}
                <div
                    style={{
                        flex: 1,
                        minWidth: 180,
                        maxHeight: 128,
                        borderRadius: 8,
                        border: "1px solid #1f2937",
                        background: "#020617",
                        padding: "0.5rem",
                        overflowY: "auto",
                        fontSize: 12,
                    }}
                >
                    <div
                        style={{
                            fontWeight: 600,
                            marginBottom: 4,
                            color: "#9ca3af",
                        }}
                    >
                        전투 로그
                    </div>
                    {recentLogs.length === 0 ? (
                        <div style={{ opacity: 0.6 }}>
                            로그가 여기에 표시됩니다.
                        </div>
                    ) : (
                        recentLogs.map((log) => (
                            <div key={log.id} style={{ marginBottom: 2 }}>
                                {log.text}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// =========================
// 🧾 결산 오버레이
// =========================

type ResultOverlayProps = {
    stats: { correct: number; total: number };
    playerMon: Monster;
    enemyMon: Monster;
    onRetry: () => void;
    onClose: () => void;
};

function ResultOverlay(props: ResultOverlayProps) {
    const { stats, playerMon, enemyMon, onRetry, onClose } = props;

    const playerHp = playerMon.hp;
    const enemyHp = enemyMon.hp;

    let headline = "무승부!";
    if (playerHp <= 0 && enemyHp > 0) {
        headline = "아쉽다… 패배했다!";
    } else if (enemyHp <= 0 && playerHp > 0) {
        headline = `신난다! ${enemyMon.name}을(를) 잡았다!`;
    }

    const { correct, total } = stats;
    const acc = total > 0 ? Math.round((correct / total) * 100) : 0;

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.75)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 20,
            }}
        >
            <div
                style={{
                    width: "90%",
                    maxWidth: 640,
                    borderRadius: 12,
                    border: "2px solid #b91c1c",
                    background:
                        "linear-gradient(180deg,#111827 0%,#020617 100%)",
                    boxShadow: "0 18px 40px rgba(0,0,0,0.7)",
                    padding: "0.75rem 0.9rem 0.85rem",
                    color: "#e5e7eb",
                    fontSize: 14,
                }}
            >
                {/* 상단: 제목 영역 (포켓로그 하단 박스 느낌) */}
                <div
                    style={{
                        marginBottom: "0.5rem",
                        paddingBottom: "0.35rem",
                        borderBottom: "1px solid #4b5563",
                    }}
                >
                    <div
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            marginBottom: 4,
                        }}
                    >
                        {headline}
                    </div>
                    <div
                        style={{
                            fontSize: 12,
                            color: "#9ca3af",
                        }}
                    >
                        이번 레이드의 풀이 결과를 확인해 보세요.
                    </div>
                </div>

                {/* 중간: 정답/정확도 + 양측 포켓몬 HP 요약 */}
                <div
                    style={{
                        display: "flex",
                        gap: "1rem",
                        alignItems: "stretch",
                        marginBottom: "0.75rem",
                        flexWrap: "wrap",
                    }}
                >
                    {/* 정답 통계 */}
                    <div
                        style={{
                            flex: 1,
                            minWidth: 140,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 13,
                                color: "#9ca3af",
                                marginBottom: 4,
                            }}
                        >
                            레이드 결과
                        </div>
                        <div
                            style={{
                                fontSize: 24,
                                fontWeight: 700,
                                marginBottom: 2,
                            }}
                        >
                            {correct} / {total}
                        </div>
                        <div
                            style={{
                                fontSize: 13,
                                color: "#e5e7eb",
                            }}
                        >
                            정답률 {acc}%
                        </div>
                    </div>

                    {/* 플레이어 / 적 간단 스테이터스 */}
                    <div
                        style={{
                            flex: 1.2,
                            minWidth: 180,
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            fontSize: 12,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <span style={{ color: "#9ca3af" }}>내 파트너</span>
                            <span style={{ fontWeight: 600 }}>
                                {playerMon.name}
                            </span>
                        </div>
                        <HpBar current={playerHp} max={playerMon.maxHp} />
                        <span
                            style={{
                                fontSize: 11,
                                color: "#9ca3af",
                            }}
                        >
                            HP {playerHp}/{playerMon.maxHp}
                        </span>

                        <div
                            style={{
                                marginTop: 8,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <span style={{ color: "#9ca3af" }}>상대</span>
                            <span style={{ fontWeight: 600 }}>
                                {enemyMon.name}
                            </span>
                        </div>
                        <HpBar current={enemyHp} max={enemyMon.maxHp} />
                        <span
                            style={{
                                fontSize: 11,
                                color: "#9ca3af",
                            }}
                        >
                            HP {enemyHp}/{enemyMon.maxHp}
                        </span>
                    </div>
                </div>

                {/* 하단: 버튼 줄 */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "0.5rem",
                    }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: "0.35rem 0.8rem",
                            borderRadius: 999,
                            border: "1px solid #4b5563",
                            background: "#020617",
                            color: "#e5e7eb",
                            fontSize: 13,
                            cursor: "pointer",
                        }}
                    >
                        닫기
                    </button>
                    <button
                        type="button"
                        onClick={onRetry}
                        style={{
                            padding: "0.35rem 0.9rem",
                            borderRadius: 999,
                            border: "1px solid #b91c1c",
                            background:
                                "linear-gradient(90deg,#dc2626,#f97316)",
                            color: "#f9fafb",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        다시 도전
                    </button>
                </div>
            </div>
        </div>
    );
}

// =========================
// 🎮 Game 컴포넌트
// =========================

type QuizMonGameProps = {
    quizpack: QuizPackJsonV1;
    roomId?: string | null;
    gameSessionId?: string | null;
    studentId?: string | null;

    /** quizmon_profile.id - 있으면 이 프로필의 파티(1~3번)로 전투 시작 */
    profileId?: string | null;

    onQuizAnswer?: (result: QuizAnswerResult) => void;
    onBattleEnd?: (summary: {
        correct: number;
        total: number;
    }) => void;
};

export function QuizMonGame(props: QuizMonGameProps) {
    const {
        quizpack,
        roomId,
        gameSessionId,
        studentId,
        profileId,
        onQuizAnswer,
        onBattleEnd,
    } = props;

    // 1) 전투 상태
    const [state, setState] = useState<BattleState>(() =>
        createInitialBattleState(),
    );
    const [questionIndex, setQuestionIndex] = useState(0);

    // 이번 배틀에서 학생이 푼 퀴즈 집계
    const [battleStats, setBattleStats] = useState({ correct: 0, total: 0 });
    const [hasReportedEnd, setHasReportedEnd] = useState(false);

    // 결산 오버레이 표시 여부
    const [showResult, setShowResult] = useState(false);

    // Bulbasaur(0001) 임시 전투 스프라이트 – 이후 파티 기반으로 교체 가능
    const bulbasaurFrontJson = getMonsterAnimJson(PLAYER_SPECIES_ID, "front");
    const bulbasaurFrontPng = getMonsterSprite(PLAYER_SPECIES_ID, "front");
    const bulbasaurBackPng = getMonsterSprite(PLAYER_SPECIES_ID, "back");

    const renderPlayerSprite = () =>
        bulbasaurFrontJson && bulbasaurFrontPng ? (
            <SpriteAnimation
                jsonUrl={bulbasaurFrontJson}
                imageUrlOverride={bulbasaurFrontPng}
                fps={12}
                frameFilter={(frame) => {
                    const n = parseInt(
                        frame.filename.replace(".png", ""),
                        10,
                    );
                    return !Number.isNaN(n) && n >= 1 && n <= 20;
                }}
                style={{
                    transform: "scale(2)",
                    transformOrigin: "bottom left",
                }}
            />
        ) : null;

    const renderEnemySprite = () =>
        bulbasaurBackPng ? (
            <img
                src={bulbasaurBackPng}
                alt={enemyMon.name}
                style={{
                    width: "100%",
                    height: "100%",
                    imageRendering: "pixelated",
                    transform: "scale(1.6)",
                    transformOrigin: "bottom right",
                }}
            />
        ) : null;

    /**
     * profileId 기준으로 quizmon_owned_monsters(파티 1~3번)를 불러와
     * 실제 전투용 Monster 배열을 만들고, 그걸로 배틀 상태를 리셋한다.
     */
    const resetBattleWithProfileParty = async (profileId: string) => {
        try {
            // 1) 파티 슬롯 1~3인 owned 몬스터 로딩
            const { data: ownedData, error: ownedError } = await supabase
                .from("quizmon_owned_monsters")
                .select(
                    "id, profile_id, species_id, level, exp, party_slot, created_at, updated_at",
                )
                .eq("profile_id", profileId)
                .in("party_slot", [1, 2, 3])
                .order("party_slot", { ascending: true });

            if (ownedError) {
                console.error(
                    "[QuizMonGame] load owned_monsters error",
                    ownedError,
                );
                // 에러 시에는 mock 상태 유지
                setState(createInitialBattleState());
                setBattleStats({ correct: 0, total: 0 });
                setHasReportedEnd(false);
                setShowResult(false);
                setQuestionIndex(0);
                return;
            }

            const ownedRows = (ownedData ?? []) as QuizmonOwnedMonsterRow[];

            if (!ownedRows.length) {
                console.warn(
                    "[QuizMonGame] no party monsters (slot 1~3) for profile",
                    profileId,
                );
                // 파티가 없으면 mock 상태로
                setState(createInitialBattleState());
                setBattleStats({ correct: 0, total: 0 });
                setHasReportedEnd(false);
                setShowResult(false);
                setQuestionIndex(0);
                return;
            }

            // 2) 필요한 종 정보 모아서 quizmon_species 조회
            const speciesIds = Array.from(
                new Set(
                    ownedRows
                        .map((o) => o.species_id)
                        .filter((id): id is string => !!id),
                ),
            );

            if (!speciesIds.length) {
                console.warn(
                    "[QuizMonGame] owned_monsters has no species_id",
                    ownedRows,
                );
                setState(createInitialBattleState());
                setBattleStats({ correct: 0, total: 0 });
                setHasReportedEnd(false);
                setShowResult(false);
                setQuestionIndex(0);
                return;
            }

            const { data: speciesData, error: speciesError } = await supabase
                .from("quizmon_species")
                .select(
                    "id, name, element, rarity, base_hp, base_atk, base_def, base_spd, pokedex_no, sprite_key, description",
                )
                .in("id", speciesIds);

            if (speciesError) {
                console.error(
                    "[QuizMonGame] load species error",
                    speciesError,
                );
                setState(createInitialBattleState());
                setBattleStats({ correct: 0, total: 0 });
                setHasReportedEnd(false);
                setShowResult(false);
                setQuestionIndex(0);
                return;
            }

            const speciesRows = (speciesData ?? []) as QuizmonSpeciesRow[];
            const speciesMap = new Map(
                speciesRows.map((s) => [s.id, s] as const),
            );

            // 3) battleFactory로 Monster 빌드
            const partyMonsters: Monster[] = ownedRows
                .map((owned) => {
                    const species = speciesMap.get(owned.species_id);
                    if (!species) return null;
                    return buildBattleMonsterFromSpecies(species, owned);
                })
                .filter((m): m is Monster => m !== null);

            if (!partyMonsters.length) {
                console.warn(
                    "[QuizMonGame] partyMonsters empty after build",
                    ownedRows,
                    speciesRows,
                );
                setState(createInitialBattleState());
                setBattleStats({ correct: 0, total: 0 });
                setHasReportedEnd(false);
                setShowResult(false);
                setQuestionIndex(0);
                return;
            }

            // 4) 기존 mock 기반 상태를 가져와서 player 쪽만 교체
            const base = createInitialBattleState();

            const newState: BattleState = {
                ...base,
                player: {
                    ...base.player,
                    monsters: partyMonsters,
                    activeIndex: 0,
                },
                phase: "command",
                turn: 1,
                pendingPlayerMove: null,
                pendingEnemyMove: null,
                currentQuestion: null,
                questionStartedAt: null,
                lastQuizResult: null,
                logs: [],
            };

            setState(newState);
            setBattleStats({ correct: 0, total: 0 });
            setHasReportedEnd(false);
            setShowResult(false);
            setQuestionIndex(0);
        } catch (err) {
            console.error(
                "[QuizMonGame] resetBattleWithProfileParty unexpected error",
                err,
            );
            setState(createInitialBattleState());
            setBattleStats({ correct: 0, total: 0 });
            setHasReportedEnd(false);
            setShowResult(false);
            setQuestionIndex(0);
        }
    };

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

    // profileId가 있으면, 학생이 설정한 파티(1~3번 슬롯)로 전투 상태를 초기화
    useEffect(() => {
        if (!profileId) return;
        void resetBattleWithProfileParty(profileId);
    }, [profileId]);

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

    // 배틀이 끝난 시점에 한 번만 onBattleEnd 호출 + 결산 오버레이 표시
    useEffect(() => {
        if (state.phase !== "finished") return;
        if (battleStats.total > 0) {
            setShowResult(true);
        }

        if (!onBattleEnd) return;
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
                console.warn("[QuizMonGame] failed to log game event", err);
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

            let logText = `[플레이어] ${
                prev.pendingPlayerMove.move.name
            } (명중률 ${hitChance.toFixed(1)}%) → `;

            if (rollHit(hitChance)) {
                const dmg = calcDamage(
                    prevPlayerMon,
                    prevEnemyMon,
                    prev.pendingPlayerMove.move,
                );
                const newEnemyMon = applyDamageToMonster(prevEnemyMon, dmg);
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
                    prevPlayerMon, // defender
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
        if (profileId) {
            // 학생 프로필이 있으면 항상 "실제 파티" 기준으로 리셋
            void resetBattleWithProfileParty(profileId);
        } else {
            // fallback: mock 상태로 리셋
            setState(createInitialBattleState());
            setBattleStats({ correct: 0, total: 0 });
            setHasReportedEnd(false);
            setShowResult(false);
            setQuestionIndex(0);
        }
    };

    const canSelectMove =
        state.phase === "command" &&
        questions.length > 0 &&
        playerMon.hp > 0 &&
        enemyMon.hp > 0;

    return (
        <div
            style={{
                padding: "1.5rem",
                maxWidth: 960,
                margin: "0 auto",
                color: "#e5e7eb",
            }}
        >
            <h1 style={{ marginBottom: "0.25rem" }}>
                QuizMon Class – Battle Core
            </h1>
            <p
                style={{
                    fontSize: 13,
                    color: "#9ca3af",
                    marginTop: 0,
                }}
            >
                quizpackJson 기반 전투 코어 + 포켓로그풍 배틀 UI 테스트 버전입니다.
            </p>

            <div
                style={{
                    marginTop: "1rem",
                    borderRadius: 12,
                    border: "1px solid #0f172a",
                    background: "#020617",
                    padding: "0.75rem",
                }}
            >
                {/* 🔹 배틀 필드 전체 (BG + 포켓몬 + HUD + 명령창) */}
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        borderRadius: 8,
                        overflow: "hidden",
                        backgroundColor: "#000",
                    }}
                >
                    {/* BG */}
                    <div
                        style={{
                            width: "100%",
                            paddingTop: "62.5%", // 16:10 비율 정도로 약간 더 세로
                            backgroundImage: `url(${BATTLE_BG_URL})`,
                            backgroundRepeat: "no-repeat",
                            backgroundSize: "cover",
                            backgroundPosition: "center bottom",
                            imageRendering: "pixelated",
                        }}
                    />

                    {/* 적 측: 상단 우측 HP + 포켓몬 */}
                    <div
                        style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 8,
                        }}
                    >
                        <div
                            style={{
                                minWidth: 160,
                                padding: "0.35rem 0.5rem",
                                borderRadius: 8,
                                background: "rgba(15,23,42,0.92)",
                                border: "1px solid #020617",
                                textAlign: "right",
                                fontSize: 12,
                            }}
                        >
                            <div
                                style={{
                                    fontWeight: 700,
                                    marginBottom: 2,
                                }}
                            >
                                {enemyMon.name}
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    marginBottom: 2,
                                }}
                            >
                                HP {enemyMon.hp}/{enemyMon.maxHp}
                            </div>
                            <HpBar
                                current={enemyMon.hp}
                                max={enemyMon.maxHp}
                            />
                        </div>

                        <div
                            style={{
                                width: 96,
                                height: 96,
                                display: "flex",
                                alignItems: "flex-end",
                                justifyContent: "flex-end",
                            }}
                        >
                            {renderEnemySprite()}
                        </div>
                    </div>

                    {/* 플레이어 측: 하단 좌측 포켓몬 + HP */}
                    <div
                        style={{
                            position: "absolute",
                            left: 16,
                            bottom: 112, // 하단 명령창 위로 살짝 띄우기
                            display: "flex",
                            alignItems: "flex-end",
                            gap: 12,
                        }}
                    >
                        <div
                            style={{
                                width: 96,
                                height: 96,
                                display: "flex",
                                alignItems: "flex-end",
                                justifyContent: "flex-start",
                            }}
                        >
                            {renderPlayerSprite()}
                        </div>

                        <div
                            style={{
                                minWidth: 180,
                                padding: "0.35rem 0.5rem",
                                borderRadius: 8,
                                background: "rgba(15,23,42,0.92)",
                                border: "1px solid #020617",
                                fontSize: 12,
                            }}
                        >
                            <div
                                style={{
                                    fontWeight: 700,
                                    marginBottom: 2,
                                }}
                            >
                                {playerMon.name}
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    marginBottom: 2,
                                }}
                            >
                                HP {playerMon.hp}/{playerMon.maxHp}
                            </div>
                            <HpBar
                                current={playerMon.hp}
                                max={playerMon.maxHp}
                            />
                        </div>
                    </div>

                    {/* 🔹 하단 명령 / 퀴즈 / 로그 패널 – 포켓몬처럼 필드 위에 오버레이 */}
                    <div
                        style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            bottom: 0,
                            padding: "0.75rem",
                            background:
                                "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(15,23,42,1) 60%, #020617 100%)",
                            borderTop: "1px solid #020617",
                        }}
                    >
                        <QuizBottomPanel
                            phase={state.phase}
                            currentQuestion={
                                state.phase === "quiz"
                                    ? state.currentQuestion ?? null
                                    : null
                            }
                            playerName={playerMon.name}
                            playerMoves={playerMon.moves}
                            canSelectMove={canSelectMove}
                            hasQuestions={questions.length > 0}
                            onSelectMove={handleSelectMove}
                            onAnswer={handleAnswer}
                            logs={state.logs}
                        />
                    </div>

                    {/* 🎉 배틀 종료 후 결산 오버레이 */}
                    {showResult && (
                        <ResultOverlay
                            stats={battleStats}
                            playerMon={playerMon}
                            enemyMon={enemyMon}
                            onRetry={() => {
                                setShowResult(false);
                                handleReset();
                            }}
                            onClose={() => setShowResult(false)}
                        />
                    )}
                </div>
            </div>

            {/* 컨트롤/상태 줄 */}
            <section
                style={{
                    marginTop: "0.75rem",
                    fontSize: 12,
                }}
            >
                <button
                    type="button"
                    onClick={() => {
                        setShowResult(false);
                        handleReset();
                    }}
                    style={{
                        padding: "0.35rem 0.9rem",
                        borderRadius: 999,
                        border: "1px solid #4b5563",
                        background: "#020617",
                        color: "#e5e7eb",
                        cursor: "pointer",
                    }}
                >
                    배틀 리셋
                </button>
                <span
                    style={{
                        marginLeft: "0.75rem",
                        color: "#9ca3af",
                    }}
                >
                    턴: {state.turn} · 단계: {state.phase}
                </span>
            </section>
        </div>
    );
}
