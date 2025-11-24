// src/pages/student/StudentJoinPage.tsx
import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { ensurePlayStudentKey } from "../../utils/playStudentKey";

type RoomRow = {
    id: string;
    code: string;
    title: string;
    game_key: string;
    status: string;
    class_id: string | null;
};

export function StudentJoinPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // QR로 들어온 경우 ?code=... 에서 방 코드 자동 세팅
    const initialCode = (searchParams.get("code") ?? "").toUpperCase();
    const hasPresetCode = initialCode.length > 0;

    const [nickname, setNickname] = useState("");
    const [roomCode, setRoomCode] = useState(initialCode);
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setMessage(null);

        const nick = nickname.trim();
        const code = roomCode.trim().toUpperCase();

        if (!nick || !code) {
            setMessage("닉네임과 방 코드를 모두 입력해주세요.");
            return;
        }

        setLoading(true);

        try {
            const { data, error } = await supabase
                .from("rooms")
                .select("id, code, title, game_key, status, class_id")
                .eq("code", code)
                .maybeSingle();

            if (error) {
                console.error("[StudentJoin] find room error", error);
                setMessage("방을 찾는 중 오류가 발생했습니다.");
                return;
            }

            if (!data) {
                setMessage("해당 코드의 방을 찾을 수 없습니다. 다시 확인해주세요.");
                return;
            }

            const room = data as RoomRow;

            if (room.status === "ended") {
                setMessage("이 방은 이미 수업/게임이 종료되었습니다.");
                return;
            }

            // 반 단위 학생 키 생성 + play_students upsert
            const classId = room.class_id ?? null;
            const studentKey = ensurePlayStudentKey(classId);

            let playStudentId: string | null = null;
            if (classId) {
                const { data: ps, error: psErr } = await supabase
                    .from("play_students")
                    .upsert(
                        {
                            class_id: classId,
                            student_key: studentKey,
                            nickname: nick,
                            last_seen_at: new Date().toISOString(),
                        },
                        { onConflict: "class_id,student_key" },
                    )
                    .select("id")
                    .single();

                if (psErr) {
                    console.error("[StudentJoin] upsert play_students error", psErr);
                } else if (ps) {
                    playStudentId = (ps as { id: string }).id;
                }
            }

            try {
                if (typeof window !== "undefined") {
                    const storageKey = `classhub:room:${room.id}:nickname`;
                    window.localStorage.setItem(storageKey, nick);
                }
            } catch {
                // ignore
            }

            // state로 정보 전달 (studentKey / classId 포함)
            navigate(`/student/room/${room.id}`, {
                state: {
                    nickname: nick,
                    roomCode: room.code,
                    roomTitle: room.title,
                    gameKey: room.game_key,
                    studentKey,
                    classId,
                    playStudentId,
                },
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="page student-join">
            <h1>학생 접속</h1>
            <p className="page-desc">
                {hasPresetCode
                    ? "QR를 찍어 방 코드가 자동으로 입력되었습니다. 사용할 닉네임만 입력해 주세요."
                    : "선생님이 알려준 방 코드와 사용할 닉네임을 입력해주세요."}
            </p>

            <form className="form-card" onSubmit={handleSubmit}>
                <label className="form-field">
                    <span>닉네임</span>
                    <input
                        type="text"
                        placeholder="예: 민수, JH, Player1..."
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                    />
                </label>

                <label className="form-field">
                    <span>방 코드</span>
                    <input
                        type="text"
                        placeholder="예: ABC123"
                        value={roomCode}
                        onChange={(e) =>
                            setRoomCode(e.target.value.toUpperCase())
                        }
                        readOnly={hasPresetCode}
                    />
                    {hasPresetCode && (
                        <p className="hint">
                            QR로 받은 방 코드입니다. 선생님이 안내한 방이 맞는지만
                            확인하면 돼요.
                        </p>
                    )}
                </label>

                <button
                    type="submit"
                    className="primary-btn full-width"
                    disabled={loading}
                >
                    {loading ? "접속 중..." : "접속하기"}
                </button>

                {message && <p className="form-message">{message}</p>}
            </form>
        </section>
    );
}
