// src/pages/student/StudentPlayPackPage.tsx
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export type QuizPackRow = {
    id: string;
    owner_id: string;
    title: string;
    subject: string | null;
    grade: string | null;
};

export type QuizQuestionRow = {
    id: string;
    pack_id: string;
    index_in_pack: number;
    prompt: string;
    options: string[] | null;
    answer_index: number | null;
};

const PLAY_NICKNAME_KEY = "classhub:play:nickname";
const PLAY_STUDENT_KEY_KEY = "classhub:play:studentKey";

function ensureStudentKey(): string {
    try {
        if (typeof window !== "undefined") {
            const existing = window.localStorage.getItem(PLAY_STUDENT_KEY_KEY);
            if (existing) return existing;
            const created = "play-" + Math.random().toString(36).slice(2);
            window.localStorage.setItem(PLAY_STUDENT_KEY_KEY, created);
            return created;
        }
    } catch {
        // ignore
    }
    return "play-" + Math.random().toString(36).slice(2);
}

export function StudentPlayPackPage() {
    const { packId } = useParams<{ packId: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    // QueryString: ?roomId=...&gameKey=...
    const searchParams = new URLSearchParams(location.search ?? "");
    const roomId = searchParams.get("roomId") || searchParams.get("room") || null;


    const [pack, setPack] = useState<QuizPackRow | null>(null);
    const [questions, setQuestions] = useState<QuizQuestionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [nickname, setNickname] = useState("");
    const [nicknameSaved, setNicknameSaved] = useState(false);
    const [showProfile, setShowProfile] = useState(false);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [scoreCorrect, setScoreCorrect] = useState(0);
    const [scoreTotal, setScoreTotal] = useState(0);
    const [finished, setFinished] = useState(false);

    useEffect(() => {
        try {
            if (typeof window !== "undefined") {
                const stored = window.localStorage.getItem(PLAY_NICKNAME_KEY);
                if (stored) {
                    setNickname(stored);
                    setNicknameSaved(true);
                    // 이미 닉네임이 있으면 기본은 닫힌 상태
                    setShowProfile(false);
                } else {
                    // 닉네임이 없다면 먼저 입력할 수 있도록 열어두기
                    setShowProfile(true);
                }
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        if (!packId) {
            setErrorMsg("유효하지 않은 퀴즈팩입니다.");
            setLoading(false);
            return;
        }

        const load = async () => {
            setLoading(true);
            setErrorMsg(null);

            // 퀴즈팩
            const { data: packRow, error: packErr } = await supabase
                .from("quiz_packs")
                .select("*")
                .eq("id", packId)
                .single();

            if (packErr || !packRow) {
                console.error("[StudentPlayPack] load pack error", packErr);
                setErrorMsg("퀴즈팩을 불러오는 중 오류가 발생했습니다.");
                setLoading(false);
                return;
            }

            setPack(packRow as QuizPackRow);

            // 문항
            const { data: qRows, error: qErr } = await supabase
                .from("quiz_questions")
                .select(
                    "id, pack_id, index_in_pack, prompt, options, answer_index"
                )
                .eq("pack_id", packId)
                .order("index_in_pack", { ascending: true });

            if (qErr) {
                console.error("[StudentPlayPack] load questions error", qErr);
                setErrorMsg("문항을 불러오는 중 오류가 발생했습니다.");
                setLoading(false);
                return;
            }

            const normalized = (qRows ?? []).map((q: any) => ({
                ...q,
                options: (q.options ?? null) as string[] | null,
                answer_index:
                    typeof q.answer_index === "number"
                        ? q.answer_index
                        : null,
            })) as QuizQuestionRow[];

            setQuestions(normalized);
            setCurrentIndex(0);
            setSelectedIndex(null);
            setIsCorrect(null);
            setScoreCorrect(0);
            setScoreTotal(0);
            setFinished(false);

            setLoading(false);
        };

        void load();
    }, [packId]);
    
    const handleSaveNickname = () => {
        const trimmed = nickname.trim();
        if (!trimmed) return;
        try {
            if (typeof window !== "undefined") {
                window.localStorage.setItem(PLAY_NICKNAME_KEY, trimmed);
            }
        } catch {
            // ignore
        }
        setNickname(trimmed);
        setNicknameSaved(true);
        // 저장 후에는 숨겨도 됨
        setShowProfile(false);
    };

    const currentQuestion =
        !loading && !finished ? questions[currentIndex] ?? null : null;

    const handleSelectOption = async (idx: number) => {
        if (!currentQuestion || finished) return;
        if (submitting) return;
        if (!nicknameSaved) return;
        if (selectedIndex != null) return; // 이미 한 번 선택했으면 막기

        setSubmitting(true);
        setSelectedIndex(idx);

        const correctIdx = currentQuestion.answer_index ?? 0;
        const correct = idx === correctIdx;
        setIsCorrect(correct);

        setScoreTotal((prev) => prev + 1);
        if (correct) setScoreCorrect((prev) => prev + 1);

        const studentKey = ensureStudentKey();

        try {
            await supabase.from("quiz_answers").insert({
                room_id: roomId,
                session_id: null,
                pack_id: pack?.id ?? packId,
                question_id: currentQuestion.id,
                student_key: studentKey,
                nickname,
                selected_index: idx,
                is_correct: correct,
            });
        } catch (e) {
            console.error("[StudentPlayPack] insert quiz_answers error", e);
            // 연습 모드라 실패해도 진행은 그대로
        } finally {
            setSubmitting(false);
        }
    };

    const handleNext = () => {
        if (!questions.length) return;
        const next = currentIndex + 1;
        if (next >= questions.length) {
            setFinished(true);
        } else {
            setCurrentIndex(next);
            setSelectedIndex(null);
            setIsCorrect(null);
        }
    };

    const handleRestart = () => {
        setCurrentIndex(0);
        setSelectedIndex(null);
        setIsCorrect(null);
        setScoreCorrect(0);
        setScoreTotal(0);
        setFinished(false);
    };

    if (loading) {
        return (
            <section className="page student-join">
                <h1>퀴즈 연습</h1>
                <p className="page-desc">퀴즈팩을 불러오는 중입니다...</p>
            </section>
        );
    }

    if (errorMsg || !pack) {
        return (
            <section className="page student-join">
                <h1>퀴즈 연습</h1>
                <p className="page-desc">
                    {errorMsg ?? "퀴즈팩 정보를 찾을 수 없습니다."}
                </p>
                <Link to="/student" className="secondary-btn">
                    ← 학생 모드 홈으로
                </Link>
            </section>
        );
    }

    const totalQuestions = questions.length;
    const progressLabel = finished
        ? `완료 (${totalQuestions}문항)`
        : `${currentIndex + 1} / ${totalQuestions || 0}`;
    const accuracy =
        scoreTotal > 0 ? Math.round((scoreCorrect / scoreTotal) * 100) : 0;
    const progressRatio =
        totalQuestions > 0
            ? finished
                ? 1
                : (currentIndex + 1) / totalQuestions
            : 0;

    return (
        <section className="page student-join">
            <h1>퀴즈 연습 모드</h1>
            <p className="page-desc">
                <strong>{pack.title}</strong> 퀴즈팩을 선생님 방과 상관없이 혼자
                연습할 수 있는 모드입니다.
            </p>

            {/* 내 정보 토글 */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginBottom: "0.5rem",
                    maxWidth: 720,
                    marginLeft: "auto",
                    marginRight: "auto",
                }}
            >
                <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setShowProfile((v) => !v)}
                    style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
                >
                    {showProfile || !nicknameSaved
                        ? "내 정보 숨기기"
                        : "내 정보 보기"}
                </button>
            </div>

            {/* 닉네임 카드: 닉네임이 없을 때는 강제 노출, 있으면 토글 */}
            {(showProfile || !nicknameSaved) && (
                <div
                    className="card"
                    style={{ maxWidth: 520, margin: "0 auto 1rem" }}
                >
                    <h2>내 정보</h2>
                    <p className="hint">
                        닉네임은 이 기기에서만 저장되며, 연습 기록을 구분하는 데
                        사용됩니다.
                    </p>
                    <div
                        style={{
                            display: "flex",
                            gap: "0.5rem",
                            marginTop: "0.5rem",
                            flexWrap: "wrap",
                        }}
                    >
                        <input
                            type="text"
                            value={nickname}
                            onChange={(e) => {
                                setNickname(e.target.value);
                                setNicknameSaved(false);
                            }}
                            placeholder="닉네임을 입력하세요"
                            className="text-input"
                            style={{ maxWidth: 220 }}
                        />
                        <button
                            type="button"
                            className="secondary-btn"
                            onClick={handleSaveNickname}
                        >
                            닉네임 저장
                        </button>
                    </div>
                    {!nicknameSaved && (
                        <p
                            className="hint"
                            style={{
                                marginTop: "0.35rem",
                                color: "#facc15",
                            }}
                        >
                            닉네임을 저장해야 퀴즈를 시작할 수 있습니다.
                        </p>
                    )}
                </div>
            )}

            {/* 진행 상황 + 진행도 바 */}
            <div
                className="card"
                style={{ maxWidth: 520, margin: "0 auto 1rem" }}
            >
                <h2>현재 진행 상황</h2>

                {totalQuestions > 0 && (
                    <div style={{ marginBottom: "0.5rem" }}>
                        <div
                            style={{
                                width: "100%",
                                height: 8,
                                borderRadius: 999,
                                background:
                                    "var(--border-subtle, #e5e7eb)",
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    width: `${Math.min(
                                        100,
                                        progressRatio * 100
                                    ).toFixed(1)}%`,
                                    height: "100%",
                                    background:
                                        "var(--accent, #22c55e)",
                                    transition: "width 0.3s ease",
                                }}
                            />
                        </div>
                    </div>
                )}

                <p>
                    문항 진행: <strong>{progressLabel}</strong>
                </p>
                <p>
                    정답 수:{" "}
                    <strong>
                        {scoreCorrect} / {scoreTotal}
                    </strong>{" "}
                    (정확도 {accuracy}%)
                </p>
            </div>

            {/* 문제 카드 */}
            <div
                className="card"
                style={{ maxWidth: 720, margin: "0 auto" }}
            >
                <h2>현재 문제</h2>

                {!totalQuestions && (
                    <p>이 퀴즈팩에는 아직 문항이 없습니다.</p>
                )}

                {finished && totalQuestions > 0 && (
                    <>
                        <p style={{ marginBottom: "0.75rem" }}>
                            모든 문제를 풀었습니다 🎉
                        </p>
                        <p>
                            최종 정답 수:{" "}
                            <strong>
                                {scoreCorrect} / {scoreTotal}
                            </strong>{" "}
                            (정확도 {accuracy}%)
                        </p>
                        <div
                            style={{
                                display: "flex",
                                gap: "0.5rem",
                                marginTop: "0.75rem",
                                flexWrap: "wrap",
                            }}
                        >
                            <button
                                type="button"
                                className="primary-btn"
                                onClick={handleRestart}
                            >
                                다시 풀기
                            </button>
                            <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => navigate("/student")}
                            >
                                학생 모드 홈으로
                            </button>
                        </div>
                    </>
                )}

                {!finished && currentQuestion && (
                    <>
                        <p
                            style={{
                                fontSize: "0.9rem",
                                marginBottom: "0.5rem",
                            }}
                        >
                            <strong>
                                Q{currentIndex + 1} / {totalQuestions || 0}
                            </strong>
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
                                            submitting ||
                                            !nicknameSaved ||
                                            selectedIndex != null ||
                                            !opt
                                        }
                                        onClick={() =>
                                            handleSelectOption(idx)
                                        }
                                        style={{ textAlign: "left" }}
                                    >
                                        <strong
                                            style={{
                                                marginRight: "0.4rem",
                                            }}
                                        >
                                            {String.fromCharCode(
                                                65 + idx
                                            )}
                                            .
                                        </strong>
                                        {opt || "(빈 보기)"}
                                    </button>
                                )
                            )}
                        </div>

                        {isCorrect === true && (
                            <p
                                style={{
                                    marginTop: "0.7rem",
                                    color: "#22c55e",
                                    fontSize: "0.9rem",
                                }}
                            >
                                정답입니다! 🎉
                            </p>
                        )}
                        {isCorrect === false && (
                            <p
                                style={{
                                    marginTop: "0.7rem",
                                    color: "#fb7185",
                                    fontSize: "0.9rem",
                                }}
                            >
                                아惜! 다음 문제에서 다시 도전해봐요.
                            </p>
                        )}

                        <div
                            style={{
                                display: "flex",
                                gap: "0.5rem",
                                marginTop: "0.75rem",
                            }}
                        >
                            <button
                                type="button"
                                className="secondary-btn"
                                onClick={handleNext}
                                disabled={!totalQuestions}
                            >
                                {currentIndex + 1 >= totalQuestions
                                    ? "결과 보기"
                                    : "다음 문제"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}
