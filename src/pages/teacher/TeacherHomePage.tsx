// src/pages/teacher/TeacherHomePage.tsx
import type { FormEvent } from "react"; 
import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { Link } from "react-router-dom";


type Profile = {
    id: string;
    display_name: string | null;
    role: string | null;
    created_at: string | null;
};

type ClassRow = {
    id: string;
    teacher_id: string;
    name: string;
    grade: string | null;
    created_at: string;
};

type QuizPackRow = {
    id: string;
    owner_id: string;
    title: string;
    subject: string | null;
    grade: string | null;
    description?: string | null;
    created_at: string;
};


export function TeacherHomePage() {
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [classes, setClasses] = useState<ClassRow[]>([]);
    const [loading, setLoading] = useState(true);

    // auth 폼 상태
    const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
    const [authEmail, setAuthEmail] = useState("");
    const [authPassword, setAuthPassword] = useState("");
    const [authError, setAuthError] = useState<string | null>(null);

    // 클래스 생성 폼 상태
    const [classSaving, setClassSaving] = useState(false);
    const [classesError, setClassesError] = useState<string | null>(null);

    const [quizPacks, setQuizPacks] = useState<QuizPackRow[]>([]);
    const [quizPackSaving, setQuizPackSaving] = useState(false);
    const [quizPacksError, setQuizPacksError] = useState<string | null>(null);

// 모달 표시 상태
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showCreateClassModal, setShowCreateClassModal] = useState(false);
    const [showCreatePackModal, setShowCreatePackModal] = useState(false);


    // =========================
    // 초기 세션 체크
    // =========================
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            const { data, error } = await supabase.auth.getSession();
            if (error) {
                console.error("[TeacherHome] getSession error", error);
                setLoading(false);
                return;
            }

            if (data.session) {
                setSession(data.session);
                const user = data.session.user;
                await loadProfileAndClasses(user);
            } else {
                setLoading(false);
            }
        };

        void init();
    }, []);

    // =========================
    // 프로필 생성/조회 + 클래스 로드
    // =========================
    const ensureProfile = async (user: User): Promise<Profile> => {
        const email = user.email ?? "";
        const { data, error } = await supabase
            .from("profiles")
            .upsert(
                {
                    id: user.id,
                    display_name: email,
                    role: "teacher",
                },
                { onConflict: "id" }
            )
            .select("*")
            .single();

        if (error) {
            console.error("[TeacherHome] ensureProfile error", error);
            throw error;
        }

        return data as Profile;
    };

    // =========================
// 프로필 생성/조회 + 클래스 / 퀴즈팩 로드
// =========================
    const loadProfileAndClasses = async (user: User) => {
        setLoading(true);
        setClassesError(null);
        setQuizPacksError(null);

        try {
            const prof = await ensureProfile(user);
            setProfile(prof);

            // 클래스 + 최근 퀴즈팩 5개를 동시에 로드
            const [
                { data: classRows, error: classError },
                { data: packRows, error: packError },
            ] = await Promise.all([
                supabase
                    .from("classes")
                    .select("*")
                    .eq("teacher_id", prof.id) // ✅ 해당 교사의 반만
                    .order("created_at", { ascending: true }),
                supabase
                    .from("quiz_packs")
                    .select("*")
                    .eq("owner_id", prof.id) // ✅ 해당 교사의 퀴즈팩만
                    .order("created_at", { ascending: false })
                    .limit(5),
            ]);

            // 반 목록 처리
            if (classError) {
                console.error("[TeacherHome] load classes error", classError);
                setClassesError("프로필/반 정보를 불러오는 중 오류가 발생했습니다.");
                setClasses([]);
            } else {
                setClasses((classRows ?? []) as ClassRow[]);
            }

            // 퀴즈팩 목록 처리
            if (packError) {
                console.error("[TeacherHome] load quiz_packs error", packError);
                setQuizPacksError("퀴즈팩 정보를 불러오는 중 오류가 발생했습니다.");
                setQuizPacks([]);
            } else {
                setQuizPacks((packRows ?? []) as QuizPackRow[]);
            }
        } catch (err) {
            console.error(err);
            setClassesError("프로필/반 정보를 불러오는 중 오류가 발생했습니다.");
            setQuizPacksError("퀴즈팩 정보를 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };


    // =========================
    // 로그인 / 회원가입 처리
    // =========================
    const handleAuthSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setAuthError(null);

        if (!authEmail.trim() || !authPassword.trim()) {
            setAuthError("이메일과 비밀번호를 모두 입력해주세요.");
            return;
        }

        try {
            if (authMode === "signin") {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: authEmail.trim(),
                    password: authPassword,
                });

                if (error) {
                    console.error("[TeacherHome] signIn error", error);
                    setAuthError(error.message);
                    return;
                }

                const user = data.user ?? data.session?.user;
                if (!user) {
                    setAuthError("로그인에 실패했습니다. 다시 시도해주세요.");
                    return;
                }

                if (!data.session) {
                    setAuthError("세션 정보가 없습니다. 다시 로그인해 주세요.");
                    return;
                }

                setSession(data.session);
                await loadProfileAndClasses(user);
            } else {
                const { data, error } = await supabase.auth.signUp({
                    email: authEmail.trim(),
                    password: authPassword,
                });

                if (error) {
                    console.error("[TeacherHome] signUp error", error);
                    setAuthError(error.message);
                    return;
                }

                const user = data.user ?? data.session?.user;

                // 이메일 인증이 켜져 있는 경우, session 없이 user만 반환될 수 있음
                if (user && !data.session) {
                    setAuthError(
                        "가입이 완료되었습니다. 이메일을 확인한 뒤 다시 로그인해 주세요."
                    );
                    return;
                }

                if (user && data.session) {
                    setSession(data.session);
                    await loadProfileAndClasses(user);
                } else {
                    setAuthError(
                        "회원가입 후 자동 로그인이 되지 않았습니다. 이메일을 확인한 뒤 다시 로그인해 주세요."
                    );
                }
            }
        } catch (err: any) {
            console.error(err);
            setAuthError("로그인/회원가입 중 알 수 없는 오류가 발생했습니다.");
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setClasses([]);
    };

    // =========================
    // 클래스 생성 / 삭제
    // =========================
    const handleCreateClass = async (
        name: string,
        grade: string
    ): Promise<ClassRow | null> => {
        if (!profile) return null;

        const trimmedName = name.trim();
        const trimmedGrade = grade.trim();

        if (!trimmedName) {
            setClassesError("반 이름을 입력해주세요.");
            return null;
        }

        setClassSaving(true);
        setClassesError(null);

        try {
            const { data, error } = await supabase
                .from("classes")
                .insert({
                    name: trimmedName,
                    grade: trimmedGrade || null,
                    teacher_id: profile.id,
                })
                .select("*")
                .single();

            if (error) {
                console.error("[TeacherHome] create class error", error);
                setClassesError(error.message);
                return null;
            }

            const created = data as ClassRow;
            setClasses((prev) => [...prev, created]);
            return created;
        } finally {
            setClassSaving(false);
        }
    };

    const handleDeleteClass = async (id: string) => {
        const ok = window.confirm(
            "이 반을 삭제할까요? (이후에 다시 되돌릴 수 없습니다)"
        );
        if (!ok) return;

        const { error } = await supabase.from("classes").delete().eq("id", id);

        if (error) {
            console.error("[TeacherHome] delete class error", error);
            setClassesError(error.message);
            return;
        }

        setClasses((prev) => prev.filter((c) => c.id !== id));
    };

    const handleCreateQuizPack = async (
        title: string,
        subject: string,
        grade: string
    ): Promise<QuizPackRow | null> => {
        if (!profile) return null;

        const t = title.trim();
        const s = subject.trim();
        const g = grade.trim();

        if (!t) {
            setQuizPacksError("퀴즈팩 제목을 입력해주세요.");
            return null;
        }

        setQuizPackSaving(true);
        setQuizPacksError(null);

        try {
            const { data, error } = await supabase
                .from("quiz_packs")
                .insert({
                    owner_id: profile.id,
                    title: t,
                    subject: s || null,
                    grade: g || null,
                })
                .select("*")
                .single();

            if (error) {
                console.error("[TeacherHome] create quiz_pack error", error);
                setQuizPacksError(error.message);
                return null;
            }

            const created = data as QuizPackRow;

            // 최근 5개 리스트 갱신
            setQuizPacks((prev) => [created, ...prev].slice(0, 5));

            return created;
        } finally {
            setQuizPackSaving(false);
        }
    };


    // =========================
    // 렌더링
    // =========================

    if (loading && !session) {
        return (
            <section className="page teacher-home">
                <h1>교사 대시보드</h1>
                <p className="page-desc">초기화 중입니다...</p>
            </section>
        );
    }

    // 아직 로그인 안 된 상태 → 로그인/회원가입 폼
    if (!session) {
        return (
            <section className="page teacher-home">
                <h1>교사 로그인</h1>
                <p className="page-desc">
                    수업용 방/반을 관리하려면 먼저 이메일 계정으로 로그인해주세요.
                </p>

                <form className="form-card" onSubmit={handleAuthSubmit}>
                    <div style={{ marginBottom: "0.75rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <button
                                type="button"
                                className={
                                    authMode === "signin" ? "primary-btn full-width" : "secondary-btn full-width"
                                }
                                onClick={() => setAuthMode("signin")}
                            >
                                로그인
                            </button>
                            <button
                                type="button"
                                className={
                                    authMode === "signup" ? "primary-btn full-width" : "secondary-btn full-width"
                                }
                                onClick={() => setAuthMode("signup")}
                            >
                                회원가입
                            </button>
                        </div>
                        <p className="hint">
                            {authMode === "signin"
                                ? "이미 계정이 있다면 이메일과 비밀번호로 로그인하세요."
                                : "처음 사용한다면 이메일과 비밀번호로 계정을 만들 수 있습니다."}
                        </p>
                    </div>

                    <label className="form-field">
                        <span>이메일</span>
                        <input
                            type="email"
                            value={authEmail}
                            onChange={(e) => setAuthEmail(e.target.value)}
                            placeholder="you@example.com"
                        />
                    </label>

                    <label className="form-field">
                        <span>비밀번호</span>
                        <input
                            type="password"
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            placeholder="8자 이상 비밀번호"
                        />
                    </label>

                    <button type="submit" className="primary-btn full-width">
                        {authMode === "signin" ? "로그인" : "회원가입"}
                    </button>

                    {authError && <p className="form-message">{authError}</p>}
                </form>

                <div className="card hint-card">
                    <h2>Phase 2에서 준비된 것</h2>
                    <ul className="feature-list">
                        <li>Supabase Auth 기반 이메일 로그인/회원가입</li>
                        <li>로그인한 계정마다 profiles 레코드 자동 생성</li>
                        <li>각 교사 계정별로 반(classes) 목록 분리</li>
                    </ul>
                </div>
            </section>
        );
    }

    // 로그인 된 상태 → 프로필 + 반 목록
    // 로그인 된 상태 → 프로필 + 반/퀴즈팩/반 목록
    return (
        <section className="page teacher-home">
            <h1>교사 대시보드</h1>
            <p className="page-desc">
                반을 만들고, 나중에 이 반 아래에 방과 퀴즈팩, 실시간 수업을 연결하게 됩니다.
            </p>

            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1rem",
                    alignItems: "flex-start",
                }}
            >
                {/* A-1: 내 계정 카드 */}
                <div className="card" style={{ minWidth: "260px", flex: "1 1 260px" }}>
                    <h2>내 계정</h2>
                    <p className="hint">
                        로그인한 교사 계정을 확인하고, 자세한 정보는 &quot;내 정보 보기&quot;에서
                        볼 수 있습니다.
                    </p>

                    <p style={{ marginTop: "0.75rem" }}>
                        <strong>이메일:</strong>{" "}
                        <span>{session.user.email ?? "(이메일 없음)"}</span>
                    </p>
                    <p>
                        <strong>표시 이름:</strong>{" "}
                        <span>{profile?.display_name ?? session.user.email}</span>
                    </p>

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
                            onClick={() => setShowProfileModal(true)}
                        >
                            내 정보 보기
                        </button>
                        <button
                            type="button"
                            className="secondary-btn"
                            onClick={handleLogout}
                        >
                            로그아웃
                        </button>
                    </div>
                </div>

                {/* A-3: 퀴즈팩 요약 카드 */}
                <div className="card" style={{ minWidth: "280px", flex: "1 1 280px" }}>
                    <h2>퀴즈팩 관리</h2>
                    <p className="page-desc">
                        자주 사용하는 문제 묶음을 &quot;퀴즈팩&quot;으로 만들어두고, 여러 반에서
                        재사용할 수 있습니다.
                    </p>

                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: "0.75rem",
                        }}
                    >
                        <p className="hint">
                            최근 <strong>{quizPacks.length}</strong>개 퀴즈팩을 불러왔습니다.
                        </p>
                        <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => setShowCreatePackModal(true)}
                        >
                            새 퀴즈팩
                        </button>
                    </div>

                    {quizPacksError && (
                        <p className="form-message" style={{ color: "var(--danger)" }}>
                            {quizPacksError}
                        </p>
                    )}

                    {quizPacks.length === 0 ? (
                        <p style={{ marginTop: "0.75rem" }} className="hint">
                            아직 만든 퀴즈팩이 없습니다. &quot;새 퀴즈팩&quot; 버튼을 눌러 첫
                            퀴즈팩을 만들어 보세요.
                        </p>
                    ) : (
                        <ul
                            style={{
                                marginTop: "0.75rem",
                                padding: 0,
                                listStyle: "none",
                                fontSize: "0.9rem",
                            }}
                        >
                            {quizPacks.map((pack) => (
                                <li
                                    key={pack.id}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        padding: "0.25rem 0",
                                    }}
                                >
                                <span>
                                    {pack.title}
                                    {pack.subject && (
                                        <span
                                            style={{
                                                color: "var(--text-sub)",
                                                marginLeft: 4,
                                            }}
                                        >
                                            · {pack.subject}
                                        </span>
                                    )}
                                </span>
                                    {pack.grade && (
                                        <span style={{ color: "var(--text-sub)" }}>
                                        {pack.grade}
                                    </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}

                    <div style={{ marginTop: "0.75rem" }}>
                        <Link to="/teacher/quiz-packs" className="primary-btn full-width">
                            퀴즈팩 목록 열기
                        </Link>
                    </div>
                </div>

                {/* A-2: 반 목록 카드 */}
                <div className="card" style={{ minWidth: "320px", flex: "1 1 320px" }}>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div>
                            <h2>내 반 목록</h2>
                            <p className="hint">
                                예: &quot;5-1&quot;, &quot;5-2&quot;, &quot;6-1 방과후반&quot; 등으로
                                만들어두고, 이후 각 반 안에 수업용 방/퀴즈팩을 연결할 수 있습니다.
                            </p>
                        </div>
                        <button
                            type="button"
                            className="primary-btn"
                            onClick={() => setShowCreateClassModal(true)}
                        >
                            + 새 반
                        </button>
                    </div>

                    {classesError && (
                        <p className="form-message" style={{ color: "var(--danger)" }}>
                            {classesError}
                        </p>
                    )}

                    <hr
                        style={{
                            borderColor: "var(--border-subtle)",
                            margin: "0.75rem 0",
                        }}
                    />

                    {loading ? (
                        <p>반 목록을 불러오는 중입니다...</p>
                    ) : classes.length === 0 ? (
                        <p>
                            아직 등록된 반이 없습니다. &quot;새 반&quot; 버튼을 눌러 첫 반을
                            추가해보세요.
                        </p>
                    ) : (
                        <ul className="feature-list">
                            {classes.map((cls) => (
                                <li
                                    key={cls.id}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <div style={{ flex: 1 }}>
                                        <strong>{cls.name}</strong>
                                        {cls.grade && (
                                            <span
                                                style={{
                                                    marginLeft: "0.4rem",
                                                    color: "var(--text-sub)",
                                                }}
                                            >
                                            ({cls.grade})
                                        </span>
                                        )}
                                    </div>
                                    <Link
                                        to={`/teacher/classes/${cls.id}/rooms`}
                                        className="secondary-btn"
                                        style={{ marginRight: "0.25rem" }}
                                    >
                                        방 관리
                                    </Link>
                                    <button
                                        type="button"
                                        className="secondary-btn"
                                        onClick={() => handleDeleteClass(cls.id)}
                                    >
                                        삭제
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* 모달들 */}
            {showProfileModal && profile && (
                <ProfileModal
                    profile={profile}
                    onClose={() => setShowProfileModal(false)}
                />
            )}

            {showCreateClassModal && (
                <CreateClassModal
                    saving={classSaving}
                    onClose={() => setShowCreateClassModal(false)}
                    onSubmit={handleCreateClass}
                />
            )}

            {showCreatePackModal && (
                <CreateQuizPackModal
                    saving={quizPackSaving}
                    onClose={() => setShowCreatePackModal(false)}
                    onSubmit={handleCreateQuizPack}
                />
            )}
        </section>
    );
}


type ProfileModalProps = {
    profile: Profile;
    onClose: () => void;
};

function ProfileModal({ profile, onClose }: ProfileModalProps) {
    return (
        <div className="modal-backdrop">
            <div className="modal-card">
                <h3>내 정보</h3>
                <p className="text-sm text-dim">
                    로그인한 교사 계정 정보를 확인할 수 있습니다.
                </p>

                <dl className="mt-4 space-y-2">
                    <div>
                        <dt className="label">표시 이름</dt>
                        <dd>{profile.display_name ?? "-"}</dd>
                    </div>
                    <div>
                        <dt className="label">역할</dt>
                        <dd>{profile.role ?? "teacher"}</dd>
                    </div>
                    <div>
                        <dt className="label">가입일</dt>
                        <dd>{profile.created_at?.slice(0, 10) ?? "-"}</dd>
                    </div>
                </dl>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        className="secondary-btn"
                        type="button"
                        onClick={onClose}
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}

type CreateClassModalProps = {
    saving: boolean;
    onClose: () => void;
    onSubmit: (name: string, grade: string) => Promise<ClassRow | null>;
};

function CreateClassModal({
                              saving,
                              onClose,
                              onSubmit,
                          }: CreateClassModalProps) {
    const [name, setName] = useState("");
    const [grade, setGrade] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        if (!name.trim()) {
            setLocalError("반 이름을 입력해주세요.");
            return;
        }

        const created = await onSubmit(name, grade);
        if (created) {
            onClose();
        }
    };

    return (
        <div className="modal-backdrop">
            <form className="modal-card" onSubmit={handleSubmit}>
                <h3>새 반 만들기</h3>
                <p className="text-sm text-dim">
                    예: &quot;5-1&quot;, &quot;6-2&quot;, &quot;5-1 방과후&quot; 등으로
                    입력하세요.
                </p>

                <label className="form-field" style={{ marginTop: "0.75rem" }}>
                    <span>반 이름</span>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="예: 5-1, 6-2 등"
                    />
                </label>

                <label className="form-field" style={{ marginTop: "0.5rem" }}>
                    <span>학년/설명 (선택)</span>
                    <input
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        placeholder="예: 5, 6, 방과후반 등"
                    />
                </label>

                {localError && (
                    <p className="form-message" style={{ color: "var(--danger)" }}>
                        {localError}
                    </p>
                )}

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        className="secondary-btn"
                        onClick={onClose}
                        disabled={saving}
                    >
                        취소
                    </button>
                    <button
                        type="submit"
                        className="primary-btn"
                        disabled={saving}
                    >
                        {saving ? "저장 중..." : "반 생성"}
                    </button>
                </div>
            </form>
        </div>
    );
}

type CreateQuizPackModalProps = {
    saving: boolean;
    onClose: () => void;
    onSubmit: (
        title: string,
        subject: string,
        grade: string
    ) => Promise<QuizPackRow | null>;
};

function CreateQuizPackModal({
                                 saving,
                                 onClose,
                                 onSubmit,
                             }: CreateQuizPackModalProps) {
    const [title, setTitle] = useState("");
    const [subject, setSubject] = useState("");
    const [grade, setGrade] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        if (!title.trim()) {
            setLocalError("퀴즈팩 제목을 입력해주세요.");
            return;
        }

        const created = await onSubmit(title, subject, grade);
        if (created) {
            onClose();
        }
    };

    return (
        <div className="modal-backdrop">
            <form className="modal-card" onSubmit={handleSubmit}>
                <h3>새 퀴즈팩 만들기</h3>
                <p className="text-sm text-dim">
                    예: &quot;5학년 수학 1단원&quot;, &quot;5학년 영어 광고문 읽기&quot; 등
                </p>

                <label className="form-field" style={{ marginTop: "0.75rem" }}>
                    <span>제목</span>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </label>

                <label className="form-field" style={{ marginTop: "0.5rem" }}>
                    <span>과목 (선택)</span>
                    <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="예: 수학, 영어, 통합 등"
                    />
                </label>

                <label className="form-field" style={{ marginTop: "0.5rem" }}>
                    <span>학년/설명 (선택)</span>
                    <input
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        placeholder="예: 5, 5-6군 등"
                    />
                </label>

                {localError && (
                    <p className="form-message" style={{ color: "var(--danger)" }}>
                        {localError}
                    </p>
                )}

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        className="secondary-btn"
                        onClick={onClose}
                        disabled={saving}
                    >
                        취소
                    </button>
                    <button
                        type="submit"
                        className="primary-btn"
                        disabled={saving}
                    >
                        {saving ? "저장 중..." : "퀴즈팩 생성"}
                    </button>
                </div>
            </form>
        </div>
    );
}
