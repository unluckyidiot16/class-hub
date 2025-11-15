// src/pages/teacher/QuizPackListPage.tsx
import type { FormEvent, ChangeEvent } from "react";
import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

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

export function QuizPackListPage() {
    const navigate = useNavigate();

    const [session, setSession] = useState<Session | null>(null);
    const [packs, setPacks] = useState<QuizPackRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [infoMsg, setInfoMsg] = useState<string | null>(null);

    // 새 팩 생성 폼
    const [title, setTitle] = useState("");
    const [subject, setSubject] = useState("");
    const [grade, setGrade] = useState("");
    const [saving, setSaving] = useState(false);

    // JSON import 상태
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            setErrorMsg(null);
            setInfoMsg(null);

            const { data, error } = await supabase.auth.getSession();
            if (error) {
                console.error("[QuizPackList] getSession error", error);
                setErrorMsg("세션을 불러오는 중 오류가 발생했습니다.");
                setLoading(false);
                return;
            }

            if (!data.session) {
                setLoading(false);
                return;
            }

            setSession(data.session);

            const { data: rows, error: packsErr } = await supabase
                .from("quiz_packs")
                .select("*")
                .eq("owner_id", data.session.user.id)
                .order("created_at", { ascending: true });

            if (packsErr) {
                console.error("[QuizPackList] load packs error", packsErr);
                setErrorMsg("퀴즈팩 목록을 불러오는 중 오류가 발생했습니다.");
                setPacks([]);
            } else {
                setPacks((rows ?? []) as QuizPackRow[]);
            }

            setLoading(false);
        };

        void init();
    }, []);

    const handleCreatePack = async (e: FormEvent) => {
        e.preventDefault();
        if (!session) return;

        const t = title.trim();
        if (!t) {
            setErrorMsg("퀴즈팩 제목을 입력해주세요.");
            return;
        }

        setSaving(true);
        setErrorMsg(null);
        setInfoMsg(null);

        try {
            const { data, error } = await supabase
                .from("quiz_packs")
                .insert({
                    owner_id: session.user.id,
                    title: t,
                    subject: subject.trim() || null,
                    grade: grade.trim() || null,
                })
                .select("*")
                .single();

            if (error) {
                console.error("[QuizPackList] create pack error", error);
                setErrorMsg("퀴즈팩 생성 중 오류가 발생했습니다.");
                return;
            }

            const pack = data as QuizPackRow;
            setPacks((prev) => [...prev, pack]);

            setTitle("");
            setSubject("");
            setGrade("");

            navigate(`/teacher/quiz-packs/${pack.id}/edit`);
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePack = async (id: string) => {
        const ok = window.confirm(
            "이 퀴즈팩을 삭제할까요? (해당 팩의 모든 문항도 함께 삭제됩니다)"
        );
        if (!ok) return;

        setErrorMsg(null);
        setInfoMsg(null);

        const { error } = await supabase
            .from("quiz_questions")
            .delete()
            .eq("pack_id", id);
        if (error) {
            console.error("[QuizPackList] delete questions error", error);
        }

        const { error: packErr } = await supabase
            .from("quiz_packs")
            .delete()
            .eq("id", id);
        if (packErr) {
            console.error("[QuizPackList] delete pack error", packErr);
            setErrorMsg("퀴즈팩 삭제 중 오류가 발생했습니다.");
            return;
        }

        setPacks((prev) => prev.filter((p) => p.id !== id));
    };

    // JSON 내보내기
    const handleExportPack = async (pack: QuizPackRow) => {
        setErrorMsg(null);
        setInfoMsg(null);

        const { data: qRows, error } = await supabase
            .from("quiz_questions")
            .select(
                "id, pack_id, index_in_pack, prompt, options, answer_index"
            )
            .eq("pack_id", pack.id)
            .order("index_in_pack", { ascending: true });

        if (error) {
            console.error("[QuizPackList] export pack error", error);
            setErrorMsg("퀴즈팩 내보내기 중 오류가 발생했습니다.");
            return;
        }

        const questions = (qRows ?? []) as any[];

        const json = {
            type: "quizpack",
            version: "v1",
            pack: {
                title: pack.title,
                subject: pack.subject,
                grade: pack.grade,
            },
            questions: questions.map((q, idx) => ({
                index:
                    typeof q.index_in_pack === "number"
                        ? q.index_in_pack
                        : idx,
                prompt: String(q.prompt ?? ""),
                options: Array.isArray(q.options) ? q.options : [],
                answerIndex:
                    typeof q.answer_index === "number" ? q.answer_index : 0,
            })),
        };

        const blob = new Blob([JSON.stringify(json, null, 2)], {
            type: "application/json",
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");

        const safeTitle =
            pack.title.replace(/[^\w가-힣\-]+/g, "_").slice(0, 40) ||
            "quizpack";
        const today = new Date().toISOString().slice(0, 10);

        a.href = url;
        a.download = `${safeTitle}.${today}.quizpack.json`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // JSON 가져오기
    const handleClickImport = () => {
        setErrorMsg(null);
        setInfoMsg(null);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (
        e: ChangeEvent<HTMLInputElement>
    ): Promise<void> => {
        const file = e.target.files?.[0];
        if (!file || !session) return;

        setImporting(true);
        setErrorMsg(null);
        setInfoMsg(null);

        try {
            const text = await file.text();
            let raw: any;
            try {
                raw = JSON.parse(text);
            } catch {
                throw new Error("JSON 형식이 올바르지 않습니다.");
            }

            if (raw.type !== "quizpack" || raw.version !== "v1") {
                throw new Error("지원하지 않는 퀴즈팩 JSON입니다.");
            }
            if (!raw.pack || !Array.isArray(raw.questions)) {
                throw new Error("pack 또는 questions 필드가 없습니다.");
            }

            const meta = raw.pack as any;
            const qs = raw.questions as any[];

            const { data: newPackRow, error: packErr } = await supabase
                .from("quiz_packs")
                .insert({
                    owner_id: session.user.id,
                    title: meta.title || "제목 없는 퀴즈팩",
                    subject: meta.subject ?? null,
                    grade: meta.grade ?? null,
                })
                .select("*")
                .single();

            if (packErr || !newPackRow) {
                console.error(
                    "[QuizPackList] import pack insert error",
                    packErr
                );
                throw new Error("퀴즈팩 생성 중 오류가 발생했습니다.");
            }

            const newPackId = (newPackRow as any).id as string;

            const questionRows = qs.map((q, idx) => ({
                pack_id: newPackId,
                index_in_pack:
                    typeof q.index === "number" ? q.index : idx,
                prompt: String(q.prompt ?? ""),
                options: Array.isArray(q.options)
                    ? q.options.map((x: any) => String(x))
                    : [],
                answer_index:
                    typeof q.answerIndex === "number" ? q.answerIndex : 0,
            }));

            if (questionRows.length > 0) {
                const { error: qErr } = await supabase
                    .from("quiz_questions")
                    .insert(questionRows);
                if (qErr) {
                    console.error(
                        "[QuizPackList] import questions insert error",
                        qErr
                    );
                    throw new Error("문항 생성 중 오류가 발생했습니다.");
                }
            }

            setPacks((prev) => [...prev, newPackRow as QuizPackRow]);
            setInfoMsg("퀴즈팩을 JSON에서 가져왔습니다.");
        } catch (err: any) {
            console.error("[QuizPackList] import error", err);
            setErrorMsg(
                err.message ?? "퀴즈팩 가져오기 중 오류가 발생했습니다."
            );
        } finally {
            setImporting(false);
            if (e.target) e.target.value = "";
        }
    };

    // 학생 개인 연습 링크 복사
    // 학생 개인 연습 링크 복사
    const handleCopyPlayLink = async (pack: QuizPackRow) => {
        setErrorMsg(null);
        setInfoMsg(null);

        try {
            const origin = window.location.origin;
            const base = import.meta.env.BASE_URL || "/"; // 예: "/class-hub/" 또는 "/"
            const normalizedBase = base.startsWith("/") ? base : `/${base}`;
            const trimmedBase = normalizedBase.replace(/\/$/, ""); // "/class-hub" 또는 ""

            // HashRouter 기준: .../class-hub/#/student/play/:id
            const url = `${origin}${trimmedBase}/#/student/play/${pack.id}`;

            await navigator.clipboard.writeText(url);
            setInfoMsg("연습/숙제용 학생 링크를 클립보드에 복사했습니다.");
        } catch (err) {
            console.error("[QuizPackList] copy link error", err);
            setErrorMsg(
                "클립보드 복사에 실패했습니다. 주소창의 URL을 직접 복사해주세요."
            );
        }
    };


    if (loading) {
        return (
            <section className="page teacher-home">
                <h1>퀴즈팩 관리</h1>
                <p className="page-desc">퀴즈팩 정보를 불러오는 중입니다...</p>
            </section>
        );
    }

    if (!session) {
        return (
            <section className="page teacher-home">
                <h1>퀴즈팩 관리</h1>
                <p className="page-desc">
                    교사 계정으로 로그인한 뒤에 퀴즈팩을 관리할 수 있습니다.
                </p>
                <p>
                    <Link to="/teacher" className="secondary-btn">
                        ← 교사 대시보드로 이동
                    </Link>
                </p>
            </section>
        );
    }

    return (
        <section className="page teacher-home">
            <h1>퀴즈팩 관리</h1>
            <p className="page-desc">
                자주 사용하는 문제 묶음을 만들어두고, 여러 반/방에서 재사용할 수
                있습니다. (지금은 4지선다 선택형만 지원)
            </p>

            <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
                <Link to="/teacher" className="secondary-btn">
                    ← 교사 대시보드로 돌아가기
                </Link>
            </p>

            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1rem",
                    alignItems: "flex-start",
                }}
            >
                {/* 새 퀴즈팩 생성 */}
                <div
                    className="card"
                    style={{ flex: "1 1 280px", minWidth: "280px" }}
                >
                    <h2>새 퀴즈팩 만들기</h2>
                    <p className="hint">
                        예: &quot;5학년 수학 1단원&quot;, &quot;영어 광고문
                        읽기&quot; 등으로 만들어두고, 나중에 여러 수업에서 재사용할
                        수 있습니다.
                    </p>

                    <form
                        onSubmit={handleCreatePack}
                        style={{ marginTop: "0.75rem" }}
                    >
                        <div className="form-field">
                            <span>제목</span>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) =>
                                    setTitle(e.target.value)
                                }
                                placeholder="예: 5학년 수학 1단원"
                            />
                        </div>

                        <div className="form-field">
                            <span>과목 (선택)</span>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) =>
                                    setSubject(e.target.value)
                                }
                                placeholder="예: 수학, 영어, 통합 등"
                            />
                        </div>

                        <div className="form-field">
                            <span>학년/설명 (선택)</span>
                            <input
                                type="text"
                                value={grade}
                                onChange={(e) =>
                                    setGrade(e.target.value)
                                }
                                placeholder="예: 5, 6, 5-6군 등"
                            />
                        </div>

                        <button
                            type="submit"
                            className="primary-btn full-width"
                            disabled={saving}
                        >
                            {saving ? "생성 중..." : "퀴즈팩 생성"}
                        </button>
                    </form>

                    {errorMsg && (
                        <p
                            className="form-message"
                            style={{ color: "var(--danger)" }}
                        >
                            {errorMsg}
                        </p>
                    )}
                    {infoMsg && (
                        <p
                            className="form-message"
                            style={{ color: "var(--accent)" }}
                        >
                            {infoMsg}
                        </p>
                    )}
                </div>

                {/* 퀴즈팩 목록 + JSON Import/Export */}
                <div
                    className="card"
                    style={{ flex: "2 1 320px", minWidth: "320px" }}
                >
                    <h2>내 퀴즈팩 목록</h2>

                    <div
                        style={{
                            marginTop: "0.5rem",
                            marginBottom: "0.5rem",
                            display: "flex",
                            gap: "0.5rem",
                            flexWrap: "wrap",
                        }}
                    >
                        <button
                            type="button"
                            className="secondary-btn"
                            onClick={handleClickImport}
                            disabled={importing}
                        >
                            {importing
                                ? "JSON에서 가져오는 중..."
                                : "JSON에서 퀴즈팩 가져오기"}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json,application/json"
                            style={{ display: "none" }}
                            onChange={handleFileChange}
                        />
                    </div>

                    {loading ? (
                        <p>불러오는 중...</p>
                    ) : packs.length === 0 ? (
                        <p style={{ marginTop: "0.75rem" }}>
                            아직 생성된 퀴즈팩이 없습니다. 왼쪽에서 첫 번째
                            퀴즈팩을 만들어보세요.
                        </p>
                    ) : (
                        <ul className="feature-list">
                            {packs.map((pack) => (
                                <li
                                    key={pack.id}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        marginBottom: "0.4rem",
                                    }}
                                >
                                    <div style={{ flex: 1 }}>
                                        <strong>{pack.title}</strong>
                                        {pack.subject && (
                                            <span
                                                style={{
                                                    marginLeft: "0.4rem",
                                                    fontSize: "0.8rem",
                                                    color: "var(--text-sub)",
                                                }}
                                            >
                                                ({pack.subject})
                                            </span>
                                        )}
                                        {pack.grade && (
                                            <span
                                                style={{
                                                    marginLeft: "0.4rem",
                                                    fontSize: "0.8rem",
                                                    color: "var(--text-sub)",
                                                }}
                                            >
                                                · {pack.grade}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        className="secondary-btn"
                                        onClick={() =>
                                            navigate(
                                                `/teacher/quiz-packs/${pack.id}/edit`
                                            )
                                        }
                                    >
                                        편집
                                    </button>
                                    <button
                                        type="button"
                                        className="secondary-btn"
                                        onClick={() =>
                                            handleCopyPlayLink(pack)
                                        }
                                    >
                                        연습 링크
                                    </button>
                                    <button
                                        type="button"
                                        className="secondary-btn"
                                        onClick={() =>
                                            handleExportPack(pack)
                                        }
                                    >
                                        JSON
                                    </button>
                                    <button
                                        type="button"
                                        className="secondary-btn"
                                        onClick={() =>
                                            handleDeletePack(pack.id)
                                        }
                                    >
                                        삭제
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </section>
    );
}
