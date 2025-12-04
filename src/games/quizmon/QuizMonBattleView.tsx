// src/games/quizmon/QuizMonBattleView.tsx
import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type {
    BattleState,
    Move,
    QuizQuestionLite,
    Monster,
} from "./types";
import { HpBar } from "./HpBar";

type AttackPhase = "idle" | "playerAttack" | "enemyAttack" | "comment";


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

    attackPhase: AttackPhase;
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
        attackPhase,
    } = props;

    const isQuizPhase = phase === "quiz" && !!currentQuestion;
    const isFinished = phase === "finished";
    const isAnimating = attackPhase !== "idle";

    // 하단 메인 텍스트
    let mainText: string;
    if (isQuizPhase && currentQuestion) {
        // 🔹 문제 퀴즈 단계
        mainText = currentQuestion.prompt;
    } else if (isFinished) {
        mainText =
            "배틀이 종료되었습니다. 위의 결과를 확인한 뒤 리셋 버튼으로 다시 시작할 수 있어요.";
    } else if (!hasQuestions) {
        mainText = "이 퀴즈팩에는 문제가 없습니다. (질문 0개)";
    } else if (isAnimating) {
        // 🔹 공격/피격/코멘트 연출 단계
        if (attackPhase === "playerAttack") {
            mainText = `${playerName}의 공격!`;
        } else if (attackPhase === "enemyAttack") {
            mainText = "상대의 반격!";
        } else {
            // attackPhase === "comment"
            mainText = "공격 결과를 확인해 보세요.";
        }
    } else {
        // 🔹 평상시 커맨드 텍스트
        mainText = `${playerName}은(는) 무엇을 할까?`;
    }

    // 🔹 애니메이션 중에는 스킬/교체 버튼 숨김
    const showSkillGrid = !isQuizPhase && !isFinished && !isAnimating;


    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "2.2fr 1.5fr",
                gap: 8,
                // 반응형 폰트: 최소 13px, 화면 크기에 따라 커짐
                fontSize: "max(13px, 1.8vmin)",
            }}
        >
            {/* 왼쪽: 메세지 + (퀴즈 phase일 때) 보기 4개 */}
            <div
                style={{
                    borderRadius: 8,
                    border: "1px solid #020617",
                    background: "#020617",
                    padding: "0.6rem 0.8rem",
                    // 높이: 최소 80px, 화면 높이의 12%
                    minHeight: "max(80px, 12vh)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                }}
            >
                <div
                    style={{
                        // 제목 폰트: 최소 14px
                        fontSize: "max(14px, 2.2vmin)",
                        fontWeight: 600,
                        marginBottom: isQuizPhase ? 6 : 0,
                        lineHeight: 1.5,
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
                            gap: 6,
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
                                        padding: "0.4rem 0.5rem",
                                        textAlign: "left",
                                        background: "#020617",
                                        color: "#e5e7eb",
                                        // 보기 폰트: 최소 12px
                                        fontSize: "max(12px, 1.8vmin)",
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
                    padding: "0.6rem 0.8rem",
                    minHeight: "max(80px, 12vh)",
                }}
            >
                {showSkillGrid && (
                    <>
                        <div
                            style={{
                                fontSize: "max(11px, 1.6vmin)",
                                color: "#9ca3af",
                                marginBottom: 6,
                            }}
                        >
                            사용할 기술을 선택하세요.
                        </div>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "repeat(2, minmax(0, 1fr))",
                                gap: 6,
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
                                        padding: "0.4rem 0.5rem",
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
                                            fontSize: "max(13px, 1.9vmin)",
                                        }}
                                    >
                                        {move.name}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "max(11px, 1.5vmin)",
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
                                marginTop: 8,
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
                                    padding: "0.3rem 0.8rem",
                                    fontSize: "max(11px, 1.6vmin)",
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
                            fontSize: "max(14px, 2vmin)",
                            color: "#e5e7eb",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%"
                        }}
                    >
                        배틀 종료
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

    // 🔹 공격/피격/코멘트 애니메이션 단계
    const [attackPhase, setAttackPhase] = useState<AttackPhase>("idle");
    const lastResultKeyRef = useRef<string | null>(null);

    const canSwitch =
        state.phase === "command" &&
        state.player.monsters.some(
            (m, idx) => idx !== state.player.activeIndex && m.hp > 0,
        );

    // 🔹 애니메이션 중에는 스킬 선택도 막는다
    const effectiveCanSelectMove = canSelectMove && attackPhase === "idle";


    const hasQuestions = questions.length > 0;
    const currentQuestion =
        state.phase === "quiz"
            ? state.currentQuestion ?? null
            : null;


    useEffect(() => {
        const r = state.lastQuizResult;
        if (!r) return;

        // 같은 결과로 중복 실행되는 것 방지용 키
        const key = `${r.questionId}-${r.chosenIndex}-${r.timeMs}`;
        if (lastResultKeyRef.current === key) return;
        lastResultKeyRef.current = key;

        // 1) 플레이어 공격
        setAttackPhase("playerAttack");

        const PLAYER_MS = 600;
        const ENEMY_MS = 600;
        const COMMENT_MS = 500;

        const t1 = window.setTimeout(() => {
            // 2) 적 공격
            setAttackPhase("enemyAttack");
        }, PLAYER_MS);

        const t2 = window.setTimeout(() => {
            // 3) 코멘트 단계
            setAttackPhase("comment");
        }, PLAYER_MS + ENEMY_MS);

        const t3 = window.setTimeout(() => {
            // 4) 다음 턴 대기(입력 가능)
            setAttackPhase("idle");
        }, PLAYER_MS + ENEMY_MS + COMMENT_MS);

        return () => {
            window.clearTimeout(t1);
            window.clearTimeout(t2);
            window.clearTimeout(t3);
        };
    }, [state.lastQuizResult]);


    return (
        <>
            {/* ========================================================= */}
            {/* 1. 적(Enemy) 정보창: 화면 좌측 상단 (left: 5%, top: 5%) */}
            {/* ========================================================= */}
            <div
                style={{
                    position: "absolute",
                    top: "5%",
                    left: "5%",
                    zIndex: 20, // 스프라이트보다 위에 오도록
                }}
            >
                <div
                    style={{
                        minWidth: "max(180px, 25vw)",
                        padding: "0.6rem 0.8rem",
                        borderRadius: 8,
                        background: "rgba(15,23,42,0.85)",
                        border: "1px solid #334155",
                        textAlign: "left",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
                    }}
                >
                    <div
                        style={{
                            fontWeight: 700,
                            marginBottom: 4,
                            fontSize: "max(14px, 2.2vmin)",
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
                            fontSize: "max(11px, 1.5vmin)",
                            marginTop: 3,
                            textAlign: "right",
                            color: "#cbd5e1"
                        }}
                    >
                        {enemyMon.hp}/{enemyMon.maxHp}
                    </div>
                </div>
            </div>

            {/* ========================================================= */}
            {/* 2. 적(Enemy) 스프라이트: 화면 우측 상단 (right: 10%, top: 12%) */}
            {/* ========================================================= */}
            <div
                style={{
                    position: "absolute",
                    top: "12%",
                    right: "10%",
                    width: "max(100px, 15vw)",
                    height: "max(100px, 15vw)",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "flex-end",
                    zIndex: 10,
                }}
                className={[
                    "qzmon-sprite",
                    "qzmon-sprite-enemy",
                    attackPhase === "enemyAttack"
                        ? "qzmon-sprite-attack"
                        : attackPhase === "playerAttack"
                            ? "qzmon-sprite-hit"
                            : "",
                ].join(" ")}
            >
                {enemySprite}
            </div>


            {/* ========================================================= */}
            {/* 3. 플레이어(Player) 스프라이트: 화면 좌측 하단 (left: 10%, bottom: 28%) */}
            {/* 하단 패널(약 20~25%)보다 살짝 위에 위치 */}
            {/* ========================================================= */}
            <div
                style={{
                    position: "absolute",
                    left: "10%",
                    bottom: "28%",
                    width: "max(100px, 15vw)",
                    height: "max(100px, 15vw)",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "flex-start",
                    zIndex: 10,
                }}
                className={[
                    "qzmon-sprite",
                    "qzmon-sprite-player",
                    attackPhase === "playerAttack"
                        ? "qzmon-sprite-attack"
                        : attackPhase === "enemyAttack"
                            ? "qzmon-sprite-hit"
                            : "",
                ].join(" ")}
            >
                {playerSprite}
            </div>


            {/* ========================================================= */}
            {/* 4. 플레이어(Player) 정보창: 화면 우측 하단 (right: 5%, bottom: 30%) */}
            {/* **핵심**: 스프라이트 반대편에 위치하여 겹침 방지 */}
            {/* ========================================================= */}
            <div
                style={{
                    position: "absolute",
                    right: "5%",
                    bottom: "30%", // 패널 위 + 스프라이트 높이 고려
                    zIndex: 20,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end", // 우측 정렬
                }}
            >
                <div
                    style={{
                        minWidth: "max(200px, 28vw)",
                        padding: "0.6rem 0.8rem",
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
                            fontSize: "max(15px, 2.4vmin)",
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
                            fontSize: "max(12px, 1.8vmin)",
                            marginTop: 3,
                            textAlign: "right",
                            fontWeight: 600,
                            color: "#e2e8f0"
                        }}
                    >
                        {playerMon.hp} / {playerMon.maxHp}
                    </div>
                </div>
            </div>

            {/* ========================================================= */}
            {/* 하단 명령 / 퀴즈 패널 (bottom: 0) */}
            {/* ========================================================= */}
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    padding: "1rem 1.2rem",
                    background:
                        "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, #020617 100%)",
                    borderTop: "1px solid #1e293b",
                    zIndex: 30, // 최상단
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
                                width: "min(400px, 90vw)",
                                borderRadius: 12,
                                border: "1px solid #1f2937",
                                background: "#020617",
                                padding: "1.2rem",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "1.1rem",
                                    fontWeight: 600,
                                    color: "#e5e7eb",
                                    marginBottom: 6,
                                }}
                            >
                                교체할 포켓몬 선택
                            </div>
                            <div
                                style={{
                                    fontSize: "0.9rem",
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
                                    gap: 10,
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
                                                padding: "0.6rem",
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
                                                fontSize: "0.85rem",
                                                position: "relative",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontWeight: 600,
                                                    marginBottom: 4,
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
                                        padding: "0.5rem 1.2rem",
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
                    canSelectMove={effectiveCanSelectMove}
                    hasQuestions={hasQuestions}
                    onSelectMove={onSelectMove}
                    onAnswer={onAnswer}
                    canSwitch={canSwitch}
                    onOpenSwitchModal={() => setShowSwitchModal(true)}
                    attackPhase={attackPhase}   // 🔹 추가
                />
            </div>
        </>
    );
}