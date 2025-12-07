// src/autoppt/AutoPptQuestionPanel.tsx
import { useEffect, useState } from "react";
import type { AutopptDocRow } from "../api/autopptDocs";
import {
    type AutopptQuestionRow,
    listAutopptQuestions,
    createAutopptQuestion,
    deleteAutopptQuestion,
} from "./autopptQuestions";

export type AutoPptQuestionPanelProps = {
    roomId: string | null;
    doc: AutopptDocRow | null;
    /** 0-based page index from AutoPptTeacherPanel */
    currentPage: number;
};

export function AutoPptQuestionPanel({
                                         roomId,
                                         doc,
                                         currentPage,
                                     }: AutoPptQuestionPanelProps) {
    const [questions, setQuestions] = useState<AutopptQuestionRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 새 문제 폼 상태
    const [prompt, setPrompt] = useState("");
    const [options, setOptions] = useState<string[]>(["", "", "", ""]);
    const [answerIndex, setAnswerIndex] = useState(0);
    const [timeLimit, setTimeLimit] = useState(30);
    const [saving, setSaving] = useState(false);

    const humanPage = currentPage + 1;

    // 슬라이드 변경 시 문제 목록 로딩
    useEffect(() => {
        if (!roomId || !doc) {
            setQuestions([]);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        listAutopptQuestions({
            docId: doc.id,
            pageNumber: humanPage,
            roomId,
        })
            .then((rows) => {
                if (cancelled) return;
                setQuestions(rows);
            })
            .catch((err) => {
                console.error("[AutoPptQuestionPanel] list error", err);
                if (cancelled) return;
                setError(
                    err instanceof Error
                        ? err.message
                        : "문제를 불러오는 중 오류가 발생했습니다.",
                );
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [roomId, doc?.id, humanPage]);

    const handleOptionChange = (index: number, value: string) => {
        setOptions((prev) => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    };

    const handleCreate = async () => {
        if (!roomId || !doc) return;
        if (!prompt.trim()) {
            setError("문제 내용을 입력해 주세요.");
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const row = await createAutopptQuestion({
                docId: doc.id,
                roomId,
                pageNumber: humanPage,
                prompt: prompt.trim(),
                options,
                answerIndex,
                timeLimitSeconds: timeLimit,
            });

            setQuestions((prev) => [...prev, row]);
            setPrompt("");
            setOptions(["", "", "", ""]);
            setAnswerIndex(0);
            setTimeLimit(30);
        } catch (err) {
            console.error("[AutoPptQuestionPanel] create error", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "문제를 저장하는 중 오류가 발생했습니다.",
            );
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("이 문제 카드를 삭제할까요?")) return;

        try {
            await deleteAutopptQuestion(id);
            setQuestions((prev) => prev.filter((q) => q.id !== id));
        } catch (err) {
            console.error("[AutoPptQuestionPanel] delete error", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "문제를 삭제하는 중 오류가 발생했습니다.",
            );
        }
    };

    // 방 / 문서가 없을 때 안내
    if (!roomId || !doc) {
        return (
            <div
                style={{
                    padding: 12,
                    borderRadius: 12,
                    background: "rgba(15,23,42,0.9)",
                    border: "1px solid rgba(31,41,55,0.9)",
                    color: "#9ca3af",
                    fontSize: "0.8rem",
                }}
            >
                AutoPPT 문서가 없거나 방 정보가 없습니다.
                <br />
                먼저 PDF를 업로드한 뒤 문제를 등록해 주세요.
            </div>
        );
    }

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                padding: 12,
                borderRadius: 12,
                background: "rgba(15,23,42,0.9)",
                border: "1px solid rgba(31,41,55,0.9)",
                color: "#e5e7eb",
                gap: 8,
                fontSize: "0.8rem",
            }}
        >
            {/* 헤더 */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: "0.85rem",
                            fontWeight: 600,
                        }}
                    >
                        이 페이지 문제 카드
                    </div>
                    <div
                        style={{
                            fontSize: "0.7rem",
                            color: "#9ca3af",
                        }}
                    >
                        현재 슬라이드: {humanPage} 페이지
                    </div>
                </div>
                <div
                    style={{
                        fontSize: "0.7rem",
                        color: "#9ca3af",
                    }}
                >
                    {questions.length}개 등록됨
                </div>
            </div>

            {loading && (
                <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                    문제를 불러오는 중입니다...
                </div>
            )}

            {error && (
                <div
                    style={{
                        fontSize: "0.75rem",
                        color: "#fecaca",
                        background: "rgba(127,29,29,0.3)",
                        borderRadius: 8,
                        padding: "4px 8px",
                    }}
                >
                    {error}
                </div>
            )}

            {/* 문제 리스트 */}
            <div
                style={{
                    flex: 1,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    paddingRight: 4,
                }}
            >
                {questions.length === 0 && !loading && (
                    <div
                        style={{
                            fontSize: "0.75rem",
                            color: "#9ca3af",
                        }}
                    >
                        아직 이 페이지에 등록된 문제가 없습니다.
                        <br />
                        아래 폼에서 새 문제를 추가해 주세요.
                    </div>
                )}

                {questions.map((q, index) => (
                    <div
                        key={q.id}
                        style={{
                            borderRadius: 8,
                            border: "1px solid rgba(55,65,81,0.9)",
                            padding: "6px 8px",
                            background: "rgba(15,23,42,0.9)",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 4,
                                marginBottom: 4,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                }}
                            >
                                Q{index + 1}.{" "}
                                <span
                                    style={{
                                        fontWeight: 400,
                                    }}
                                >
                                    {q.prompt}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleDelete(q.id)}
                                style={{
                                    fontSize: "0.7rem",
                                    padding: "1px 6px",
                                    borderRadius: 999,
                                    border: "none",
                                    background: "rgba(127,29,29,0.8)",
                                    color: "#fee2e2",
                                    cursor: "pointer",
                                }}
                            >
                                삭제
                            </button>
                        </div>
                        <div
                            style={{
                                fontSize: "0.7rem",
                                color: "#9ca3af",
                                marginBottom: 2,
                            }}
                        >
                            보기 {q.options.length}개 · 제한 시간{" "}
                            {q.time_limit_seconds}초
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 4,
                                marginTop: 2,
                            }}
                        >
                            {q.options.map((opt, oi) => (
                                <span
                                    key={oi}
                                    style={{
                                        fontSize: "0.7rem",
                                        padding: "2px 6px",
                                        borderRadius: 999,
                                        border:
                                            oi === q.answer_index
                                                ? "1px solid rgba(52,211,153,0.9)"
                                                : "1px solid rgba(55,65,81,0.9)",
                                        background:
                                            oi === q.answer_index
                                                ? "rgba(5,46,22,0.9)"
                                                : "transparent",
                                        color:
                                            oi === q.answer_index
                                                ? "#bbf7d0"
                                                : "#e5e7eb",
                                    }}
                                >
                                    {oi + 1}. {opt}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* 새 문제 만들기 */}
            <div
                style={{
                    borderTop: "1px solid rgba(31,41,55,0.9)",
                    paddingTop: 6,
                    marginTop: 4,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                }}
            >
                <div
                    style={{
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        marginBottom: 2,
                    }}
                >
                    + 새 문제 만들기
                </div>

                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="문제 내용을 입력하세요."
                    rows={2}
                    style={{
                        width: "100%",
                        resize: "vertical",
                        fontSize: "0.75rem",
                        padding: "4px 6px",
                        borderRadius: 6,
                        border: "1px solid rgba(55,65,81,0.9)",
                        background: "#020617",
                        color: "#e5e7eb",
                    }}
                />

                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                    }}
                >
                    {options.map((opt, idx) => (
                        <div
                            key={idx}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                            }}
                        >
                            <input
                                type="radio"
                                name="autoppt-answer"
                                checked={answerIndex === idx}
                                onChange={() => setAnswerIndex(idx)}
                                style={{ marginRight: 4 }}
                            />
                            <input
                                type="text"
                                value={opt}
                                onChange={(e) =>
                                    handleOptionChange(idx, e.target.value)
                                }
                                placeholder={`보기 ${idx + 1}`}
                                style={{
                                    flex: 1,
                                    fontSize: "0.75rem",
                                    padding: "2px 6px",
                                    borderRadius: 6,
                                    border: "1px solid rgba(55,65,81,0.9)",
                                    background: "#020617",
                                    color: "#e5e7eb",
                                }}
                            />
                        </div>
                    ))}
                </div>

                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 4,
                        gap: 8,
                    }}
                >
                    <label
                        style={{
                            fontSize: "0.7rem",
                            color: "#9ca3af",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                        }}
                    >
                        제한 시간(초)
                        <input
                            type="number"
                            min={5}
                            max={300}
                            value={timeLimit}
                            onChange={(e) =>
                                setTimeLimit(
                                    Math.max(
                                        5,
                                        Math.min(300, Number(e.target.value) || 30),
                                    ),
                                )
                            }
                            style={{
                                width: 60,
                                fontSize: "0.75rem",
                                padding: "2px 4px",
                                borderRadius: 4,
                                border: "1px solid rgba(55,65,81,0.9)",
                                background: "#020617",
                                color: "#e5e7eb",
                            }}
                        />
                    </label>

                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={saving}
                        style={{
                            padding: "4px 10px",
                            fontSize: "0.75rem",
                            borderRadius: 999,
                            border: "none",
                            background: saving
                                ? "rgba(55,65,81,0.8)"
                                : "rgba(59,130,246,0.9)",
                            color: "#e5e7eb",
                            cursor: saving ? "default" : "pointer",
                        }}
                    >
                        {saving ? "저장 중..." : "문제 추가"}
                    </button>
                </div>
            </div>
        </div>
    );
}
