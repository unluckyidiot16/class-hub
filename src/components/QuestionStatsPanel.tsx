// src/components/QuestionStatsPanel.tsx
import React from "react";
import { useQuestionStats } from "../hooks/useQuestionStats";

type QuestionStatsPanelProps = {
    sessionId?: string;
    questionId?: string;
    options: string[];
    correctIndex: number;
};

export const QuestionStatsPanel: React.FC<QuestionStatsPanelProps> = ({
                                                                          sessionId,
                                                                          questionId,
                                                                          options,
                                                                          correctIndex,
                                                                      }) => {
    const { stats, loading, error } = useQuestionStats(sessionId, questionId, 2000);

    if (!sessionId || !questionId) {
        // 아직 세션/문제 정보가 없을 때는 패널 자체를 숨김
        return null;
    }

    const total = stats?.totalAnswers ?? 0;
    const correct = stats?.totalCorrect ?? 0;
    const correctRate = total > 0 ? Math.round((correct / total) * 100) : 0;
    const maxCount =
        stats?.choiceStats.reduce((m, c) => Math.max(m, c.count), 0) ?? 0;

    return (
        <div className="question-stats-panel">
            <h3 className="qsp-title">현재 문제 통계</h3>

            <div className="qsp-summary">
                <span>
                    응답자 수: <strong>{total}</strong>명
                </span>
                <span className="qsp-dot">·</span>
                <span>
                    정답률: <strong>{correctRate}</strong>%
                </span>
            </div>

            {loading && !stats && (
                <p className="qsp-sub">통계를 불러오는 중…</p>
            )}
            {!loading && total === 0 && (
                <p className="qsp-sub">아직 응답한 학생이 없습니다.</p>
            )}
            {error && (
                <p className="qsp-error">통계 로딩 오류: {error}</p>
            )}

            <ul className="qsp-choice-list">
                {options.map((text, idx) => {
                    const s = stats?.choiceStats.find((c) => c.index === idx);
                    const count = s?.count ?? 0;
                    const rate = total > 0 ? Math.round((count / total) * 100) : 0;
                    const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    const isCorrect = idx === correctIndex;

                    return (
                        <li
                            key={idx}
                            className={
                                "qsp-choice" + (isCorrect ? " qsp-choice-correct" : "")
                            }
                        >
                            <div className="qsp-choice-header">
                                <span className="qsp-choice-label">
                                    {String.fromCharCode(65 + idx)}.
                                </span>
                                <span className="qsp-choice-text">{text}</span>
                                <span className="qsp-choice-rate">
                                    선택률 {rate}% ({count}명)
                                    {isCorrect ? " · 정답" : ""}
                                </span>
                            </div>
                            <div className="qsp-bar-bg">
                                <div
                                    className="qsp-bar-fill"
                                    style={{ width: `${width}%` }}
                                />
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};