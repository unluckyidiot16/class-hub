// src/pages/teacher/TeacherClassRoomsPage.tsx
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { buildQddUrlForPack } from "../../utils/qddLink";


type ClassRow = {
    id: string;
    teacher_id: string;
    name: string;
    grade: string | null;
    created_at: string;
};

type RoomRow = {
    id: string;
    teacher_id: string;
    class_id: string | null;
    code: string;
    title: string;
    game_key: string;
    status: string;
    quiz_pack_id: string | null;
    created_at: string;
};

type QuizPackRow = {
    id: string;
    owner_id: string;
    title: string;
    subject: string | null;
    grade: string | null;
};

const GAME_OPTIONS: { value: string; label: string }[] = [
    { value: "quiz-only", label: "퀴즈만 (실시간 수업)" },
    { value: "autoppt",  label: "AutoPPT (슬라이드 수업)" },
    { value: "linebattle", label: "라인 배틀 (계획)" },
    { value: "qdd", label: "퀴즈 다이스 디펜스" },
    { value: "pixel", label: "픽셀" },
    { value: "quizmon", label: "퀴즈몬" },
    { value: "cardbattle", label: "카드배틀" },
];

// 간단한 방 코드 생성기 (A-Z, 2-9, 6자리)
function generateRoomCode(length = 6): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 0,1,O,I 제외
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

export function TeacherClassRoomsPage() {
    const { classId } = useParams<{ classId: string }>();
    const navigate = useNavigate();

    const [session, setSession] = useState<Session | null>(null);
    const [clazz, setClazz] = useState<ClassRow | null>(null);
    const [rooms, setRooms] = useState<RoomRow[]>([]);
    const [packs, setPacks] = useState<QuizPackRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [roomTitle, setRoomTitle] = useState("");
    const [roomGameKey, setRoomGameKey] = useState("quiz-only");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!classId) return;

        const init = async () => {
            setLoading(true);
            setErrorMsg(null);

            const { data, error } = await supabase.auth.getSession();
            if (error) {
                console.error("[TeacherClassRooms] getSession error", error);
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

            try {
                // 1) 해당 클래스 가져오기
                const { data: classRow, error: classErr } = await supabase
                    .from("classes")
                    .select("*")
                    .eq("id", classId)
                    .single();

                if (classErr) {
                    console.error("[TeacherClassRooms] load class error", classErr);
                    setErrorMsg("이 반 정보를 불러올 수 없습니다.");
                    setLoading(false);
                    return;
                }

                setClazz(classRow as ClassRow);

                // 2) 이 반에 속한 방 목록
                const { data: roomRows, error: roomErr } = await supabase
                    .from("rooms")
                    .select("*")
                    .eq("class_id", classId)
                    .order("created_at", { ascending: true });

                if (roomErr) {
                    console.error("[TeacherClassRooms] load rooms error", roomErr);
                    setErrorMsg("이 반의 방 목록을 불러오는 중 오류가 발생했습니다.");
                    setRooms([]);
                } else {
                    setRooms((roomRows ?? []) as RoomRow[]);
                }

                // 3) 내 퀴즈팩 목록 (방에 연결용)
                const { data: packRows, error: packErr } = await supabase
                    .from("quiz_packs")
                    .select("id, owner_id, title, subject, grade")
                    .eq("owner_id", data.session.user.id) // ✅ 현재 교사의 퀴즈팩만
                    .order("created_at", { ascending: true });


                if (packErr) {
                    console.error("[TeacherClassRooms] load packs error", packErr);
                    // 퀴즈팩이 없어도 방 기능은 돌아가니 치명적 에러로는 안 봄
                } else {
                    setPacks((packRows ?? []) as QuizPackRow[]);
                }
            } finally {
                setLoading(false);
            }
        };

        void init();
    }, [classId]);

    const handleCreateRoom = async (e: FormEvent) => {
        e.preventDefault();
        if (!session || !clazz) return;

        const title = roomTitle.trim();
        if (!title) {
            setErrorMsg("방 이름을 입력해주세요.");
            return;
        }

        setSaving(true);
        setErrorMsg(null);

        try {
            // 코드 충돌 가능성 거의 없지만, 혹시 대비해서 몇 번 재시도
            let created: RoomRow | null = null;
            let lastErr: any = null;

            for (let attempt = 0; attempt < 3; attempt++) {
                const code = generateRoomCode(6);
                const { data, error } = await supabase
                    .from("rooms")
                    .insert({
                        title,
                        teacher_id: session.user.id,
                        class_id: clazz.id,
                        game_key: roomGameKey,
                        code,
                    })
                    .select("*")
                    .single();

                if (!error) {
                    created = data as RoomRow;
                    break;
                }

                lastErr = error;
                if ((error as any).code !== "23505") break;
            }

            if (!created) {
                console.error("[TeacherClassRooms] create room error", lastErr);
                setErrorMsg("방을 생성하는 중 오류가 발생했습니다.");
                return;
            }

            setRooms((prev) => [...prev, created!]);
            setRoomTitle("");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRoom = async (roomId: string) => {
        const ok = window.confirm("이 방을 삭제할까요? (되돌릴 수 없습니다)");
        if (!ok) return;

        const { error } = await supabase.from("rooms").delete().eq("id", roomId);
        if (error) {
            console.error("[TeacherClassRooms] delete room error", error);
            setErrorMsg("방 삭제 중 오류가 발생했습니다.");
            return;
        }
        setRooms((prev) => prev.filter((r) => r.id !== roomId));
    };

    const handleOpenQddForRoom = (room: RoomRow) => {
        if (room.game_key !== "qdd") {
            // QDD 방이 아니면 사용하지 않음
            return;
        }
        if (!room.quiz_pack_id) {
            window.alert("QDD를 사용하려면 먼저 이 방에 퀴즈팩을 연결해주세요.");
            return;
        }

        const pack = packs.find((p) => p.id === room.quiz_pack_id);
        if (!pack) {
            window.alert("연결된 퀴즈팩 정보를 찾을 수 없습니다.");
            return;
        }

        const url = buildQddUrlForPack({ id: pack.id, title: pack.title });
        if (!url) {
            window.alert(
                "QDD 링크를 만들 수 없습니다. (퀴즈팩 제목 또는 환경 변수를 확인해주세요.)"
            );
            return;
        }
        window.open(url, "_blank", "noopener,noreferrer");
    };


    const handleChangeRoomPack = async (roomId: string, packId: string | null) => {
        setErrorMsg(null);
        const { data, error } = await supabase
            .from("rooms")
            .update({ quiz_pack_id: packId })
            .eq("id", roomId)
            .select("*")
            .single();

        if (error) {
            console.error("[TeacherClassRooms] update room pack error", error);
            setErrorMsg("퀴즈팩을 연결하는 중 오류가 발생했습니다.");
            return;
        }

        const updated = data as RoomRow;
        setRooms((prev) => prev.map((r) => (r.id === roomId ? updated : r)));
    };

    const handleGoLive = (roomId: string) => {
        navigate(`/teacher/rooms/${roomId}/live`);
    };

    // 학생용 링크 (StudentPlay) 복사
    // QDD 전용 방(game_key="qdd")인 경우에는 StudentPlay에서 바로 QDD로 리다이렉트됩니다.
    // 학생용 링크 복사
    // → 항상 StudentRoomPage(/student/room/:roomId)로 보내고,
    //    방의 game_key에 따라 학생 쪽에서 퀴즈/게임을 분기 처리하는 구조로 전환한다.
    const handleCopyStudentLink = async (room: RoomRow) => {
    
        try {
            const origin = window.location.origin;
            const base = import.meta.env.BASE_URL || "/";
            const normalizedBase = base.startsWith("/") ? base : `/${base}`;
            const trimmedBase = normalizedBase.replace(/\/$/, "");

            // HashRouter 기준:
            //   .../#/student/room/:roomId
            const url = `${origin}${trimmedBase}/#/student/room/${room.id}`;

            await navigator.clipboard.writeText(url);
            window.alert("학생용 링크를 클립보드에 복사했습니다.");
        } catch (err) {
            console.error("[TeacherClassRooms] copy student link error", err);
            setErrorMsg(
                "학생용 링크를 복사하는 중 오류가 발생했습니다. 주소를 직접 공유해주세요."
            );
        }
    };


    if (!classId) {
        return (
            <section className="page teacher-home">
                <h1>방 관리</h1>
                <p className="page-desc">잘못된 경로입니다. 반 ID가 없습니다.</p>
            </section>
        );
    }

    if (loading && !clazz) {
        return (
            <section className="page teacher-home">
                <h1>방 관리</h1>
                <p className="page-desc">데이터를 불러오는 중...</p>
            </section>
        );
    }

    if (errorMsg && !clazz) {
        return (
            <section className="page teacher-home">
                <h1>방 관리</h1>
                <p className="page-desc">{errorMsg}</p>
                <p>
                    <Link to="/teacher" className="secondary-btn">
                        교사 대시보드로 돌아가기
                    </Link>
                </p>
            </section>
        );
    }

    return (
        <section className="page teacher-home">
            <h1>방 관리</h1>
            {clazz && (
                <p className="page-desc">
                    <strong>{clazz.name}</strong>
                    {clazz.grade && (
                        <span style={{ marginLeft: "0.4rem", color: "var(--text-sub)" }}>
              ({clazz.grade})
            </span>
                    )}{" "}
                    반의 수업/게임용 방을 관리합니다.
                </p>
            )}

            <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
                <Link to="/teacher" className="secondary-btn">
                    ← 반 목록으로 돌아가기
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
                {/* 방 생성 폼 */}
                <div className="card" style={{ flex: "1 1 280px", minWidth: "280px" }}>
                    <h2>새 방 만들기</h2>
                    <p className="hint">
                        방 이름은 수업/활동을 알아보기 쉽게 적어주세요. (예: &quot;1단원
                        복습 퀴즈&quot;, &quot;라인 배틀 시범&quot;)
                    </p>

                    <form onSubmit={handleCreateRoom} style={{ marginTop: "0.75rem" }}>
                        <div className="form-field">
                            <span>방 이름</span>
                            <input
                                type="text"
                                value={roomTitle}
                                onChange={(e) => setRoomTitle(e.target.value)}
                                placeholder="예: 5-1 1단원 복습 퀴즈"
                            />
                        </div>

                        <div className="form-field">
                            <span>게임 종류</span>
                            <select
                                value={roomGameKey}
                                onChange={(e) => setRoomGameKey(e.target.value)}
                                style={{
                                    padding: "0.5rem 0.6rem",
                                    borderRadius: "0.5rem",
                                    border: "1px solid var(--border-subtle)",
                                    background: "rgba(15, 23, 42, 0.9)",
                                    color: "var(--text-main)",
                                    fontSize: "0.9rem",
                                }}
                            >
                                {GAME_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="submit"
                            className="primary-btn full-width"
                            disabled={saving}
                        >
                            {saving ? "생성 중..." : "방 생성"}
                        </button>
                    </form>

                    {errorMsg && (
                        <p className="form-message" style={{ color: "var(--danger)" }}>
                            {errorMsg}
                        </p>
                    )}
                </div>

                {/* 방 목록 */}
                <div className="card" style={{ flex: "2 1 320px", minWidth: "320px" }}>
                    <h2>이 반의 방 목록</h2>
                    <p className="hint">
                        학생은 &quot;학생 모드&quot;에서 아래 방 코드로 접속할 수 있습니다.
                        퀴즈 수업을 하려면 먼저 퀴즈팩을 연결한 뒤 &quot;라이브 시작&quot;을
                        눌러주세요.
                    </p>

                    {rooms.length === 0 ? (
                        <p style={{ marginTop: "0.75rem" }}>
                            아직 생성된 방이 없습니다. 왼쪽에서 첫 번째 방을 만들어보세요.
                        </p>
                    ) : (
                        <ul className="feature-list" style={{ marginTop: "0.75rem" }}>
                            {rooms.map((room) => {
                                return (
                                    <li
                                        key={room.id}
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "0.25rem",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "0.5rem",
                                            }}
                                        >
                                            <div style={{ flex: 1 }}>
                                                <strong>{room.title}</strong>
                                                <span
                                                    style={{
                                                        marginLeft: "0.4rem",
                                                        fontSize: "0.8rem",
                                                        color: "var(--text-sub)",
                                                    }}
                                                >
                          [{room.game_key}] · 코드: {room.code}
                        </span>
                                            </div>
                                            <button
                                                type="button"
                                                className="secondary-btn"
                                                onClick={() => handleGoLive(room.id)}
                                            >
                                                라이브
                                            </button>

                                            <button
                                                type="button"
                                                className="secondary-btn"
                                                onClick={() => handleCopyStudentLink(room)}
                                            >
                                                학생 링크
                                            </button>

                                            {room.game_key === "qdd" && (
                                                <button
                                                    type="button"
                                                    className="secondary-btn"
                                                    onClick={() => handleOpenQddForRoom(room)}
                                                >
                                                    QDD 열기
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                className="secondary-btn"
                                                onClick={() => handleDeleteRoom(room.id)}
                                            >
                                                삭제
                                            </button>
                                        </div>

                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "0.5rem",
                                                fontSize: "0.85rem",
                                            }}
                                        >
                      <span style={{ color: "var(--text-sub)" }}>
                        퀴즈팩:
                      </span>
                                            <select
                                                value={room.quiz_pack_id ?? ""}
                                                onChange={(e) =>
                                                    handleChangeRoomPack(
                                                        room.id,
                                                        e.target.value || null
                                                    )
                                                }
                                                style={{
                                                    flex: 1,
                                                    padding: "0.2rem 0.4rem",
                                                    borderRadius: "0.4rem",
                                                    border: "1px solid var(--border-subtle)",
                                                    background: "rgba(15, 23, 42, 0.9)",
                                                    color: "var(--text-main)",
                                                    fontSize: "0.8rem",
                                                }}
                                            >
                                                <option value="">(연결 안 함)</option>
                                                {packs.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.title}
                                                        {p.subject ? ` / ${p.subject}` : ""}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div
                                            style={{
                                                fontSize: "0.8rem",
                                                color: "var(--text-sub)",
                                                display: "flex",
                                                justifyContent: "space-between",
                                            }}
                                        >
                                            <span>현재 상태: {room.status}</span>
                                            <span>
                        생성일:{" "}
                                                {new Date(room.created_at).toLocaleString("ko-KR")}
                      </span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </section>
    );
}
