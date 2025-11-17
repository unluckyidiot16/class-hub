import React from "react";
import { useSessionSummary } from "../hooks/useSessionSummary";

    type SimpleQuestion = {
        id: string;
    index_in_pack: number;
    prompt: string;
};

    // QDD에서 넘어오는 game_events 기반 집계 타입(필요한 필드만)
        type ExternalQddQuestionStats = {
        questionId: string;
    total: number;
    correct: number;
};

    type SessionSummaryPanelProps = {
    sessionId?: string;
    questions: SimpleQuestion[];
    /** QDD 등 game_events 기반 문항별 통계 (선택) */
        qddStatsByQuestion?: Record<string, ExternalQddQuestionStats>;
};

    export const SessionSummaryPanel: React.FC<SessionSummaryPanelProps> = ({
    sessionId,
        questions,
        qddStatsByQuestion,
    }) => {
        const { summary, loading, error } = useSessionSummary(sessionId, 5000);
    
            if (!sessionId) return null;
    
            // questionId → { totalAnswers, totalCorrect } 통합 매핑
            type AggregatedStats = {
                totalAnswers: number;
            totalCorrect: number;
        };
        const map = new Map<string, AggregatedStats>();
    
            // 1) quiz_answers 기반 서버 요약
                if (summary) {
                for (const q of summary.questions) {
                        map.set(q.questionId, {
                                totalAnswers: q.totalAnswers,
                                totalCorrect: q.totalCorrect,
                            });
                    }
            }
    
            // 2) QDD game_events 기반 집계가 있으면 합산
                if (qddStatsByQuestion) {
                for (const [questionId, s] of Object.entries(qddStatsByQuestion)) {
                        if (!s) continue;
                        const existing = map.get(questionId) ?? {
                                totalAnswers: 0,
                                totalCorrect: 0,
                            };
                       map.set(questionId, {
                                totalAnswers: existing.totalAnswers + (s.total ?? 0),
                                totalCorrect: existing.totalCorrect + (s.correct ?? 0),
                            });
                    }
                }

    const rows = [...questions].sort(
        (a, b) => a.index_in_pack - b.index_in_pack
    );

    return (
        <div className="session-summary-panel">
            <h3 className="ssp-title">세션 요약 (문항별 정답률)</h3>
            <p className="ssp-sub">
                이 세션에서 출제된 각 문항에 대한 응답자 수와 정답률입니다.
                세션 진행 중에도 실시간으로 업데이트됩니다.
                {/* QDD 방에서는 game_events 기반 응답도 포함됨 */}
            </p>
            {loading && !summary && (
                <p className="ssp-sub">요약을 불러오는 중…</p>
            )}
            {error && (
                <p className="ssp-error">요약 로딩 오류: {error}</p>
            )}

            <div className="ssp-table-wrapper">
                <table className="ssp-table">
                    <thead>
                    <tr>
                        <th style={{ width: "3rem" }}>문항</th>
                        <th>질문</th>
                        <th style={{ width: "6rem" }}>응답자 수</th>
                        <th style={{ width: "6rem" }}>정답률</th>
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map((q) => {
                        const agg = map.get(q.id);
                        const total = agg?.totalAnswers ?? 0;
                        const correct = agg?.totalCorrect ?? 0;
                        const rate =
                            total > 0
                                ? Math.round((correct / total) * 100)
                                : 0;
                        
                        return (
                            <tr key={q.id}>
                                <td>Q{q.index_in_pack + 1}</td>
                                <td className="ssp-question-cell">
                                    {q.prompt.length > 80
                                        ? q.prompt.slice(0, 80) + "…"
                                        : q.prompt}
                                </td>
                                <td>{total}명</td>
                                <td>{rate}%</td>
                            </tr>
                        );
                    })}
                    {rows.length === 0 && (
                        <tr>
                            <td colSpan={4} style={{ textAlign: "center" }}>
                                이 퀴즈팩에는 아직 문항이 없습니다.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
