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
                fontSize: 12,
            }}
        >
            {/* 왼쪽: 메세지 + (퀴즈 phase일 때) 보기 4개 */}
            <div
                style={{
                    borderRadius: 8,
                    border: "1px solid #020617",
                    background: "#020617",
                    padding: "0.4rem 0.5rem",
                    minHeight: 60,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                }}
            >
                <div
                    style={{
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: isQuizPhase ? 6 : 0,
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
                                        fontSize: 12,
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
                    minHeight: 60,
                }}
            >
                {showSkillGrid && (
                    <>
                        <div
                            style={{
                                fontSize: 11,
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
                                        fontSize: 12,
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
                                            color: "#9ca3af",
                                        }}
                                    >
                                        위력 {move.power} · 명중률{" "}
                                        {`${move.baseAcc ?? "-"}%`}
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
                                    fontSize: 11,
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
                            fontSize: 12,
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
                        minWidth: 180,
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
                    {enemySprite}
                </div>
            </div>

            {/* 플레이어 측: 하단 좌측 포켓몬 + HP */}
            <div
                style={{
                    position: "absolute",
                    left: 16,
                    bottom: 128,
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
                    {playerSprite}
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

            {/* 하단 명령 / 퀴즈 패널 */}
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    padding: "0.6rem 0.75rem",
                    background:
                        "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(15,23,42,1) 60%, #020617 100%)",
                    borderTop: "1px solid #020617",
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
                                width: "min(360px, 100% - 2rem)",
                                borderRadius: 12,
                                border: "1px solid #1f2937",
                                background: "#020617",
                                padding: "0.75rem 0.85rem",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: "#e5e7eb",
                                    marginBottom: 4,
                                }}
                            >
                                교체할 포켓몬 선택
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: "#9ca3af",
                                    marginBottom: 8,
                                }}
                            >
                                현재 HP가 남아있는 포켓몬만 선택할 수 있습니다.
                            </div>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                        "repeat(3, minmax(0, 1fr))",
                                    gap: 6,
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
                                                padding: "0.3rem 0.35rem",
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
                                                fontSize: 11,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontWeight: 600,
                                                    marginBottom: 2,
                                                }}
                                            >
                                                {mon.name}
                                            </div>
                                            <div 
                                                style={{
                                                fontSize: 10,
                                                color: "#9ca3af",
                                            }}
                                            >Lv {mon.level} · HP {mon.hp}/{mon.maxHp}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            
                            <div
                            style={{
                                        marginTop: 10,
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
                                                padding: "0.25rem 0.6rem",
                                                fontSize: 12,
                                                background: "#020617",
                                                color: "#e5e7eb",
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
