// src/components/QuizPackStatsModal.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type QuestionStatsRow = {
    id: string;
    index_in_pack: number;
    prompt: string;
    difficulty: number | null;
    tags: string[] | null;

    answer_count: number;
    correct_count: number;
    accuracy_percent: number | null;
    avg_time_ms: number | null;
};

export type PackQuestionStatsRowRaw = {
    question_id: string;
    index_in_pack: number;
    prompt: string;
    difficulty: number | null;
    tags: string[] | null;
    answer_count: number | null;
    correct_count: number | null;
    accuracy_percent: number | null;
    avg_time_ms: number | null;
};


type QuizPackLite = {
    id: string;
    title: string;
    subject?: string | null;
    grade?: string | null;
};

type QuizPackStatsModalProps = {
    pack: QuizPackLite;
    onClose: () => void;
};

/**
 * 퀴즈팩 통계 모달
 * - pack_question_stats_v1 뷰를 기반으로 문항별 정답률/응답 수를 표시
 * - 기본 정보(난이도 분포, 태그 분포)도 함께 보여줌
 */
export function QuizPackStatsModal({ pack, onClose }: QuizPackStatsModalProps) {
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [questions, setQuestions] = useState<QuestionStatsRow[]>([]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setErrorMsg(null);

            const { data, error } = await supabase
                .from("pack_question_stats_v1")
                .select(
                    [
                        "question_id",
                        "index_in_pack",
                        "prompt",
                        "difficulty",
                        "tags",
                        "answer_count",
                        "correct_count",
                        "accuracy_percent",
                        "avg_time_ms",
                    ].join(", "),
                )
                .eq("pack_id", pack.id)
                .order("index_in_pack", { ascending: true });

            if (error) {
                console.error("[QuizPackStatsModal] load error", error);
                setErrorMsg(
                    error.message ??
                    "퀴즈팩 통계를 불러오는 중 오류가 발생했습니다.",
                );
                setLoading(false);
                return;
            }


            // 🔥 핵심: data가 union(GenericStringError[] 포함)이라서,
            //       unknown 을 한번 거쳐서 우리가 원하는 타입으로 캐스팅.
            const rows = (data ?? []) as unknown as PackQuestionStatsRowRaw[];

            setQuestions(
                rows.map((r) => ({
                    id: r.question_id,
                    index_in_pack: r.index_in_pack,
                    prompt: r.prompt,
                    difficulty: r.difficulty,
                    tags: r.tags,
                    answer_count: r.answer_count ?? 0,
                    correct_count: r.correct_count ?? 0,
                    accuracy_percent: r.accuracy_percent,
                    avg_time_ms: r.avg_time_ms,
                })),
            );
            setLoading(false);
        };

        void load();
    }, [pack.id]);



    // 난이도 분포
    const difficultyCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        questions.forEach((q) => {
            const key =
                typeof q.difficulty === "number" && q.difficulty > 0
                    ? String(q.difficulty)
                    : "미지정";
            counts[key] = (counts[key] ?? 0) + 1;
        });
        return counts;
    }, [questions]);

    // 태그 분포
    const tagCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        questions.forEach((q) => {
            if (!Array.isArray(q.tags)) return;
            q.tags.forEach((t) => {
                const tag = (t ?? "").trim();
                if (!tag) return;
                counts[tag] = (counts[tag] ?? 0) + 1;
            });
        });
        return counts;
    }, [questions]);

    const totalQuestions = questions.length;
    const totalAnswers = questions.reduce(
        (sum, q) => sum + (q.answer_count ?? 0),
        0,
    );
    const totalCorrect = questions.reduce(
        (sum, q) => sum + (q.correct_count ?? 0),
        0,
    );
    const overallAccuracy =
        totalAnswers > 0
            ? Math.round((totalCorrect / totalAnswers) * 100)
            : null;

    return (
        <div className="modal-backdrop">
            <div
                className="modal"
                style={{ maxWidth: "720px", width: "100%" }}
            >
                <h2>퀴즈팩 통계</h2>
                <p className="page-desc">
                    <strong>{pack.title}</strong>{" "}
                    {pack.subject && `(${pack.subject})`}{" "}
                    {pack.grade && `· ${pack.grade}`}
                </p>

                {loading ? (
                    <p>통계를 불러오는 중입니다...</p>
                ) : errorMsg ? (
                    <p
                        className="form-message"
                        style={{ color: "var(--danger)" }}
                    >
                        {errorMsg}
                    </p>
                ) : (
                    <>
                        {/* 상단 요약 영역 */}
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "1.5rem",
                                marginBottom: "1rem",
                            }}
                        >
                            {/* 기본 정보 */}
                            <div>
                                <h3 style={{ marginBottom: "0.4rem" }}>
                                    기본 정보
                                </h3>
                                <ul
                                    style={{
                                        fontSize: "0.9rem",
                                        paddingLeft: "1.1rem",
                                    }}
                                >
                                    <li>문항 수: {totalQuestions}개</li>
                                    <li>
                                        난이도 지정 문항:{" "}
                                        {Object.keys(difficultyCounts)
                                            .filter((k) => k !== "미지정")
                                            .reduce(
                                                (sum, k) =>
                                                    sum +
                                                    (difficultyCounts[k] ?? 0),
                                                0,
                                            )}{" "}
                                        개
                                    </li>
                                    <li>
                                        태그 사용 개수:{" "}
                                        {Object.keys(tagCounts).length}개
                                    </li>
                                    <li>총 응답 수: {totalAnswers}개</li>
                                    <li>
                                        전체 정답률:{" "}
                                        {overallAccuracy != null
                                            ? `${overallAccuracy}%`
                                            : "데이터 없음"}
                                    </li>
                                </ul>
                            </div>

                            {/* 난이도 분포 */}
                            <div>
                                <h3 style={{ marginBottom: "0.4rem" }}>
                                    난이도 분포
                                </h3>
                                {Object.keys(difficultyCounts).length === 0 ? (
                                    <p
                                        style={{
                                            fontSize: "0.85rem",
                                            color: "var(--text-sub)",
                                        }}
                                    >
                                        난이도 정보가 없습니다.
                                    </p>
                                ) : (
                                    <ul
                                        style={{
                                            fontSize: "0.9rem",
                                            paddingLeft: "1.1rem",
                                        }}
                                    >
                                        {Object.entries(difficultyCounts)
                                            .sort(([a], [b]) => {
                                                if (a === "미지정") return 1;
                                                if (b === "미지정") return -1;
                                                return Number(a) - Number(b);
                                            })
                                            .map(([d, c]) => (
                                                <li key={d}>
                                                    난이도 {d}: {c}개
                                                </li>
                                            ))}
                                    </ul>
                                )}
                            </div>

                            {/* 태그 상위 목록 */}
                            <div>
                                <h3 style={{ marginBottom: "0.4rem" }}>
                                    태그 상위 목록
                                </h3>
                                {Object.keys(tagCounts).length === 0 ? (
                                    <p
                                        style={{
                                            fontSize: "0.85rem",
                                            color: "var(--text-sub)",
                                        }}
                                    >
                                        태그가 지정된 문항이 없습니다.
                                    </p>
                                ) : (
                                    <ul
                                        style={{
                                            fontSize: "0.9rem",
                                            paddingLeft: "1.1rem",
                                        }}
                                    >
                                        {Object.entries(tagCounts)
                                            .sort((a, b) => b[1] - a[1])
                                            .slice(0, 10)
                                            .map(([tag, c]) => (
                                                <li key={tag}>
                                                    {tag}: {c}개
                                                </li>
                                            ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* 문항 목록 + 정답률 */}
                        <h3 style={{ marginBottom: "0.4rem" }}>
                            문항 목록 (요약)
                        </h3>
                        {questions.length === 0 ? (
                            <p
                                style={{
                                    fontSize: "0.85rem",
                                    color: "var(--text-sub)",
                                }}
                            >
                                아직 이 퀴즈팩에는 문항이 없습니다.
                            </p>
                        ) : (
                            <div
                                style={{
                                    maxHeight: "260px",
                                    overflowY: "auto",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "8px",
                                    padding: "0.5rem",
                                    fontSize: "0.85rem",
                                }}
                            >
                                <table
                                    style={{
                                        width: "100%",
                                        borderCollapse: "collapse",
                                    }}
                                >
                                    <thead>
                                    <tr>
                                        <th
                                            style={{
                                                textAlign: "left",
                                                padding: "0.25rem",
                                                borderBottom:
                                                    "1px solid var(--border-subtle)",
                                                width: "3rem",
                                            }}
                                        >
                                            #
                                        </th>
                                        <th
                                            style={{
                                                textAlign: "left",
                                                padding: "0.25rem",
                                                borderBottom:
                                                    "1px solid var(--border-subtle)",
                                            }}
                                        >
                                            지문
                                        </th>
                                        <th
                                            style={{
                                                textAlign: "left",
                                                padding: "0.25rem",
                                                borderBottom:
                                                    "1px solid var(--border-subtle)",
                                                width: "4rem",
                                            }}
                                        >
                                            난이도
                                        </th>
                                        <th
                                            style={{
                                                textAlign: "right",
                                                padding: "0.25rem",
                                                borderBottom:
                                                    "1px solid var(--border-subtle)",
                                                width: "5rem",
                                            }}
                                        >
                                            응답 수
                                        </th>
                                        <th
                                            style={{
                                                textAlign: "right",
                                                padding: "0.25rem",
                                                borderBottom:
                                                    "1px solid var(--border-subtle)",
                                                width: "5rem",
                                            }}
                                        >
                                            정답률
                                        </th>
                                        <th
                                            style={{
                                                textAlign: "left",
                                                padding: "0.25rem",
                                                borderBottom:
                                                    "1px solid var(--border-subtle)",
                                                width: "8rem",
                                            }}
                                        >
                                            태그
                                        </th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {questions.map((q) => (
                                        <tr key={q.id}>
                                            <td
                                                style={{
                                                    padding: "0.25rem",
                                                    verticalAlign: "top",
                                                }}
                                            >
                                                {q.index_in_pack + 1}
                                            </td>
                                            <td
                                                style={{
                                                    padding: "0.25rem",
                                                    verticalAlign: "top",
                                                }}
                                            >
                                                {q.prompt.length > 80
                                                    ? q.prompt.slice(
                                                    0,
                                                    80,
                                                ) + "..."
                                                    : q.prompt}
                                            </td>
                                            <td
                                                style={{
                                                    padding: "0.25rem",
                                                    verticalAlign: "top",
                                                }}
                                            >
                                                {typeof q.difficulty ===
                                                "number" &&
                                                q.difficulty > 0
                                                    ? q.difficulty
                                                    : "-"}
                                            </td>
                                            <td
                                                style={{
                                                    padding: "0.25rem",
                                                    verticalAlign: "top",
                                                    textAlign: "right",
                                                }}
                                            >
                                                {q.answer_count ?? 0}
                                            </td>
                                            <td
                                                style={{
                                                    padding: "0.25rem",
                                                    verticalAlign: "top",
                                                    textAlign: "right",
                                                }}
                                            >
                                                {q.answer_count > 0 &&
                                                q.accuracy_percent != null
                                                    ? `${q.accuracy_percent}%`
                                                    : "-"}
                                            </td>
                                            <td
                                                style={{
                                                    padding: "0.25rem",
                                                    verticalAlign: "top",
                                                }}
                                            >
                                                {Array.isArray(q.tags) &&
                                                q.tags.length > 0
                                                    ? q.tags.join(", ")
                                                    : "-"}
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                <div
                    style={{
                        marginTop: "1rem",
                        textAlign: "right",
                    }}
                >
                    <button
                        type="button"
                        className="secondary-btn"
                        onClick={onClose}
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
