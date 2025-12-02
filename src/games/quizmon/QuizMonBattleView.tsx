// src/games/quizmon/QuizMonBattleView.tsx
import { useState } from "react";
import type { ReactNode } from "react";
import type {
    BattleState,
    Move,
    QuizQuestionLite,
    Monster,
} from "./types";
import { HpBar } from "./HpBar";

type QuizBottomPanelProps = {
    phase: BattleState["phase"];
    currentQuestion: QuizQuestionLite | null;
    playerName: string;
    playerMoves: Move[];
    canSelectMove: boolean;
    hasQuestions: boolean;
    onSelectMove: (move: Move) => void;
    onAnswer: (index: number) => void;
    canSwitch: boolean;
    onOpenSwitchModal: () => void;
};

/** 하단 명령 / 퀴즈 패널 */
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
        canSwitch,
        onOpenSwitchModal,
    } = props;

    const isQuizPhase = phase === "quiz" && !!currentQuestion;
    const isFinished = phase === "finished";

    // 하단 메인 텍스트
    let mainText: string;
    if (isQuizPhase && currentQuestion) {
        mainText = currentQuestion.prompt;
    } else if (!hasQuestions) {
        mainText = "이 퀴즈팩에는 문제가 없습니다. (질문 0개)";
    } else if (isFinished) {
        mainText =
            "배틀이 종료되었습니다. 위의 결과를 확인한 뒤 리셋 버튼으로 다시 시작할 수 있어요.";
    } else {
        mainText = `${playerName}은(는) 무엇을 할까?`;
    }

    const showSkillGrid = !isQuizPhase && !isFinished;

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "2.2fr 1.5fr",
                gap: 8,
                fontSize: "clamp(12px, 2vmin, 14px)", // 반응형 폰트
            }}
        >
            {/* 왼쪽: 메세지 + (퀴즈 phase일 때) 보기 4개 */}
            <div
                style={{
                    borderRadius: 8,
                    border: "1px solid #020617",
                    background: "#020617",
                    padding: "0.4rem 0.5rem",
                    minHeight: "clamp(60px, 10vh, 100px)", // 높이도 약간 반응형
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                }}
            >
                <div
                    style={{
                        fontSize: "clamp(13px, 2.2vmin, 16px)", // 메인 텍스트 반응형
                        fontWeight: 600,
                        marginBottom: isQuizPhase ? 6 : 0,
                        lineHeight: 1.4,
                    }}
                >
                    {mainText}
                </div>

                {isQuizPhase && currentQuestion && (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(2, minmax(0, 1fr))",
                            gap: 4,
                            marginTop: 4,
                        }}
                    >
                        {currentQuestion.options.map(
                            (opt: string, idx: number) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => onAnswer(idx)}
                                    style={{
                                        borderRadius: 6,
                                        border: "1px solid #1f2937",
                                        padding: "0.3rem 0.4rem",
                                        textAlign: "left",
                                        background: "#020617",
                                        color: "#e5e7eb",
                                        fontSize: "clamp(11px, 2vmin, 14px)", // 보기 텍스트 반응형
                                        cursor: "pointer",
                                    }}
                                >
                                    {opt}
                                </button>
                            ),
                        )}
                    </div>
                )}
            </div>

            {/* 오른쪽: 기술 선택 */}
            <div
                style={{
                    borderRadius: 8,
                    border: "1px solid #020617",
                    background: "#020617",
                    padding: "0.4rem 0.5rem",
                    minHeight: "clamp(60px, 10vh, 100px)",
                }}
            >
                {showSkillGrid && (
                    <>
                        <div
                            style={{
                                fontSize: "clamp(10px, 1.8vmin, 12px)",
                                color: "#9ca3af",
                                marginBottom: 4,
                            }}
                        >
                            사용할 기술을 선택하세요.
                        </div>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "repeat(2, minmax(0, 1fr))",
                                gap: 4,
                            }}
                        >
                            {playerMoves.map((move) => (
                                <button
                                    key={move.id}
                                    type="button"
                                    onClick={() => onSelectMove(move)}
                                    disabled={!canSelectMove}
                                    style={{
                                        borderRadius: 6,
                                        border: "1px solid #1f2937",
                                        padding: "0.3rem 0.4rem",
                                        textAlign: "left",
                                        background: canSelectMove
                                            ? "#020617"
                                            : "#02061780",
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
                                            fontSize: "clamp(11px, 2vmin, 14px)",
                                        }}
                                    >
                                        {move.name}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "clamp(10px, 1.6vmin, 12px)",
                                            color: "#9ca3af",
                                        }}
                                    >
                                        위력 {move.power} · 명중 {`${move.baseAcc ?? "-"}%`}
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div
                            style={{
                                marginTop: 6,
                                display: "flex",
                                justifyContent: "flex-end",
                            }}
                        >
                            <button
                                type="button"
                                onClick={onOpenSwitchModal}
                                disabled={!canSwitch}
                                style={{
                                    borderRadius: 6,
                                    border: "1px solid #1f2937",
                                    padding: "0.25rem 0.6rem",
                                    fontSize: "clamp(10px, 1.8vmin, 12px)",
                                    background: canSwitch
                                        ? "#020617"
                                        : "#02061780",
                                    color: "#e5e7eb",
                                    cursor: canSwitch
                                        ? "pointer"
                                        : "default",
                                }}
                            >
                                교체
                            </button>
                        </div>
                    </>
                )}

                {isFinished && (
                    <div
                        style={{
                            fontSize: "clamp(12px, 2vmin, 14px)",
                            color: "#e5e7eb",
                        }}
                    >
                        배틀이 끝났습니다. 결산 결과를 확인해 주세요.
                    </div>
                )}
            </div>
        </div>
    );
}

export type QuizMonBattleViewProps = {
    state: BattleState;
    questions: QuizQuestionLite[];
    playerMon: Monster;
    enemyMon: Monster;
    canSelectMove: boolean;
    onSelectMove: (move: Move) => void;
    onAnswer: (index: number) => void;
    onRequestSwitch: (targetIndex: number) => void;
    playerSprite: ReactNode;
    enemySprite: ReactNode;
};

/** 전투 필드(몬스터 + HP + 하단 패널) */
export function QuizMonBattleView(props: QuizMonBattleViewProps) {
    const {
        state,
        questions,
        playerMon,
        enemyMon,
        canSelectMove,
        onSelectMove,
        onAnswer,
        onRequestSwitch,
        playerSprite,
        enemySprite,
    } = props;

    const [showSwitchModal, setShowSwitchModal] = useState(false);

    const canSwitch =
        state.phase === "command" &&
        state.player.monsters.some(
            (m, idx) => idx !== state.player.activeIndex && m.hp > 0,
        );

    const hasQuestions = questions.length > 0;
    const currentQuestion =
        state.phase === "quiz"
            ? state.currentQuestion ?? null
            : null;

    return (
        <>
            {/* 1. 적 HP UI (좌측 상단으로 이동 - 크로스 배치) */}
            <div
                style={{
                    position: "absolute",
                    top: "5%",
                    left: "5%",
                    zIndex: 10, // 스프라이트보다 위에 보이도록 안전장치
                }}
            >
                <div
                    style={{
                        minWidth: "clamp(160px, 25vw, 240px)",
                        padding: "0.5rem 0.75rem",
                        borderRadius: 8,
                        background: "rgba(15,23,42,0.85)", // 약간 투명하게
                        border: "1px solid #334155",
                        textAlign: "left",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
                    }}
                >
                    <div
                        style={{
                            fontWeight: 700,
                            marginBottom: 4,
                            fontSize: "clamp(12px, 2.5vmin, 16px)", // 이름 반응형
                            display: "flex",
                            justifyContent: "space-between",
                        }}
                    >
                        <span>{enemyMon.name}</span>
                        <span style={{ fontSize: "0.9em", color: "#fbbf24" }}>Lv.{enemyMon.level}</span>
                    </div>

                    <HpBar
                        current={enemyMon.hp}
                        max={enemyMon.maxHp}
                    />
                    <div
                        style={{
                            fontSize: "clamp(10px, 1.8vmin, 12px)", // HP 숫자 반응형
                            marginTop: 2,
                            textAlign: "right",
                            color: "#cbd5e1"
                        }}
                    >
                        {enemyMon.hp}/{enemyMon.maxHp}
                    </div>
                </div>
            </div>

            {/* 2. 적 스프라이트 (우측 상단 유지) */}
            <div
                style={{
                    position: "absolute",
                    top: "12%",
                    right: "10%",
                    width: 96,
                    height: 96,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "flex-end",
                    zIndex: 5,
                }}
            >
                {enemySprite}
            </div>

            {/* 3. 플레이어 스프라이트 (좌측 하단 유지 - UI와 분리됨) */}
            <div
                style={{
                    position: "absolute",
                    left: "8%",
                    bottom: "28%", // 하단 패널 위로 충분히 띄움
                    width: 96,
                    height: 96,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "flex-start",
                    zIndex: 5,
                }}
            >
                {playerSprite}
            </div>

            {/* 4. 플레이어 HP UI (우측 하단으로 이동 - 크로스 배치) */}
            <div
                style={{
                    position: "absolute",
                    bottom: "30%", // 스프라이트와 비슷한 높이, 하지만 반대편
                    right: "5%",
                    zIndex: 10,
                }}
            >
                <div
                    style={{
                        minWidth: "clamp(180px, 28vw, 260px)",
                        padding: "0.5rem 0.75rem",
                        borderRadius: 8,
                        background: "rgba(15,23,42,0.85)",
                        border: "1px solid #334155",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
                    }}
                >
                    <div
                        style={{
                            fontWeight: 700,
                            marginBottom: 4,
                            fontSize: "clamp(13px, 2.5vmin, 18px)", // 플레이어 이름 조금 더 크게
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                        }}
                    >
                        <span>{playerMon.name}</span>
                        <span style={{ fontSize: "0.85em", color: "#fbbf24" }}>Lv.{playerMon.level}</span>
                    </div>

                    <HpBar
                        current={playerMon.hp}
                        max={playerMon.maxHp}
                    />
                    <div
                        style={{
                            fontSize: "clamp(11px, 2vmin, 13px)",
                            marginTop: 2,
                            textAlign: "right",
                            fontWeight: 600,
                            color: "#e2e8f0"
                        }}
                    >
                        {playerMon.hp} / {playerMon.maxHp}
                    </div>
                </div>
            </div>

            {/* 하단 명령 / 퀴즈 패널 */}
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    // 패널 높이 확보
                    padding: "0.8rem 1rem",
                    background:
                        "linear-gradient(180deg, rgba(15,23,42,0.95) 0%, #020617 100%)",
                    borderTop: "1px solid #1e293b",
                    zIndex: 20, // UI 최상단
                }}
            >
                {showSwitchModal && (
                    <div
                        style={{
                            position: "fixed",
                            inset: 0,
                            background: "rgba(15,23,42,0.8)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 50,
                        }}
                    >
                        <div
                            style={{
                                width: "min(360px, 90vw)",
                                borderRadius: 12,
                                border: "1px solid #1f2937",
                                background: "#020617",
                                padding: "1rem",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "1.1rem",
                                    fontWeight: 600,
                                    color: "#e5e7eb",
                                    marginBottom: 4,
                                }}
                            >
                                교체할 포켓몬 선택
                            </div>
                            <div
                                style={{
                                    fontSize: "0.85rem",
                                    color: "#9ca3af",
                                    marginBottom: 12,
                                }}
                            >
                                현재 HP가 남아있는 포켓몬만 선택할 수 있습니다.
                            </div>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                        "repeat(3, minmax(0, 1fr))",
                                    gap: 8,
                                }}
                            >
                                {state.player.monsters.map((mon, idx) => {
                                    const isActive =
                                        idx === state.player.activeIndex;
                                    const isDead = mon.hp <= 0;
                                    const disabled = isActive || isDead;

                                    return (
                                        <button
                                            key={mon.id ?? idx}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => {
                                                if (disabled) return;
                                                onRequestSwitch(idx);
                                                setShowSwitchModal(false);
                                            }}
                                            style={{
                                                borderRadius: 8,
                                                border: "1px solid #1f2937",
                                                padding: "0.5rem",
                                                textAlign: "left",
                                                background: disabled
                                                    ? "#02061760"
                                                    : "#020617",
                                                color: disabled
                                                    ? "#6b7280"
                                                    : "#e5e7eb",
                                                cursor: disabled
                                                    ? "default"
                                                    : "pointer",
                                                fontSize: "0.8rem",
                                                position: "relative",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontWeight: 600,
                                                    marginBottom: 2,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap"
                                                }}
                                            >
                                                {mon.name}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "0.75rem",
                                                    color: "#9ca3af",
                                                }}
                                            >Lv.{mon.level}</div>
                                            <div
                                                style={{
                                                    fontSize: "0.75rem",
                                                    color: isDead ? "#ef4444" : "#9ca3af",
                                                }}
                                            >
                                                {mon.hp}/{mon.maxHp}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div
                                style={{
                                    marginTop: 16,
                                    display: "flex",
                                    justifyContent: "flex-end",
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setShowSwitchModal(false)}
                                    style={{
                                        borderRadius: 6,
                                        border: "1px solid #374151",
                                        padding: "0.4rem 1rem",
                                        fontSize: "0.9rem",
                                        background: "#020617",
                                        color: "#e5e7eb",
                                        cursor: "pointer"
                                    }}
                                >
                                    취소
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <QuizBottomPanel
                    phase={state.phase}
                    currentQuestion={currentQuestion}
                    playerName={playerMon.name}
                    playerMoves={playerMon.moves}
                    canSelectMove={canSelectMove}
                    hasQuestions={hasQuestions}
                    onSelectMove={onSelectMove}
                    onAnswer={onAnswer}
                    canSwitch={canSwitch}
                    onOpenSwitchModal={() => setShowSwitchModal(true)}
                />
            </div>
        </>
    );
}