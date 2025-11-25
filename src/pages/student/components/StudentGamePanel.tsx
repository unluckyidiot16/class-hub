// src/pages/student/components/StudentGamePanel.tsx
import type { RefObject, ComponentType } from "react";
import type {
    QuizPackRow,
    QuizQuestionRow,
} from "../StudentPlayPackPage";
import {
    GAME_REGISTRY,
    type GameKey,
} from "../../../games/gameRegistry";
import { QuizmonProvider } from "../../../games/quizmon/QuizmonProvider";

type SessionRow = {
    id: string;
    status: "pending" | "running" | "ended";
    current_index: number | null;
};

type Props = {
    gameKey: GameKey;
    roomId: string | null;
    pack: QuizPackRow | null;
    session: SessionRow | null;
    currentQuestion: QuizQuestionRow | null;

    /** 퀴즈 문항 수 (라이브에선 진행도용, self-play에선 전체 문항 수) */
    totalQuestions: number;
    /** 0-based 인덱스 */
    currentIndex: number;

    /** 공통 선택 상태 */
    selectedIndex: number | null;
    /** self-play 모드에서만 사용되는 정오 표시 */
    isCorrect: boolean | null;

    /** 제출 중 로딩 상태 */
    submitting: boolean;

    // ==== self-play(개인 연습용) builtin-quiz 모드용 ====
    /** 보기 선택 핸들러 (버튼 눌렀을 때 선택 표시만) */
    onSelect?: (idx: number) => void;
    /** "제출" 버튼 클릭 시 호출 */
    onSubmit?: () => void;
    /** "다음 문제" 버튼 클릭 시 호출 */
    onNext?: () => void;

    // ==== 라이브 수업용 builtin-quiz 모드용 ====
    /** 이미 답을 제출했는지 여부 */
    hasAnswered?: boolean;
    /** 제출 후 메시지 */
    submitMessage?: string | null;
    /** 보기 버튼을 클릭하면 곧바로 답안을 전송하는 핸들러 */
    onAnswerClick?: (idx: number) => void;

    // ==== 공통 게임 메타 ====
    classId?: string | null;
    gameSessionId?: string | null;
    studentId?: string | null;

    // ==== iframe 게임(QDD / Pixel)용 ====
    /** 부모에서 sessionId 등을 붙여서 내려주는 최종 iframe URL */
    iframeSrc?: string | null;
    /** QDD 메시지 브리지에서 사용될 iframe ref */
    iframeRef?: RefObject<HTMLIFrameElement | null>;
    /** 전체화면 여부(QDD) */
    isGameFullscreen?: boolean;
    /** 전체화면 토글 (true → 전체화면, false → 수업 화면) */
    onToggleFullscreen?: (fullscreen: boolean) => void;
};

export function StudentGamePanel(props: Props) {
    const {
        gameKey,
        roomId,
        pack,
        session,
        currentQuestion,
        totalQuestions,
        currentIndex,
        selectedIndex,
        isCorrect,
        submitting,

        onSelect,
        onSubmit,
        onNext,

        hasAnswered = false,
        submitMessage,
        onAnswerClick,

        classId = null,
        gameSessionId = null,
        studentId = null,

        iframeSrc,
        iframeRef,
        isGameFullscreen = false,
        onToggleFullscreen,
    } = props;

    const spec = GAME_REGISTRY[gameKey] ?? GAME_REGISTRY["quiz-only"];
    const isIframeGame = spec.mode === "iframe";
    const isReactGame = spec.mode === "react-component";
    const isGameRoom = isIframeGame || isReactGame;

    const title = isGameRoom ? "현재 게임" : "현재 문제";

    // 라이브 세션용 builtin-quiz 모드 여부
    const isLiveBuiltinQuiz = spec.mode === "builtin-quiz" && !!onAnswerClick;

    const fullscreenActive =
        !!isGameFullscreen && typeof onToggleFullscreen === "function";

    return (
        <div
            className="card"
            style={{
                maxWidth: isIframeGame ? "100%" : 720,
                margin: "0 auto",
            }}
        >
            {/* 카드 상단: 제목 + QDD 전체화면 버튼 */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                }}
            >
                <h2 style={{ margin: 0 }}>{title}</h2>

                {spec.mode === "iframe" &&
                    gameKey === "qdd" &&
                    session &&
                    session.status === "running" &&
                    iframeSrc &&
                    typeof onToggleFullscreen === "function" && (
                        <button
                            type="button"
                            className="secondary-btn"
                            style={{
                                fontSize: "0.8rem",
                                padding: "0.25rem 0.5rem",
                            }}
                            onClick={() => onToggleFullscreen(true)}
                        >
                            게임만 보기
                        </button>
                    )}
            </div>

            {/* === builtin-quiz 모드 === */}
            {spec.mode === "builtin-quiz" ? (
                !session || session.status === "ended" ? (
                    <p>
                        현재 진행 중인 퀴즈 세션이 없습니다. 선생님이 수업을
                        시작하면 문제가 자동으로 표시됩니다.
                    </p>
                ) : !currentQuestion ? (
                    <p>현재 인덱스에 해당하는 문제를 불러오지 못했습니다.</p>
                ) : isLiveBuiltinQuiz ? (
                    // 🔥 라이브 수업용: 보기 버튼 = 곧바로 제출
                    <>
                        <p
                            style={{
                                fontSize: "0.9rem",
                                marginBottom: "0.5rem",
                                color: "var(--text-sub)",
                            }}
                        >
                            선생님이 진행하는 문제에 맞춰 보기 중 하나를 선택해
                            주세요.
                        </p>

                        <p
                            style={{
                                whiteSpace: "pre-wrap",
                                marginBottom: "0.75rem",
                            }}
                        >
                            {currentQuestion.prompt}
                        </p>

                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.4rem",
                            }}
                        >
                            {(currentQuestion.options ?? []).map(
                                (opt, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        className={
                                            selectedIndex === idx
                                                ? "primary-btn"
                                                : "secondary-btn"
                                        }
                                        disabled={
                                            hasAnswered || submitting || !opt
                                        }
                                        onClick={() =>
                                            onAnswerClick(idx)
                                        }
                                        style={{ textAlign: "left" }}
                                    >
                                        <strong
                                            style={{
                                                marginRight: "0.4rem",
                                            }}
                                        >
                                            {String.fromCharCode(65 + idx)}.
                                        </strong>
                                        {opt || "(빈 보기)"}
                                    </button>
                                ),
                            )}
                        </div>

                        {submitMessage && (
                            <p
                                className="form-message"
                                style={{ marginTop: "0.75rem" }}
                            >
                                {submitMessage}
                            </p>
                        )}

                        {!hasAnswered && (
                            <p
                                className="hint"
                                style={{
                                    marginTop: "0.5rem",
                                    fontSize: "0.85rem",
                                }}
                            >
                                보기 버튼을 누르면 곧바로 답이 제출됩니다.
                                제출 후에는 다시 바꿀 수 없습니다.
                            </p>
                        )}
                    </>
                ) : (
                    // ✅ self-play(개인 연습)용 기존 UI 유지
                    <>
                        <p style={{ whiteSpace: "pre-wrap" }}>
                            {currentQuestion.prompt}
                        </p>
                        <div className="options">
                            {(
                                (currentQuestion.options ?? []) as string[]
                            ).map((opt: string, idx: number) => {
                                const isSelected = selectedIndex === idx;
                                const isAnswer =
                                    currentQuestion.answer_index === idx;

                                let className = "option-btn";
                                if (isSelected && isCorrect === true)
                                    className += " correct";
                                if (isSelected && isCorrect === false)
                                    className += " wrong";
                                if (!isSelected && isCorrect && isAnswer)
                                    className += " correct";

                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        className={className}
                                        disabled={
                                            submitting || isCorrect !== null
                                        }
                                        onClick={() =>
                                            onSelect && onSelect(idx)
                                        }
                                    >
                                        {opt}
                                    </button>
                                );
                            })}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginTop: "0.75rem",
                            }}
                        >
                            <button
                                type="button"
                                className="primary-btn"
                                onClick={() => onSubmit && onSubmit()}
                                disabled={
                                    submitting || selectedIndex === null
                                }
                            >
                                제출
                            </button>
                            <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => onNext && onNext()}
                                disabled={!totalQuestions}
                            >
                                {currentIndex + 1 >= totalQuestions
                                    ? "결과 보기"
                                    : "다음 문제"}
                            </button>
                        </div>
                    </>
                )
            ) : (
                // === 게임 모드 (iframe / React component) ===
                <>
                    {!roomId || !pack ? (
                        <p>
                            방 정보 또는 퀴즈팩 정보를 불러오지 못했습니다.
                        </p>
                    ) : !session || session.status !== "running" ? (
                        <p>
                            이 방은 <strong>{spec.label}</strong> 게임용
                            방입니다.
                            <br />
                            선생님이 게임을 시작하면 자동으로 게임 화면이
                            표시됩니다.
                        </p>
                    ) : spec.mode === "iframe" ? (
                        // 🔥 iframe 게임 (QDD / Pixel 등)
                        <div
                            className="qdd-frame-wrapper"
                            style={{
                                position: fullscreenActive
                                    ? "fixed"
                                    : "relative",
                                inset: fullscreenActive ? 0 : undefined,
                                top: fullscreenActive ? 0 : undefined,
                                left: fullscreenActive ? 0 : undefined,
                                width: fullscreenActive ? "100vw" : "100%",
                                height: fullscreenActive
                                    ? "100vh"
                                    : undefined,
                                aspectRatio: fullscreenActive
                                    ? undefined
                                    : "16 / 10",
                                borderRadius: fullscreenActive ? 0 : 12,
                                overflow: "hidden",
                                backgroundColor: "#000",
                                zIndex: fullscreenActive ? 1000 : "auto",
                            }}
                        >
                            <iframe
                                title={spec.label}
                                src={iframeSrc ?? undefined}
                                ref={iframeRef}
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    width: "100%",
                                    height: "100%",
                                    border: "none",
                                }}
                                allowFullScreen
                            />

                            {fullscreenActive && onToggleFullscreen && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        onToggleFullscreen(false)
                                    }
                                    style={{
                                        position: "absolute",
                                        top: 8,
                                        right: 8,
                                        zIndex: 1001,
                                        padding: "0.4rem 0.6rem",
                                        borderRadius: 999,
                                        border: "none",
                                        fontSize: "0.8rem",
                                        background:
                                            "rgba(15, 23, 42, 0.75)",
                                        color: "#fff",
                                    }}
                                >
                                    ✕ 수업 화면
                                </button>
                            )}
                        </div>
                    ) : (
                        // 🔥 React 기반 게임 (QuizMon Class 등)
                        spec.mode === "react-component" &&
                        spec.component && (
                            (() => {
                                const Component =
                                    spec.component as ComponentType<any>;
                                const inner = (
                                    <Component
                                        roomId={roomId}
                                        classId={classId}
                                        pack={pack}
                                        session={session}
                                        gameSessionId={gameSessionId}
                                        studentId={studentId}
                                    />
                                );

                                return gameKey === "quizmon" ? (
                                    <QuizmonProvider
                                        classId={classId}
                                        studentId={studentId}
                                    >
                                        {inner}
                                    </QuizmonProvider>
                                ) : (
                                    inner
                                );
                            })()
                        )
                    )}
                </>
            )}
        </div>
    );
}
