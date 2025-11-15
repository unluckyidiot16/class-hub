// src/pages/teacher/QuizPackEditorPage.tsx
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { downloadQuizPackJson } from "../../utils/quizPackExport";

type QuizPackRow = {
    id: string;
    owner_id: string;
    title: string;
    description: string | null;
    subject: string | null;
    grade: string | null;
    created_at: string;
    updated_at: string;
};

type QuizQuestionRow = {
    id: string;
    pack_id: string;
    index_in_pack: number;
    type: string;
    prompt: string;
    options: string[] | null;
    answer_index: number | null;
    answer_text: string | null;
    difficulty: number | null;
    tags: string[] | null;
    created_at: string;
    updated_at: string;
};

function emptyOptions(): string[] {
    return ["", "", "", ""];
}

export function QuizPackEditorPage() {
    const { packId } = useParams<{ packId: string }>();

    const [, setSession] = useState<Session | null>(null);
    const [pack, setPack] = useState<QuizPackRow | null>(null);
    const [questions, setQuestions] = useState<QuizQuestionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [savingMeta, setSavingMeta] = useState(false);
    const [savingQuestion, setSavingQuestion] = useState(false);

    const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
        null
    );

    // 편집용 로컬 상태
    const selectedQuestion = useMemo(
        () => questions.find((q) => q.id === selectedQuestionId) ?? null,
        [questions, selectedQuestionId]
    );

    const [editPrompt, setEditPrompt] = useState("");
    const [editOptions, setEditOptions] = useState<string[]>(emptyOptions());
    const [editAnswerIndex, setEditAnswerIndex] = useState<number>(0);
    const [editDifficulty, setEditDifficulty] = useState<number>(1);

    useEffect(() => {
        if (!packId) return;

        const init = async () => {
            setLoading(true);
            setErrorMsg(null);

            const { data, error } = await supabase.auth.getSession();
            if (error) {
                console.error("[QuizPackEditor] getSession error", error);
                setErrorMsg("세션을 불러오는 중 오류가 발생했습니다.");
                setLoading(false);
                return;
            }
            if (!data.session) {
                setErrorMsg("로그인이 필요합니다.");
                setLoading(false);
                return;
            }
            setSession(data.session);

            // 퀴즈팩 정보
            const { data: packRow, error: packErr } = await supabase
                .from("quiz_packs")
                .select("*")
                .eq("id", packId)
                .single();

            if (packErr) {
                console.error("[QuizPackEditor] load pack error", packErr);
                setErrorMsg("이 퀴즈팩 정보를 불러올 수 없습니다.");
                setLoading(false);
                return;
            }

            setPack(packRow as QuizPackRow);

            // 문항 목록
            const { data: qRows, error: qErr } = await supabase
                .from("quiz_questions")
                .select("*")
                .eq("pack_id", packId)
                .order("index_in_pack", { ascending: true });

            if (qErr) {
                console.error("[QuizPackEditor] load questions error", qErr);
                setErrorMsg("문항 목록을 불러오는 중 오류가 발생했습니다.");
                setQuestions([]);
            } else {
                const normalized = (qRows ?? []).map((q: any) => ({
                    ...q,
                    options: (q.options ?? null) as string[] | null,
                }));
                setQuestions(normalized as QuizQuestionRow[]);
                if (normalized.length > 0) {
                    setSelectedQuestionId(normalized[0].id);
                }
            }

            setLoading(false);
        };

        void init();
    }, [packId]);

    // 선택 문항이 바뀔 때 편집 상태 초기화
    useEffect(() => {
        if (!selectedQuestion) {
            setEditPrompt("");
            setEditOptions(emptyOptions());
            setEditAnswerIndex(0);
            setEditDifficulty(1);
            return;
        }

        setEditPrompt(selectedQuestion.prompt);

        const opts = (selectedQuestion.options ?? emptyOptions()).slice(0, 4);
        while (opts.length < 4) opts.push("");
        setEditOptions(opts);

        setEditAnswerIndex(
            selectedQuestion.answer_index != null ? selectedQuestion.answer_index : 0
        );
        setEditDifficulty(selectedQuestion.difficulty ?? 1);
    }, [selectedQuestion]);

    const handleSaveMeta = async (e: FormEvent) => {
        e.preventDefault();
        if (!pack) return;

        const title = (document.getElementById("pack-title-input") as HTMLInputElement)
            ?.value;
        const subject = (document.getElementById(
            "pack-subject-input"
        ) as HTMLInputElement)?.value;
        const grade = (document.getElementById(
            "pack-grade-input"
        ) as HTMLInputElement)?.value;
        const desc = (document.getElementById(
            "pack-desc-input"
        ) as HTMLTextAreaElement)?.value;

        if (!title.trim()) {
            setErrorMsg("퀴즈팩 제목을 입력해주세요.");
            return;
        }

        setSavingMeta(true);
        setErrorMsg(null);

        try {
            const { data, error } = await supabase
                .from("quiz_packs")
                .update({
                    title: title.trim(),
                    subject: subject.trim() || null,
                    grade: grade.trim() || null,
                    description: desc.trim() || null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", pack.id)
                .select("*")
                .single();

            if (error) {
                console.error("[QuizPackEditor] update pack error", error);
                setErrorMsg("퀴즈팩 정보를 저장하는 중 오류가 발생했습니다.");
                return;
            }

            setPack(data as QuizPackRow);
        } finally {
            setSavingMeta(false);
        }
    };

    const handleAddQuestion = async () => {
        if (!pack) return;

        setSavingQuestion(true);
        setErrorMsg(null);

        try {
            const index = questions.length;
            const { data, error } = await supabase
                .from("quiz_questions")
                .insert({
                    pack_id: pack.id,
                    index_in_pack: index,
                    type: "choice",
                    prompt: "",
                    options: emptyOptions(),
                    answer_index: 0,
                    difficulty: 1,
                })
                .select("*")
                .single();

            if (error) {
                console.error("[QuizPackEditor] add question error", error);
                setErrorMsg("새 문항을 추가하는 중 오류가 발생했습니다.");
                return;
            }

            const q = data as QuizQuestionRow;
            q.options = (q.options ?? emptyOptions()) as string[];

            setQuestions((prev) => [...prev, q]);
            setSelectedQuestionId(q.id);
        } finally {
            setSavingQuestion(false);
        }
    };

    const handleSaveQuestion = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedQuestion) return;

        const prompt = editPrompt.trim();
        if (!prompt) {
            setErrorMsg("문항 지문을 입력해주세요.");
            return;
        }

        const opts = editOptions.map((o) => o.trim());
        const nonEmptyOpts = opts.filter((o) => o.length > 0);
        if (nonEmptyOpts.length < 2) {
            setErrorMsg("보기는 최소 2개 이상이어야 합니다.");
            return;
        }

        let answerIndex = editAnswerIndex;
        if (answerIndex < 0 || answerIndex >= opts.length) answerIndex = 0;

        setSavingQuestion(true);
        setErrorMsg(null);

        try {
            const { data, error } = await supabase
                .from("quiz_questions")
                .update({
                    prompt,
                    options: opts,
                    answer_index: answerIndex,
                    difficulty: editDifficulty || 1,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", selectedQuestion.id)
                .select("*")
                .single();

            if (error) {
                console.error("[QuizPackEditor] update question error", error);
                setErrorMsg("문항을 저장하는 중 오류가 발생했습니다.");
                return;
            }

            const updated = data as QuizQuestionRow;
            updated.options = (updated.options ?? emptyOptions()) as string[];

            setQuestions((prev) =>
                prev.map((q) => (q.id === updated.id ? updated : q))
            );
        } finally {
            setSavingQuestion(false);
        }
    };

    const handleDeleteQuestion = async () => {
        if (!selectedQuestion) return;

        const ok = window.confirm("이 문항을 삭제할까요?");
        if (!ok) return;

        const { error } = await supabase
            .from("quiz_questions")
            .delete()
            .eq("id", selectedQuestion.id);

        if (error) {
            console.error("[QuizPackEditor] delete question error", error);
            setErrorMsg("문항 삭제 중 오류가 발생했습니다.");
            return;
        }

        setQuestions((prev) => prev.filter((q) => q.id !== selectedQuestion.id));
        setSelectedQuestionId((prevId) => {
            const remaining = questions.filter((q) => q.id !== prevId);
            return remaining.length > 0 ? remaining[0].id : null;
        });
    };

    if (!packId) {
        return (
            <section className="page teacher-home">
                <h1>퀴즈팩 편집</h1>
                <p className="page-desc">잘못된 경로입니다.</p>
                <p>
                    <Link to="/teacher/quiz-packs" className="secondary-btn">
                        ← 퀴즈팩 목록으로 돌아가기
                    </Link>
                </p>
            </section>
        );
    }

    if (loading) {
        return (
            <section className="page teacher-home">
                <h1>퀴즈팩 편집</h1>
                <p className="page-desc">데이터를 불러오는 중입니다...</p>
            </section>
        );
    }

    if (errorMsg && !pack) {
        return (
            <section className="page teacher-home">
                <h1>퀴즈팩 편집</h1>
                <p className="page-desc">{errorMsg}</p>
                <p>
                    <Link to="/teacher/quiz-packs" className="secondary-btn">
                        ← 퀴즈팩 목록으로 돌아가기
                    </Link>
                </p>
            </section>
        );
    }

    if (!pack) {
        return (
            <section className="page teacher-home">
                <h1>퀴즈팩 편집</h1>
                <p className="page-desc">퀴즈팩을 찾을 수 없습니다.</p>
                <p>
                    <Link to="/teacher/quiz-packs" className="secondary-btn">
                        ← 퀴즈팩 목록으로 돌아가기
                    </Link>
                </p>
            </section>
        );
    }

    return (
        <section className="page teacher-home">
            <h1>퀴즈팩 편집</h1>
            <p className="page-desc">
                <strong>{pack.title}</strong> 퀴즈팩의 기본 정보와 문항을 편집합니다.
            </p>

            <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
                <Link to="/teacher/quiz-packs" className="secondary-btn">
                    ← 퀴즈팩 목록으로 돌아가기
                </Link>
            </p>

            {errorMsg && (
                <p className="form-message" style={{ color: "var(--danger)" }}>
                    {errorMsg}
                </p>
            )}

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(240px, 260px) minmax(0, 1fr)",
                    gap: "1rem",
                    alignItems: "flex-start",
                }}
            >
                {/* 왼쪽: 팩 메타 + 문항 목록 */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div className="card">
                        <h2>퀴즈팩 정보</h2>
                        <form onSubmit={handleSaveMeta}>
                            <div className="form-field">
                                <span>제목</span>
                                <input
                                    id="pack-title-input"
                                    type="text"
                                    defaultValue={pack.title}
                                    placeholder="예: 5학년 수학 1단원"
                                />
                            </div>
                            <div className="form-field">
                                <span>과목 (선택)</span>
                                <input
                                    id="pack-subject-input"
                                    type="text"
                                    defaultValue={pack.subject ?? ""}
                                    placeholder="예: 수학, 영어 등"
                                />
                            </div>
                            <div className="form-field">
                                <span>학년/설명 (선택)</span>
                                <input
                                    id="pack-grade-input"
                                    type="text"
                                    defaultValue={pack.grade ?? ""}
                                    placeholder="예: 5, 6, 5-6군 등"
                                />
                            </div>
                            <div className="form-field">
                                <span>설명 (선택)</span>
                                <textarea
                                    id="pack-desc-input"
                                    defaultValue={pack.description ?? ""}
                                    placeholder="이 퀴즈팩의 용도/특징을 간단히 적어두면 좋습니다."
                                    style={{
                                        minHeight: "80px",
                                        resize: "vertical",
                                        padding: "0.5rem 0.6rem",
                                        borderRadius: "0.5rem",
                                        border: "1px solid var(--border-subtle)",
                                        background: "rgba(15, 23, 42, 0.9)",
                                        color: "var(--text-main)",
                                        fontSize: "0.9rem",
                                    }}
                                />
                            </div>

                            <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => downloadQuizPackJson(pack, questions)}
                            >
                                JSON 내보내기
                            </button>
                            
                            <button
                                type="submit"
                                className="primary-btn full-width"
                                disabled={savingMeta}
                            >
                                {savingMeta ? "저장 중..." : "퀴즈팩 정보 저장"}
                            </button>
                        </form>
                    </div>

                    <div className="card">
                        <h2>문항 목록</h2>
                        <p className="hint">
                            문항을 선택하면 오른쪽에서 내용을 편집할 수 있습니다.
                            (지금은 순서 변경 기능 없이, 생성 순서대로만 사용)
                        </p>

                        <button
                            type="button"
                            className="primary-btn full-width"
                            onClick={handleAddQuestion}
                            disabled={savingQuestion}
                        >
                            {savingQuestion ? "추가 중..." : "새 문항 추가"}
                        </button>

                        {questions.length === 0 ? (
                            <p style={{ marginTop: "0.75rem" }}>
                                아직 문항이 없습니다. 위 버튼으로 첫 번째 문항을 추가해보세요.
                            </p>
                        ) : (
                            <ul
                                className="feature-list"
                                style={{ maxHeight: "260px", overflowY: "auto", marginTop: "0.75rem" }}
                            >
                                {questions.map((q, idx) => (
                                    <li
                                        key={q.id}
                                        style={{
                                            marginBottom: "0.2rem",
                                            cursor: "pointer",
                                            padding: "0.3rem 0.4rem",
                                            borderRadius: "0.4rem",
                                            background:
                                                q.id === selectedQuestionId
                                                    ? "rgba(56, 189, 248, 0.15)"
                                                    : "transparent",
                                        }}
                                        onClick={() => setSelectedQuestionId(q.id)}
                                    >
                                        <strong>Q{idx + 1}.</strong>{" "}
                                        <span>
                      {q.prompt
                          ? q.prompt.slice(0, 32) +
                          (q.prompt.length > 32 ? "..." : "")
                          : "(지문 없음)"}
                    </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* 오른쪽: 선택된 문항 편집 */}
                <div className="card">
                    <h2>문항 편집</h2>

                    {!selectedQuestion ? (
                        <p>왼쪽에서 편집할 문항을 선택하거나 새 문항을 추가해주세요.</p>
                    ) : (
                        <form onSubmit={handleSaveQuestion}>
                            <p className="hint">
                                기본 타입은 4지선다 선택형입니다. 보기 내용과 정답만 설정하면 됩니다.
                            </p>

                            <div className="form-field">
                                <span>지문</span>
                                <textarea
                                    value={editPrompt}
                                    onChange={(e) => setEditPrompt(e.target.value)}
                                    placeholder="예: 3/4 × 2의 값은 얼마인가요?"
                                    style={{
                                        minHeight: "120px",
                                        resize: "vertical",
                                        padding: "0.5rem 0.6rem",
                                        borderRadius: "0.5rem",
                                        border: "1px solid var(--border-subtle)",
                                        background: "rgba(15, 23, 42, 0.9)",
                                        color: "var(--text-main)",
                                        fontSize: "0.9rem",
                                    }}
                                />
                            </div>

                            <div className="form-field">
                                <span>보기 및 정답</span>
                                {editOptions.map((opt, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.4rem",
                                            marginBottom: "0.2rem",
                                        }}
                                    >
                    <span
                        style={{
                            width: "1.4rem",
                            textAlign: "center",
                            fontSize: "0.85rem",
                            color: "var(--text-sub)",
                        }}
                    >
                      {String.fromCharCode(65 + idx)}.
                    </span>
                                        <input
                                            type="text"
                                            value={opt}
                                            onChange={(e) => {
                                                const next = [...editOptions];
                                                next[idx] = e.target.value;
                                                setEditOptions(next);
                                            }}
                                            placeholder={`보기 ${idx + 1}`}
                                            style={{ flex: 1 }}
                                        />
                                        <button
                                            type="button"
                                            className={
                                                editAnswerIndex === idx
                                                    ? "primary-btn"
                                                    : "secondary-btn"
                                            }
                                            onClick={() => setEditAnswerIndex(idx)}
                                        >
                                            정답
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="form-field">
                                <span>난이도 (1~5)</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={5}
                                    value={editDifficulty}
                                    onChange={(e) =>
                                        setEditDifficulty(
                                            Math.max(1, Math.min(5, Number(e.target.value) || 1))
                                        )
                                    }
                                    style={{ width: "80px" }}
                                />
                            </div>

                            <div
                                style={{
                                    display: "flex",
                                    gap: "0.5rem",
                                    marginTop: "0.5rem",
                                    alignItems: "center",
                                }}
                            >
                                <button
                                    type="submit"
                                    className="primary-btn"
                                    disabled={savingQuestion}
                                >
                                    {savingQuestion ? "저장 중..." : "문항 저장"}
                                </button>
                                <button
                                    type="button"
                                    className="secondary-btn"
                                    onClick={handleDeleteQuestion}
                                >
                                    문항 삭제
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
}
