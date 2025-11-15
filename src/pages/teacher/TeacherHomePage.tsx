// src/pages/teacher/TeacherHomePage.tsx
import { FormEvent, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

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
    const [className, setClassName] = useState("");
    const [classGrade, setClassGrade] = useState("");
    const [classSaving, setClassSaving] = useState(false);
    const [classesError, setClassesError] = useState<string | null>(null);

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

    const loadProfileAndClasses = async (user: User) => {
        setLoading(true);
        setClassesError(null);

        try {
            const prof = await ensureProfile(user);
            setProfile(prof);

            const { data: classRows, error: classError } = await supabase
                .from("classes")
                .select("*")
                .order("created_at", { ascending: true });

            if (classError) {
                console.error("[TeacherHome] load classes error", classError);
                throw classError;
            }

            setClasses((classRows ?? []) as ClassRow[]);
        } catch (err) {
            console.error(err);
            setClassesError("프로필/반 정보를 불러오는 중 오류가 발생했습니다.");
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
    const handleCreateClass = async (e: FormEvent) => {
        e.preventDefault();
        if (!profile) return;

        const name = className.trim();
        const grade = classGrade.trim();

        if (!name) {
            setClassesError("반 이름을 입력해주세요.");
            return;
        }

        setClassSaving(true);
        setClassesError(null);

        try {
            const { data, error } = await supabase
                .from("classes")
                .insert({
                    name,
                    grade: grade || null,
                    teacher_id: profile.id,
                })
                .select("*")
                .single();

            if (error) {
                console.error("[TeacherHome] create class error", error);
                setClassesError(error.message);
                return;
            }

            setClasses((prev) => [...prev, data as ClassRow]);
            setClassName("");
            setClassGrade("");
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
    return (
        <section className="page teacher-home">
            <h1>교사 대시보드</h1>
            <p className="page-desc">
                반을 만들고, 나중에 이 반 아래에 방과 퀴즈팩, 실시간 수업을 연결하게
                됩니다.
            </p>

            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1rem",
                    alignItems: "flex-start",
                }}
            >
                {/* 프로필 / 계정 정보 카드 */}
                <div className="card" style={{ minWidth: "260px", flex: "1 1 260px" }}>
                    <h2>내 계정</h2>
                    <p>
                        <strong>이메일:</strong>{" "}
                        <span>{session.user.email ?? "(이메일 없음)"}</span>
                    </p>
                    <p>
                        <strong>표시 이름:</strong>{" "}
                        <span>{profile?.display_name ?? session.user.email}</span>
                    </p>
                    <p className="hint">
                        표시 이름은 나중에 프로필 편집 기능에서 따로 수정할 수 있도록
                        확장할 수 있습니다.
                    </p>

                    <button
                        type="button"
                        className="secondary-btn"
                        style={{ marginTop: "0.75rem" }}
                        onClick={handleLogout}
                    >
                        로그아웃
                    </button>
                </div>

                {/* 반 목록 + 생성 카드 */}
                <div
                    className="card"
                    style={{ minWidth: "320px", flex: "2 1 320px" }}
                >
                    <h2>내 반 목록</h2>
                    <p className="hint">
                        예: &quot;5-1&quot;, &quot;5-2&quot;, &quot;6-1 방과후반&quot; 등으로
                        만들어두고, 이후 각 반 안에 수업용 방/퀴즈팩을 연결할 수 있습니다.
                    </p>

                    <form
                        onSubmit={handleCreateClass}
                        style={{ marginTop: "0.75rem", marginBottom: "0.75rem" }}
                    >
                        <div className="form-field">
                            <span>반 이름</span>
                            <input
                                type="text"
                                placeholder="예: 5-1, 6-2, 5-1 방과후"
                                value={className}
                                onChange={(e) => setClassName(e.target.value)}
                            />
                        </div>

                        <div className="form-field">
                            <span>학년/설명 (선택)</span>
                            <input
                                type="text"
                                placeholder="예: 5, 6, 방과후반 등"
                                value={classGrade}
                                onChange={(e) => setClassGrade(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            className="primary-btn full-width"
                            disabled={classSaving}
                        >
                            {classSaving ? "저장 중..." : "새 반 추가"}
                        </button>
                    </form>

                    {classesError && (
                        <p className="form-message" style={{ color: "var(--danger)" }}>
                            {classesError}
                        </p>
                    )}

                    <hr style={{ borderColor: "var(--border-subtle)", margin: "0.75rem 0" }} />

                    {loading ? (
                        <p>반 목록을 불러오는 중입니다...</p>
                    ) : classes.length === 0 ? (
                        <p>아직 등록된 반이 없습니다. 위 폼에서 첫 번째 반을 추가해보세요.</p>
                    ) : (
                        <ul className="feature-list">
                            {classes.map((cls) => (
                                <li key={cls.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <div style={{ flex: 1 }}>
                                        <strong>{cls.name}</strong>
                                        {cls.grade && (
                                            <span style={{ marginLeft: "0.4rem", color: "var(--text-sub)" }}>
                            ({cls.grade})
                                    </span>
                                        )}
                                    </div>
                                    <a
                                        href={`/teacher/classes/${cls.id}/rooms`}
                                        className="secondary-btn"
                                        style={{ marginRight: "0.25rem" }}
                                    >
                                        방 관리
                                    </a>
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

                {/* ... 퀴즈팩 */}

                <div className="card" style={{ marginTop: "1rem" }}>
                    <h2>퀴즈팩 관리</h2>
                    <p className="page-desc">
                        자주 사용하는 문제 묶음을 &quot;퀴즈팩&quot;으로 만들어두고,
                        나중에 여러 반/방에서 재사용할 수 있습니다.
                    </p>
                    <p>
                        <a href="/teacher/quiz-packs" className="primary-btn">
                            퀴즈팩 목록 열기
                        </a>
                    </p>
                </div>

            </div>
        </section>
    );
}
