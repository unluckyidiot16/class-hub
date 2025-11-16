// src/components/StudentGamePanel.tsx

import type {
    QuizPackRow,
    QuizQuestionRow,
} from "../pages/student/StudentPlayPackPage";
import { GAME_REGISTRY, type GameKey } from "../games/gameRegistry";

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
    totalQuestions: number;
    currentIndex: number;
    selectedIndex: number | null;
    isCorrect: boolean | null;
    onSelect: (idx: number) => void;
    onSubmit: () => void;
    onNext: () => void;
    submitting: boolean;
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
        onSelect,
        onSubmit,
        onNext,
        submitting,
    } = props;

    const spec = GAME_REGISTRY[gameKey] ?? GAME_REGISTRY["quiz-only"];
    const title = spec.mode === "builtin-quiz" ? "현재 문제" : "현재 게임";

    return (
        <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2>{title}</h2>

            {spec.mode === "builtin-quiz" ? (
                // === 기본 퀴즈 모드 ===
                !session || session.status === "ended" ? (
                    <p>
                        현재 진행 중인 퀴즈 세션이 없습니다. 선생님이 수업을
                        시작하면 문제가 자동으로 표시됩니다.
                    </p>
                ) : !currentQuestion ? (
                    <p>현재 인덱스에 해당하는 문제를 불러오지 못했습니다.</p>
                ) : (
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
                                        onClick={() => onSelect(idx)}
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
                                marginTop: "1rem",
                            }}
                        >
                            <button
                                type="button"
                                className="primary-btn"
                                onClick={onSubmit}
                                disabled={
                                    submitting || selectedIndex === null
                                }
                            >
                                제출
                            </button>
                            <button
                                type="button"
                                className="secondary-btn"
                                onClick={onNext}
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
                // === 게임 모드 (iframe / React 컴포넌트) ===
                <>
                    {!roomId || !pack ? (
                        <p>방 정보 또는 퀴즈팩 정보를 불러오지 못했습니다.</p>
                    ) : !session || session.status !== "running" ? (
                        <p>
                            이 방은{" "}
                            <strong>{spec.label}</strong> 게임용 방입니다.
                            <br />
                            선생님이 게임을 시작하면 자동으로 게임 화면이
                            표시됩니다.
                        </p>
                    ) : spec.mode === "iframe" ? (
                        <iframe
                            title={spec.label}
                            src={spec.buildUrl({
                                pack,
                                roomId,
                            })}
                            style={{
                                width: "100%",
                                height: 600,
                                border: "none",
                                borderRadius: 12,
                            }}
                            allowFullScreen
                        />
                    ) : (
                        spec.mode === "react-component" &&
                        spec.component && (
                            <spec.component
                                roomId={roomId}
                                pack={pack}
                                session={session}
                            />
                        )
                    )}
                </>
            )}
        </div>
    );
}
