// src/components/SessionSummaryPanel.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type QuizQuestionLite = {
    id: string;
    index_in_pack: number;
    prompt: string;
    options: string[] | null;
    answer_index: number | null;
};

// TeacherRoomLivePage 쪽에서 만들어주는 QDD 통계 타입과 호환되게 정의
type QddQuestionStats = {
    questionId: string;
    total: number;
    correct: number;
    options: Record<number, number>;
};

type SessionSummaryPanelProps = {
    sessionId: string;
    questions: QuizQuestionLite[];
    /** QDD 방인 경우에만 넘어오는 game_events 기반 통계 (question.id 기준) */
    qddStatsByQuestion?: Record<string, QddQuestionStats>;
};

type AnswerAgg = {
    total: number;
    correct: number;
};

type Row = {
    questionId: string;
    index: number; // 1-based
    prompt: string;
    totalAnswers: number;
    correctCount: number;
    accuracy: number | null;
};

export const SessionSummaryPanel: React.FC<SessionSummaryPanelProps> = ({
                                                                            sessionId,
                                                                            questions,
                                                                            qddStatsByQuestion,
                                                                        }) => {
    const [answersByQuestion, setAnswersByQuestion] = useState<
        Record<string, AnswerAgg>
    >({});
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // 접기/펴기 토글
    const [collapsed, setCollapsed] = useState(false);

    // 20문항 단위로 범위 나누기
    const RANGE_SIZE = 20;
    const [activeRangeIndex, setActiveRangeIndex] = useState(0);

    // 1) quiz_answers 기준 세션 통계 로드 (한 번 로드, 세션이 바뀌면 다시)
    useEffect(() => {
        if (!sessionId) return;

        let cancelled = false;
        setLoading(true);
        setErrorMsg(null);

        const load = async () => {
            const { data, error } = await supabase
                .from("quiz_answers")
                .select("question_id, is_correct")
                .eq("session_id", sessionId);

            if (error) {
                console.error("[SessionSummaryPanel] load quiz_answers error", error);
                if (!cancelled) {
                    setErrorMsg("세션 정답 기록을 불러오는 중 오류가 발생했습니다.");
                    setLoading(false);
                }
                return;
            }

            const agg: Record<string, AnswerAgg> = {};
            for (const row of data ?? []) {
                const qid = row.question_id as string;
                if (!qid) continue;

                const isCorrect = row.is_correct === true;
                const prev = agg[qid] ?? { total: 0, correct: 0 };
                agg[qid] = {
                    total: prev.total + 1,
                    correct: prev.correct + (isCorrect ? 1 : 0),
                };
            }

            if (!cancelled) {
                setAnswersByQuestion(agg);
                setLoading(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [sessionId]);

    // 2) questions + quiz_answers + (선택) QDD 통계를 합쳐서 한 줄씩 만들기
    const rows: Row[] = useMemo(() => {
        if (!questions || questions.length === 0) return [];

        const list: Row[] = [];

        const sorted = [...questions].sort(
            (a, b) => a.index_in_pack - b.index_in_pack,
        );

        for (const q of sorted) {
            const index = q.index_in_pack + 1;
            const prompt = q.prompt ?? "";

            const baseAgg = answersByQuestion[q.id] ?? {
                total: 0,
                correct: 0,
            };

            const qddAgg = qddStatsByQuestion?.[q.id]
                ? {
                    total: qddStatsByQuestion[q.id].total,
                    correct: qddStatsByQuestion[q.id].correct,
                }
                : { total: 0, correct: 0 };

            const totalAnswers = baseAgg.total + qddAgg.total;
            const correctCount = baseAgg.correct + qddAgg.correct;

            const accuracy =
                totalAnswers > 0
                    ? Math.round((correctCount / totalAnswers) * 100)
                    : null;

            list.push({
                questionId: q.id,
                index,
                prompt,
                totalAnswers,
                correctCount,
                accuracy,
            });
        }

        return list;
    }, [questions, answersByQuestion, qddStatsByQuestion]);

    // 3) 전체 요약 (정답률 평균 등)
    const summary = useMemo(() => {
        if (rows.length === 0) {
            return {
                totalQuestions: 0,
                answeredQuestions: 0,
                totalAnswers: 0,
                totalCorrect: 0,
                avgAccuracy: null as number | null,
            };
        }

        let answeredQuestions = 0;
        let totalAnswers = 0;
        let totalCorrect = 0;

        for (const r of rows) {
            if (r.totalAnswers > 0) {
                answeredQuestions += 1;
                totalAnswers += r.totalAnswers;
                totalCorrect += r.correctCount;
            }
        }

        const avgAccuracy =
            answeredQuestions > 0 && totalAnswers > 0
                ? Math.round((totalCorrect / totalAnswers) * 100)
                : null;

        return {
            totalQuestions: rows.length,
            answeredQuestions,
            totalAnswers,
            totalCorrect,
            avgAccuracy,
        };
    }, [rows]);

    // 4) 20문항 단위 범위 계산
    const ranges = useMemo(() => {
        const total = rows.length;
        if (total === 0) return [];

        const count = Math.ceil(total / RANGE_SIZE);
        const out: { start: number; end: number }[] = [];

        for (let i = 0; i < count; i++) {
            const start = i * RANGE_SIZE + 1;
            const end = Math.min((i + 1) * RANGE_SIZE, total);
            out.push({ start, end });
        }

        return out;
    }, [rows.length]);

    // activeRangeIndex가 범위를 벗어나지 않도록 보정
    useEffect(() => {
        if (ranges.length === 0) {
            if (activeRangeIndex !== 0) setActiveRangeIndex(0);
            return;
        }
        if (activeRangeIndex >= ranges.length) {
            setActiveRangeIndex(ranges.length - 1);
        }
    }, [ranges, activeRangeIndex]);

    const visibleRows = useMemo(() => {
        if (rows.length === 0) return [];
        if (ranges.length === 0) return rows;

        const range = ranges[activeRangeIndex] ?? ranges[0];
        // 질문 번호(index)가 1-based라서 그대로 범위 필터
        return rows.filter(
            (r) => r.index >= range.start && r.index <= range.end,
        );
    }, [rows, ranges, activeRangeIndex]);

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                    gap: "0.5rem",
                }}
            >
                <h2 style={{ margin: 0 }}>세션 요약</h2>
                <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setCollapsed((v) => !v)}
                >
                    {collapsed ? "펼치기" : "접기"}
                </button>
            </div>

            {errorMsg && (
                <p
                    className="form-message"
                    style={{ color: "var(--danger)", marginBottom: "0.5rem" }}
                >
                    {errorMsg}
                </p>
            )}

            {collapsed ? (
                <p className="hint" style={{ marginTop: "0.25rem" }}>
                    세션 요약이 접힌 상태입니다. &quot;펼치기&quot; 버튼을 눌러
                    문항별 정답률을 확인할 수 있습니다.
                </p>
            ) : (
                <>
                    {/* 상단 요약 숫자들 */}
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.75rem",
                            fontSize: "0.9rem",
                            marginBottom: "0.5rem",
                        }}
                    >
                        <div>
                            문항 수:{" "}
                            <strong>{summary.totalQuestions}</strong>
                        </div>
                        <div>
                            응답이 있는 문항:{" "}
                            <strong>{summary.answeredQuestions}</strong>
                        </div>
                        <div>
                            총 응답 수:{" "}
                            <strong>{summary.totalAnswers}</strong>
                        </div>
                        <div>
                            전체 정답 수:{" "}
                            <strong>{summary.totalCorrect}</strong>
                        </div>
                        <div>
                            전체 정답률:{" "}
                            <strong>
                                {summary.avgAccuracy != null
                                    ? `${summary.avgAccuracy}%`
                                    : "-"}
                            </strong>
                        </div>
                    </div>

                    {loading && (
                        <p className="hint" style={{ marginBottom: "0.5rem" }}>
                            세션 정답 통계를 불러오는 중입니다...
                        </p>
                    )}

                    {rows.length === 0 && !loading ? (
                        <p className="hint">
                            아직 이 세션에 대한 정답 기록이 없습니다.
                        </p>
                    ) : (
                        <>
                            {/* 범위 선택 탭 (20문항 단위) */}
                            {ranges.length > 1 && (
                                <div
                                    style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: "0.25rem",
                                        marginBottom: "0.5rem",
                                    }}
                                >
                                    {ranges.map((r, idx) => (
                                        <button
                                            key={`${r.start}-${r.end}`}
                                            type="button"
                                            className="secondary-btn"
                                            onClick={() =>
                                                setActiveRangeIndex(idx)
                                            }
                                            style={{
                                                fontSize: "0.8rem",
                                                padding:
                                                    "0.15rem 0.5rem",
                                                borderColor:
                                                    idx === activeRangeIndex
                                                        ? "var(--accent)"
                                                        : "var(--border-subtle)",
                                                backgroundColor:
                                                    idx === activeRangeIndex
                                                        ? "rgba(56, 189, 248, 0.16)"
                                                        : "transparent",
                                            }}
                                        >
                                            {r.start}~{r.end}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* 문항별 정답률 테이블 */}
                            <div
                                style={{
                                    maxHeight: "320px",
                                    overflowY: "auto",
                                    borderRadius: "0.5rem",
                                    border:
                                        "1px solid var(--border-subtle)",
                                }}
                            >
                                <table
                                    style={{
                                        width: "100%",
                                        borderCollapse: "collapse",
                                        fontSize: "0.85rem",
                                    }}
                                >
                                    <thead>
                                    <tr
                                        style={{
                                            background:
                                                "rgba(15, 23, 42, 0.9)",
                                        }}
                                    >
                                        <th
                                            style={{
                                                padding:
                                                    "0.35rem 0.5rem",
                                                textAlign: "left",
                                                borderBottom:
                                                    "1px solid var(--border-subtle)",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            문항
                                        </th>
                                        <th
                                            style={{
                                                padding:
                                                    "0.35rem 0.5rem",
                                                textAlign: "left",
                                                borderBottom:
                                                    "1px solid var(--border-subtle)",
                                            }}
                                        >
                                            지문
                                        </th>
                                        <th
                                            style={{
                                                padding:
                                                    "0.35rem 0.5rem",
                                                textAlign: "right",
                                                borderBottom:
                                                    "1px solid var(--border-subtle)",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            응답 수
                                        </th>
                                        <th
                                            style={{
                                                padding:
                                                    "0.35rem 0.5rem",
                                                textAlign: "right",
                                                borderBottom:
                                                    "1px solid var(--border-subtle)",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            정답 수
                                        </th>
                                        <th
                                            style={{
                                                padding:
                                                    "0.35rem 0.5rem",
                                                textAlign: "right",
                                                borderBottom:
                                                    "1px solid var(--border-subtle)",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            정답률
                                        </th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {visibleRows.map((r) => {
                                        const shortPrompt =
                                            r.prompt.length > 80
                                                ? `${r.prompt.slice(
                                                    0,
                                                    80,
                                                )}…`
                                                : r.prompt;

                                        return (
                                            <tr
                                                key={r.questionId}
                                                style={{
                                                    borderTop:
                                                        "1px solid var(--border-subtle)",
                                                }}
                                            >
                                                <td
                                                    style={{
                                                        padding:
                                                            "0.3rem 0.5rem",
                                                        whiteSpace:
                                                            "nowrap",
                                                    }}
                                                >
                                                    Q{r.index}
                                                </td>
                                                <td
                                                    style={{
                                                        padding:
                                                            "0.3rem 0.5rem",
                                                    }}
                                                >
                                                    {shortPrompt ||
                                                        "(지문 없음)"}
                                                </td>
                                                <td
                                                    style={{
                                                        padding:
                                                            "0.3rem 0.5rem",
                                                        textAlign:
                                                            "right",
                                                        whiteSpace:
                                                            "nowrap",
                                                    }}
                                                >
                                                    {r.totalAnswers}
                                                </td>
                                                <td
                                                    style={{
                                                        padding:
                                                            "0.3rem 0.5rem",
                                                        textAlign:
                                                            "right",
                                                        whiteSpace:
                                                            "nowrap",
                                                    }}
                                                >
                                                    {r.correctCount}
                                                </td>
                                                <td
                                                    style={{
                                                        padding:
                                                            "0.3rem 0.5rem",
                                                        textAlign:
                                                            "right",
                                                        whiteSpace:
                                                            "nowrap",
                                                    }}
                                                >
                                                    {r.accuracy != null
                                                        ? `${r.accuracy}%`
                                                        : "-"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};
