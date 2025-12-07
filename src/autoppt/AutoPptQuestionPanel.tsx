// src/autoppt/AutoPptQuestionPanel.tsx
import { useEffect, useState } from "react";
import type { AutopptDocRow } from "../api/autopptDocs";
import type { AutopptQuestionRow } from "../api/autopptQuestions";
import {
    listAutopptQuestionsByDocAndPage,
    createAutopptQuestion,
    deleteAutopptQuestion,
} from "../api/autopptQuestions";

export type LiveQuestionPayload = {
    id: string;
    prompt: string;
    options?: string[] | null;
    answerIndex?: number | null;
    timeLimitSec?: number | null;
};

export type AutoPptQuestionPanelProps = {
    doc: AutopptDocRow | null;
    /** 0 기반 페이지 인덱스 */
    currentPage: number;
    /** "출제" 버튼 눌렀을 때 Realtime으로 브로드캐스트하는 콜백 */
    onPresentQuestion?: (q: LiveQuestionPayload) => void;
};

export function AutoPptQuestionPanel({
                                         doc,
                                         currentPage,
                                         onPresentQuestion,
                                     }: AutoPptQuestionPanelProps) {
    const [questions, setQuestions] = useState<AutopptQuestionRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [promptInput, setPromptInput] = useState("");
    const [optionsInput, setOptionsInput] = useState("");
    const [answerIndexInput, setAnswerIndexInput] = useState<string>("");

    // 현재 문서 + 페이지 기준 문제 목록 로딩
    useEffect(() => {
        if (!doc) {
            setQuestions([]);
            return;
        }

        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(null);
            try {
                const list = await listAutopptQuestionsByDocAndPage(
                    doc.id,
                    currentPage,
                );
                if (!cancelled) {
                    setQuestions(list);
                }
            } catch (err: any) {
                console.error("[AutoPPT] load questions error", err);
                if (!cancelled) {
                    setError(
                        err?.message ?? "문제 목록을 불러오지 못했습니다.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [doc, currentPage]);

    const handleCreateQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!doc) return;
        if (!promptInput.trim()) return;

        const rawOptions = optionsInput
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
        const answerIdx = answerIndexInput.trim()
            ? Number(answerIndexInput.trim())
            : null;

        try {
            const created = await createAutopptQuestion({
                docId: doc.id,
                pageIndex: currentPage,
                prompt: promptInput.trim(),
                options: rawOptions.length > 0 ? rawOptions : undefined,
                answerIndex:
                    typeof answerIdx === "number" &&
                    !Number.isNaN(answerIdx)
                        ? answerIdx
                        : null,
            });

            setQuestions((prev) => [...prev, created]);
            setPromptInput("");
            setOptionsInput("");
            setAnswerIndexInput("");
        } catch (err) {
            // 에러는 이미 console에 찍음
        }
    };

    const handleDelete = async (q: AutopptQuestionRow) => {
        if (!window.confirm("이 문제를 삭제할까요?")) return;
        try {
            await deleteAutopptQuestion(q.id);
            setQuestions((prev) => prev.filter((x) => x.id !== q.id));
        } catch {
            // noop
        }
    };

    const handlePresentClick = (q: AutopptQuestionRow) => {
        if (!onPresentQuestion) return;
        const payload: LiveQuestionPayload = {
            id: q.id,
            prompt: q.prompt,
            options: q.options ?? undefined,
            answerIndex:
                typeof q.answer_index === "number"
                    ? q.answer_index
                    : undefined,
            timeLimitSec:
                typeof q.time_limit_sec === "number"
                    ? q.time_limit_sec
                    : undefined,
        };
        onPresentQuestion(payload);
    };

    const humanPage = currentPage + 1;

    if (!doc) {
        return (
            <div
                style={{
                    fontSize: "0.8rem",
                    color: "#9ca3af",
                }}
            >
                먼저 PDF를 업로드한 뒤, 페이지를 이동해서 문제를 등록해 주세요.
            </div>
        );
    }

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.8rem",
                }}
            >
                <div
                    style={{
                        fontWeight: 600,
                        color: "#e5e7eb",
                    }}
                >
                    {humanPage}페이지 문제
                </div>
                {loading && (
                    <div
                        style={{
                            fontSize: "0.75rem",
                            color: "#9ca3af",
                        }}
                    >
                        불러오는 중...
                    </div>
                )}
            </div>

            {error && (
                <div
                    style={{
                        fontSize: "0.75rem",
                        color: "#f97373",
                    }}
                >
                    {error}
                </div>
            )}

            {/* 기존 문제 목록 */}
            {questions.length > 0 ? (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.35rem",
                        maxHeight: 180,
                        overflowY: "auto",
                    }}
                >
                    {questions.map((q, idx) => (
                        <div
                            key={q.id}
                            style={{
                                borderRadius: 8,
                                border: "1px solid rgba(55,65,81,0.9)",
                                background:
                                    "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(31,41,55,0.98))",
                                padding: "0.4rem 0.5rem",
                                display: "flex",
                                gap: "0.5rem",
                                alignItems: "flex-start",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    color: "#9ca3af",
                                    minWidth: 18,
                                }}
                            >
                                {idx + 1}.
                            </div>
                            <div
                                style={{
                                    flex: 1,
                                    fontSize: "0.8rem",
                                }}
                            >
                                <div
                                    style={{
                                        whiteSpace: "pre-wrap",
                                        marginBottom: "0.25rem",
                                    }}
                                >
                                    {q.prompt}
                                </div>
                                {q.options && q.options.length > 0 && (
                                    <div
                                        style={{
                                            fontSize: "0.75rem",
                                            color: "#9ca3af",
                                        }}
                                    >
                                        보기 {q.options.length}개
                                        {typeof q.answer_index === "number" &&
                                            q.answer_index >= 0 &&
                                            q.answer_index <
                                            q.options.length && (
                                                <>
                                                    {" · 정답: "}
                                                    {String.fromCharCode(
                                                        65 +
                                                        q.answer_index,
                                                    )}
                                                </>
                                            )}
                                    </div>
                                )}
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.25rem",
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => handlePresentClick(q)}
                                    style={{
                                        fontSize: "0.75rem",
                                        padding:
                                            "0.2rem 0.5rem",
                                        borderRadius: 999,
                                        border: "1px solid rgba(56,189,248,0.9)",
                                        background:
                                            "linear-gradient(135deg, rgba(8,47,73,0.95), rgba(21,94,117,0.95))",
                                        color: "#e0f2fe",
                                        cursor: "pointer",
                                    }}
                                >
                                    출제
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(q)}
                                    style={{
                                        fontSize: "0.7rem",
                                        padding:
                                            "0.15rem 0.5rem",
                                        borderRadius: 999,
                                        border: "1px solid rgba(148,163,184,0.8)",
                                        background: "transparent",
                                        color: "#e5e7eb",
                                        cursor: "pointer",
                                    }}
                                >
                                    삭제
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div
                    style={{
                        fontSize: "0.75rem",
                        color: "#9ca3af",
                    }}
                >
                    아직 이 페이지에 등록된 문제가 없습니다.
                </div>
            )}

            {/* 새 문제 등록 폼 */}
            <form
                onSubmit={handleCreateQuestion}
                style={{
                    marginTop: "0.35rem",
                    borderTop: "1px solid rgba(31,41,55,0.9)",
                    paddingTop: "0.4rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                }}
            >
                <div
                    style={{
                        fontSize: "0.75rem",
                        color: "#9ca3af",
                    }}
                >
                    이 페이지에 연결할 문제 추가
                </div>
                <textarea
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="문제 내용을 입력하세요."
                    style={{
                        width: "100%",
                        minHeight: 40,
                        resize: "vertical",
                        fontSize: "0.8rem",
                        borderRadius: 8,
                        border: "1px solid rgba(55,65,81,0.9)",
                        padding: "0.35rem 0.5rem",
                        background: "rgba(15,23,42,0.9)",
                        color: "#e5e7eb",
                    }}
                />
                <textarea
                    value={optionsInput}
                    onChange={(e) => setOptionsInput(e.target.value)}
                    placeholder={"보기(선택사항)를 줄바꿈으로 입력하세요.\n예)\nwatching TV\nreading a book\ncooking\ncleaning the room"}
                    style={{
                        width: "100%",
                        minHeight: 40,
                        resize: "vertical",
                        fontSize: "0.75rem",
                        borderRadius: 8,
                        border: "1px solid rgba(55,65,81,0.9)",
                        padding: "0.35rem 0.5rem",
                        background: "rgba(15,23,42,0.9)",
                        color: "#e5e7eb",
                    }}
                />
                <div
                    style={{
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "center",
                        fontSize: "0.75rem",
                    }}
                >
                    <label
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                        }}
                    >
                        <span
                            style={{
                                color: "#9ca3af",
                            }}
                        >
                            정답 인덱스(선택):
                        </span>
                        <input
                            type="number"
                            min={0}
                            value={answerIndexInput}
                            onChange={(e) =>
                                setAnswerIndexInput(e.target.value)
                            }
                            style={{
                                width: 60,
                                fontSize: "0.75rem",
                                borderRadius: 999,
                                border: "1px solid rgba(75,85,99,0.9)",
                                padding: "0.1rem 0.4rem",
                                background:
                                    "rgba(15,23,42,0.9)",
                                color: "#e5e7eb",
                            }}
                        />
                    </label>
                    <button
                        type="submit"
                        disabled={!promptInput.trim()}
                        style={{
                            marginLeft: "auto",
                            fontSize: "0.75rem",
                            padding: "0.25rem 0.8rem",
                            borderRadius: 999,
                            border: "1px solid rgba(59,130,246,0.9)",
                            background:
                                "linear-gradient(135deg, rgba(30,64,175,0.95), rgba(37,99,235,0.95))",
                            color: "#eff6ff",
                            cursor: promptInput.trim()
                                ? "pointer"
                                : "not-allowed",
                            opacity: promptInput.trim() ? 1 : 0.6,
                        }}
                    >
                        이 페이지에 문제 추가
                    </button>
                </div>
            </form>
        </div>
    );
}
