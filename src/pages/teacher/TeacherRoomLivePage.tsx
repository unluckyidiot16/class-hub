// src/pages/teacher/TeacherRoomLivePage.tsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { QuestionStatsPanel } from "../../components/QuestionStatsPanel";
import { SessionSummaryPanel } from "../../components/SessionSummaryPanel";
import { usePresence } from "../../hooks/usePresence";
import PresenceSidebar from "../../components/PresenceSidebar";
import {ensureGameSession, endGameSession } from "../../api/gameSessions";

import { QuizMonClassPanel } from "../../games/quizmon/QuizMonClassPanel";



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

type QuizQuestionRow = {
    id: string;
    pack_id: string;
    index_in_pack: number;
    prompt: string;
    options: string[] | null;
    answer_index: number | null;
};

type QuizSessionRow = {
    id: string;
    room_id: string;
    pack_id: string;
    status: string;
    current_index: number;
    created_at: string;
    ended_at: string | null;
};

type StudentSummary = {
    student_key: string;
    nickname: string | null;
    answersCount: number;
    lastAnsweredAt: string | null;
};

type MessageTargetType = "all" | "student";

type RoomMessageRow = {
    id: string;
    room_id: string;
    session_id: string | null;
    sender_id: string | null;
    target_type: MessageTargetType;
    target_student_key: string | null;
    target_nickname: string | null;
    body: string | null;
    link_url: string | null;
    created_at: string;
};

type GameEventRow = {
    id: string;
    game_session_id: string;
    room_id: string;
    student_id: string;
    event_type: string;
    payload: any;
    created_at: string;
};

type QddQuestionStats = {
    questionId: string;
    total: number;
    correct: number;
    options: Record<number, number>; // answerIndex -> count
};

/** QDD game_events 한 줄을 누적 집계에 반영 */
/** QDD game_events 한 줄을 누적 집계에 반영 */
function applyQddEvent(
    base: Record<string, QddQuestionStats>,
    row: GameEventRow,
): Record<string, QddQuestionStats> {
    if (!row.payload) return base;

    // 1) payload를 object로 정규화 (jsonb / text 모두 대응)
    let raw = row.payload as any;
    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw);
        } catch (e) {
            console.warn("[QDD] invalid payload JSON, skip", row.payload);
            return base;
        }
    }
    const payload = raw as {
        questionId?: string;
        answerIndex?: number;
        correct?: boolean;
        // 혹시 index 기반으로 들어오면 여기에 indexInPack 같은 필드도 나중에 쓸 수 있음
    };

    // 2) event_type은 참고용만 두고, 일단 payload에 questionId가 없으면 스킵
    const t = row.event_type;
    if (
        t !== "answer" &&
        t !== "qdd-answer" &&
        t !== "CH_REPORT_ANSWER"
    ) {
        // TODO: 나중에 QDD 외 이벤트가 섞이면 여기서 더 세밀하게 필터링
        // 지금은 payload.questionId가 있으면 QDD 답안으로 취급
    }

    const qid = payload.questionId;
    if (!qid) {
        // console.debug("[QDD] skip event without questionId", { t, payload });
        return base;
    }

    const answerIndex = payload.answerIndex;
    const correct = !!payload.correct;

    const existing = base[qid] ?? {
        questionId: qid,
        total: 0,
        correct: 0,
        options: {},
    };

    const next: QddQuestionStats = {
        questionId: qid,
        total: existing.total + 1,
        correct: existing.correct + (correct ? 1 : 0),
        options: {
            ...existing.options,
            ...(typeof answerIndex === "number"
                ? {
                    [answerIndex]:
                        (existing.options[answerIndex] ?? 0) + 1,
                }
                : {}),
        },
    };

    return {
        ...base,
        [qid]: next,
    };
}


/** 초기 game_events 목록 → QDD 통계 맵 */
function buildQddStats(rows: GameEventRow[]): Record<string, QddQuestionStats> {
    console.log("[QDD] buildQddStats input count:", rows.length);
    let stats: Record<string, QddQuestionStats> = {};
    for (const row of rows) {
        stats = applyQddEvent(stats, row);
    }
    console.log("[QDD] buildQddStats keys:", Object.keys(stats));
    return stats;
}


export function TeacherRoomLivePage() {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();

    const [sessionAuth, setSessionAuth] = useState<Session | null>(null);

    const [room, setRoom] = useState<RoomRow | null>(null);
    const [pack, setPack] = useState<QuizPackRow | null>(null);
    const [questions, setQuestions] = useState<QuizQuestionRow[]>([]);
    const [session, setSession] = useState<QuizSessionRow | null>(null);

    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // ✅ 브라우저 origin + QR 모달/복사 상태
    const [appBaseUrl, setAppBaseUrl] = useState<string>("");
    const [showQrModal, setShowQrModal] = useState(false);
    const [copyMsg, setCopyMsg] = useState<string | null>(null);

    const roomCodeForPresence = room?.code ?? "";

    const { members: presenceMembers, unfocused: presenceUnfocused } =
        usePresence(roomCodeForPresence, "teacher");

    // 학생 목록 + 메시지 상태
    const [students, setStudents] = useState<StudentSummary[]>([]);
    const [messages, setMessages] = useState<RoomMessageRow[]>([]);
    const [messageBody, setMessageBody] = useState("");
    const [messageLink, setMessageLink] = useState("");
    const [sendingMessage, setSendingMessage] = useState(false);

    // 학생 상태 모달 + 개인 메시지용 상태
    const [showStudentStatusModal, setShowStudentStatusModal] = useState(false);
    const [selectedStudentForMessage, setSelectedStudentForMessage] =
        useState<StudentSummary | null>(null);
    const [personalMessageBody, setPersonalMessageBody] = useState("");
    const [personalMessageLink, setPersonalMessageLink] = useState("");
    const [sendingPersonalMessage, setSendingPersonalMessage] = useState(false);

    // 🔹 QDD용 game_events 기반 통계 (문제별 보기 분포)
    const [qddStats, setQddStats] =
        useState<Record<string, QddQuestionStats>>({});

    // QDD에서 사용하는 questionId 예시: "Eng5_9-033"
    // → prefix("Eng5_9") + 번호(033) 구조라서 prefix만 한 번 뽑아서 재사용
    const qddQuestionPrefix = useMemo(() => {
        const keys = Object.keys(qddStats);
        if (keys.length === 0) return null;

        const sample = keys[0];              // 예: "Eng5_9-033"
        const idx = sample.lastIndexOf("-");
        if (idx <= 0) return null;

        return sample.slice(0, idx);         // "Eng5_9"
    }, [qddStats]);

    // DB quiz_questions.row -> QDD questionId 문자열로 변환
    function getQddKeyForQuestion(q: QuizQuestionRow): string | null {
        if (!qddQuestionPrefix) return null;
        const n = q.index_in_pack + 1;               // 0-based → 1-based
        const suffix = String(n).padStart(3, "0");   // 1 → "001"
        return `${qddQuestionPrefix}-${suffix}`;     // "Eng5_9-001"
    }

    const qddStatsByQuestionId: Record<string, QddQuestionStats> = useMemo(
                () => {
                    if (!room) return {};
        
                    // 🧩 1) QDD: Eng5_9-033 → quiz_questions.id 로 매핑
                    if (room.game_key === "qdd") {
                        if (!qddQuestionPrefix) return {};                         
                        const out: Record<string, QddQuestionStats> = {};
                        for (const q of questions) {
                            const key = getQddKeyForQuestion(q);
                            if (!key) continue;
                            const s = qddStats[key];
                            if (s) {
                                out[q.id] = s;
                            }
                        }
                        return out;
                    }
        
                    // 🧩 2) QuizMon: payload.questionId 를 quiz_questions.id 로 사용
                    if (room.game_key === "quizmon") {
                        const out: Record<string, QddQuestionStats> = {};
                        for (const q of questions) {
                            const s = qddStats[q.id];
                            if (s) {
                                out[q.id] = s;
                            }
                        }
                        return out;
                    }
                    return {};
                },
        [room?.game_key, qddQuestionPrefix, qddStats, questions],
    );


    // 현재 퀴즈 세션과 연결된 game_sessions.id (QDD용)
    const [activeGameSessionId, setActiveGameSessionId] = useState<string | null>(null);


    // origin 한 번만 세팅
    useEffect(() => {
        if (typeof window !== "undefined") {
            const origin = window.location.origin;
            const base = import.meta.env.BASE_URL || "/"; // 예: "/class-hub/" 또는 "/"

            // 앞뒤 슬래시 정리
            const normalizedBase = base.startsWith("/") ? base : `/${base}`;
            const trimmedBase = normalizedBase.replace(/\/$/, ""); // "/class-hub" 또는 ""

            setAppBaseUrl(`${origin}${trimmedBase}`);
        }
    }, []);

    // room / session 이 이미 있는 상태에서 들어온 교사도 game_sessions.id를 얻도록
    useEffect(() => {
        // 기본 가드: 아직 로드 안 됐거나, 진행 중인 세션이 아니면 game_session도 비움
        if (!room || !pack || !session) {
            setActiveGameSessionId(null);
            return;
        }
        if (session.status !== "running") {
            setActiveGameSessionId(null);
            return;
        }

        let cancelled = false;

        const syncGameSession = async () => {
            try {
                // ensureGameSession 은 "있으면 가져오고, 없으면 생성" 형태라고 가정
                const gameSession = await ensureGameSession({
                    roomId: room.id,
                    gameId: room.game_key || "quiz-only",
                    quizPackId: pack.id,
                    quizSessionId: session.id,
                });
                if (!cancelled) {
                    setActiveGameSessionId(gameSession.id);
                }
            } catch (e) {
                console.error(
                    "[TeacherRoomLive] ensureGameSession (effect) error",
                    e,
                );
            }
        };

        void syncGameSession();

        return () => {
            cancelled = true;
        };
    }, [room?.id, room?.game_key, pack?.id, session?.id, session?.status]);


    useEffect(() => {
        if (!roomId) return;

        const init = async () => {
            setLoading(true);
            setErrorMsg(null);

            const { data, error } = await supabase.auth.getSession();
            if (error) {
                console.error("[TeacherRoomLive] getSession error", error);
                setErrorMsg("세션을 불러오는 중 오류가 발생했습니다.");
                setLoading(false);
                return;
            }
            if (!data.session) {
                setErrorMsg("로그인이 필요합니다.");
                setLoading(false);
                return;
            }

            setSessionAuth(data.session);

            // 1) 방 정보
            const { data: roomRow, error: roomErr } = await supabase
                .from("rooms")
                .select("*")
                .eq("id", roomId)
                .single();

            if (roomErr) {
                console.error("[TeacherRoomLive] load room error", roomErr);
                setErrorMsg("이 방 정보를 불러올 수 없습니다.");
                setLoading(false);
                return;
            }

            const roomData = roomRow as RoomRow;
            setRoom(roomData);

            if (!roomData.quiz_pack_id) {
                setLoading(false);
                setErrorMsg(
                    "이 방에는 아직 퀴즈팩이 연결되어 있지 않습니다. 방 관리 화면에서 먼저 퀴즈팩을 선택해주세요.",
                );
                return;
            }

            // 2) 퀴즈팩 + 문항
            const { data: packRow, error: packErr } = await supabase
                .from("quiz_packs")
                .select("*")
                .eq("id", roomData.quiz_pack_id)
                .single();

            if (packErr) {
                console.error("[TeacherRoomLive] load pack error", packErr);
                setErrorMsg(
                    "연결된 퀴즈팩을 불러오는 중 오류가 발생했습니다.",
                );
                setLoading(false);
                return;
            }

            setPack(packRow as QuizPackRow);

            const { data: qRows, error: qErr } = await supabase
                .from("quiz_questions")
                .select(
                    "id, pack_id, index_in_pack, prompt, options, answer_index",
                )
                .eq("pack_id", roomData.quiz_pack_id)
                .order("index_in_pack", { ascending: true });

            if (qErr) {
                console.error("[TeacherRoomLive] load questions error", qErr);
                setErrorMsg("퀴즈 문항을 불러오는 중 오류가 발생했습니다.");
                setLoading(false);
                return;
            }

            const normalized = (qRows ?? []).map((q: any) => ({
                ...q,
                options: (q.options ?? null) as string[] | null,
                answer_index:
                    typeof q.answer_index === "number" ? q.answer_index : null,
            })) as QuizQuestionRow[];
            setQuestions(normalized);

            // 3) 최근 세션
            const { data: sRow, error: sErr } = await supabase
                .from("quiz_sessions")
                .select("*")
                .eq("room_id", roomId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!sErr && sRow) {
                setSession(sRow as QuizSessionRow);
            }

            setLoading(false);
        };

        void init();
    }, [roomId]);

    // 현재 방/세션 기준 학생 목록 불러오기 (답안에 등장한 학생)
    useEffect(() => {
        if (!room?.id || !session?.id) {
            setStudents([]);
            return;
        }

        const loadStudents = async () => {
            const { data, error } = await supabase
                .from("quiz_answers")
                .select("student_key, nickname, created_at")
                .eq("room_id", room.id)
                .order("created_at", { ascending: true });

            if (error) {
                console.error("[TeacherRoomLive] load students error", error);
                return;
            }

            const map = new Map<string, StudentSummary>();

            for (const row of data ?? []) {
                const key = row.student_key as string;
                if (!key) continue;

                const createdAt = (row.created_at as string | null) ?? null;
                const nickname = (row.nickname as string | null) ?? null;

                const existing = map.get(key);
                if (!existing) {
                    map.set(key, {
                        student_key: key,
                        nickname,
                        answersCount: 1,
                        lastAnsweredAt: createdAt,
                    });
                } else {
                    existing.answersCount += 1;
                    if (
                        createdAt &&
                        (!existing.lastAnsweredAt ||
                            createdAt > existing.lastAnsweredAt)
                    ) {
                        existing.lastAnsweredAt = createdAt;
                    }
                }
            }

            const list = Array.from(map.values()).sort((a, b) => {
                // 최근 답변 순으로 정렬 (없으면 뒤로)
                if (!a.lastAnsweredAt && !b.lastAnsweredAt) return 0;
                if (!a.lastAnsweredAt) return 1;
                if (!b.lastAnsweredAt) return -1;
                return a.lastAnsweredAt.localeCompare(b.lastAnsweredAt) * -1;
            });

            setStudents(list);
        };

        void loadStudents();
    }, [room?.id, session?.id]);

    // 방 기준 최근 메시지 불러오기
    useEffect(() => {
        if (!room?.id) {
            setMessages([]);
            return;
        }

        const loadMessages = async () => {
            const { data, error } = await supabase
                .from("room_messages")
                .select(
                    "id, room_id, session_id, sender_id, target_type, target_student_key, target_nickname, body, link_url, created_at",
                )
                .eq("room_id", room.id)
                .order("created_at", { ascending: false })
                .limit(50);

            if (error) {
                console.error("[TeacherRoomLive] load messages error", error);
                return;
            }

            setMessages((data ?? []) as RoomMessageRow[]);
        };

        void loadMessages();
    }, [room?.id, session?.id]);

    // QDD용 game_events 로드 + Realtime 구독
    useEffect(() => {
        const isGameEventsRoom =
            room?.game_key === "qdd" || room?.game_key === "quizmon";

        if (!room?.id || !session?.id || !activeGameSessionId || !isGameEventsRoom) {
            setQddStats({});
            return;
        }

        let cancelled = false;

        const loadEvents = async () => {
            const { data, error } = await supabase
                .from("game_events")
                .select(
                    "id, game_session_id, room_id, student_id, event_type, payload, created_at",
                )
                .eq("room_id", room.id)
                .eq("game_session_id", activeGameSessionId) // ✅ game_sessions.id 기준
                .order("created_at", { ascending: true });

            if (error) {
                console.error("[TeacherRoomLive] load game_events error", error);
                return;
            }
            if (cancelled || !data) return;

            console.log(
                "[TeacherRoomLive] initial game_events rows:",
                data.length,
                data,
            );

            setQddStats(buildQddStats(data as GameEventRow[]));
        };

        void loadEvents();

        const channel = supabase
            .channel(`game_events:session:${activeGameSessionId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "game_events",
                    filter: `game_session_id=eq.${activeGameSessionId}`,
                },
                (payload) => {
                    const row = payload.new as GameEventRow;
                    console.log("[TeacherRoomLive] realtime game_event:", row);
                    setQddStats((prev) => applyQddEvent(prev, row));
                },
            )
            .subscribe((status) => {
                console.log("[TeacherRoomLive] game_events channel status:", status);
            });

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
        };
    }, [
        room?.id,
        room?.game_key,
        session?.id,          // ⬅ 추가
        activeGameSessionId,
    ]);




    // ✅ 학생 접속용 URL (QR/링크 공유용)
    // → /student?code= 로 방 코드 읽어서 닉네임 입력 → 입장 처리
    const studentJoinUrl =
        appBaseUrl && room
            ? `${appBaseUrl}/#/student?code=${encodeURIComponent(room.code)}`
            : "";

    const qrImageUrl = studentJoinUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
            studentJoinUrl,
        )}`
        : "";

    const currentQuestion =
        session && session.status === "running" && questions.length > 0
            ? questions.find((q) => q.index_in_pack === session.current_index) ??
            null
            : null;

    const totalCount = questions.length;


    const currentNumber =
        session && currentQuestion
            ? session.current_index + 1
            : session && totalCount > 0
                ? session.current_index + 1
                : 0;

    const quizMonSession =
        session
            ? {
                id: session.id,
                status: session.status as "pending" | "running" | "ended",
                current_index: session.current_index,
            }
            : null;

    const handleStartSession = async () => {
        if (!room || !pack) return;
        if (questions.length === 0) {
            setErrorMsg("이 퀴즈팩에는 아직 문항이 없습니다.");
            return;
        }

        setSaving(true);
        setErrorMsg(null);

        try {
            const { data, error } = await supabase
                .from("quiz_sessions")
                .insert({
                    room_id: room.id,
                    pack_id: pack.id,
                    status: "running",
                    current_index: 0,
                })
                .select("*")
                .single();

            if (error) {
                console.error(
                    "[TeacherRoomLive] start session error",
                    error,
                );
                setErrorMsg("퀴즈 세션을 시작하는 중 오류가 발생했습니다.");
                return;
            }

            const newSession = data as QuizSessionRow;
            setSession(newSession);

            // 방 상태도 live로 업데이트
            await supabase
                .from("rooms")
                .update({ status: "live" })
                .eq("id", room.id);

            // game_sessions에도 세션 기록 (특히 QDD용)
            const gameSession = await ensureGameSession({
                roomId: room.id,
                gameId: room.game_key || "quiz-only",
                quizPackId: pack.id,
                quizSessionId: newSession.id,
            });
            setActiveGameSessionId(gameSession.id);

        } finally {
            setSaving(false);
        }
    };

    const handleMoveQuestion = async (delta: number) => {
        if (!session || !room) return;
        if (questions.length === 0) return;

        const nextIndex = Math.max(
            0,
            Math.min(totalCount - 1, session.current_index + delta),
        );

        setSaving(true);
        setErrorMsg(null);

        try {
            const { data, error } = await supabase
                .from("quiz_sessions")
                .update({ current_index: nextIndex })
                .eq("id", session.id)
                .select("*")
                .single();

            if (error) {
                console.error(
                    "[TeacherRoomLive] move question error",
                    error,
                );
                setErrorMsg("문제를 변경하는 중 오류가 발생했습니다.");
                return;
            }

            setSession(data as QuizSessionRow);
        } finally {
            setSaving(false);
        }
    };

    const handleEndSession = async () => {
        if (!session || !room) return;

        const ok = window.confirm("이 퀴즈 세션을 종료할까요?");
        if (!ok) return;

        setSaving(true);
        setErrorMsg(null);

        try {
            const { data, error } = await supabase
                .from("quiz_sessions")
                .update({
                    status: "ended",
                    ended_at: new Date().toISOString(),
                })
                .eq("id", session.id)
                .select("*")
                .single();

            if (error) {
                console.error("[TeacherRoomLive] end session error", error);
                setErrorMsg("세션을 종료하는 중 오류가 발생했습니다.");
                return;
            }

            const endedSession = data as QuizSessionRow;
            setSession(endedSession);

            await supabase
                .from("rooms")
                .update({ status: "waiting" })
                .eq("id", room.id);

            // game_sessions 쪽도 finished로 정리 (별도 game_session_id 사용)
            if (activeGameSessionId) {
                await endGameSession({ sessionId: activeGameSessionId });
            }

        } finally {
            setSaving(false);
        }
    };

    // ✅ 전체 학생에게 메시지/링크 보내기
    const handleSendMessage = async (e?: any) => {
        if (e) e.preventDefault();
        if (!room) return;

        const trimmedBody = messageBody.trim();
        const trimmedLink = messageLink.trim();

        if (!trimmedBody && !trimmedLink) {
            setErrorMsg("보낼 내용이나 링크를 입력해주세요.");
            return;
        }

        setSendingMessage(true);
        setErrorMsg(null);

        try {
            const payload = {
                room_id: room.id,
                session_id: session?.id ?? null,
                sender_id: sessionAuth?.user.id ?? null,
                target_type: "all" as MessageTargetType,
                target_student_key: null,
                target_nickname: null,
                body: trimmedBody || null,
                link_url: trimmedLink || null,
            };

            const { data, error } = await supabase
                .from("room_messages")
                .insert(payload)
                .select("*")
                .single();

            if (error) {
                console.error(
                    "[TeacherRoomLive] send message error",
                    error,
                );
                setErrorMsg("메시지를 보내는 중 오류가 발생했습니다.");
                return;
            }

            const newMsg = data as RoomMessageRow;
            setMessages((prev) => [newMsg, ...prev].slice(0, 50));
            setMessageBody("");
            // 링크는 연속 사용 가능하게 그대로 두고 싶으면 주석 유지
            // setMessageLink("");
        } finally {
            setSendingMessage(false);
        }
    };

    // ✅ 학생 상태 모달 열기
    const handleOpenStudentStatusModal = () => {
        if (students.length > 0) {
            setSelectedStudentForMessage(students[0]);
        } else {
            setSelectedStudentForMessage(null);
        }
        setShowStudentStatusModal(true);
    };

    // ✅ 개별 학생에게 메시지 보내기
    const handleSendPersonalMessage = async (e?: any) => {
        if (e) e.preventDefault();
        if (!room || !selectedStudentForMessage) return;

        const trimmedBody = personalMessageBody.trim();
        const trimmedLink = personalMessageLink.trim();

        if (!trimmedBody && !trimmedLink) {
            setErrorMsg("보낼 내용이나 링크를 입력해주세요.");
            return;
        }

        setSendingPersonalMessage(true);
        setErrorMsg(null);

        try {
            const payload = {
                room_id: room.id,
                session_id: session?.id ?? null,
                sender_id: sessionAuth?.user.id ?? null,
                target_type: "student" as MessageTargetType,
                target_student_key: selectedStudentForMessage.student_key,
                target_nickname: selectedStudentForMessage.nickname,
                body: trimmedBody || null,
                link_url: trimmedLink || null,
            };

            const { data, error } = await supabase
                .from("room_messages")
                .insert(payload)
                .select("*")
                .single();

            if (error) {
                console.error(
                    "[TeacherRoomLive] send personal message error",
                    error,
                );
                setErrorMsg("개인 메시지를 보내는 중 오류가 발생했습니다.");
                return;
            }

            const newMsg = data as RoomMessageRow;
            setMessages((prev) => [newMsg, ...prev].slice(0, 50));

            // 입력창 초기화
            setPersonalMessageBody("");
            setPersonalMessageLink("");
        } finally {
            setSendingPersonalMessage(false);
        }
    };

    // ✅ 학생 링크 복사
    const handleCopyStudentLink = async () => {
        if (!studentJoinUrl) return;
        try {
            await navigator.clipboard.writeText(studentJoinUrl);
            setCopyMsg("링크가 복사되었습니다.");
            setTimeout(() => setCopyMsg(null), 2000);
        } catch (err) {
            console.error("[TeacherRoomLive] copy link error", err);
            setErrorMsg(
                "링크를 복사하는 중 문제가 발생했습니다. 직접 선택해서 복사해주세요.",
            );
        }
    };

    // ✅ QR 모달 열기
    const handleOpenQrModal = () => {
        if (!studentJoinUrl) return;
        setShowQrModal(true);
    };

    // ✅ QR만 새 창으로 열기 (빔프로젝터용)
    const handleOpenQrWindow = () => {
        if (!studentJoinUrl) return;
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(
            studentJoinUrl,
        )}`;
        window.open(url, "_blank", "noopener,noreferrer");
    };

    if (!roomId) {
        return (
            <section className="page teacher-home">
                <h1>라이브 퀴즈</h1>
                <p className="page-desc">잘못된 경로입니다.</p>
            </section>
        );
    }

    if (loading) {
        return (
            <section className="page teacher-home">
                <h1>라이브 퀴즈</h1>
                <p className="page-desc">데이터를 불러오는 중입니다...</p>
            </section>
        );
    }

    if (!room || !pack) {
        return (
            <section className="page teacher-home">
                <h1>라이브 퀴즈</h1>
                <p className="page-desc">
                    {errorMsg ??
                        "방 또는 퀴즈팩 정보를 불러올 수 없습니다. 다시 시도하거나 방 관리 화면을 확인해주세요."}
                </p>
                <p>
                    <Link
                        to={`/teacher/classes/${room?.class_id ?? ""}/rooms`}
                        className="secondary-btn"
                    >
                        ← 방 관리로 돌아가기
                    </Link>
                </p>
            </section>
        );
    }

    return (
        <section className="page teacher-home">
            {room && (
                <PresenceSidebar
                    members={presenceMembers}
                    unfocused={presenceUnfocused}
                    // 위치는 필요하면 조절 가능 (기본값 써도 됨)
                    top={84}
                    right={16}
                    width={260}
                />
            )}
            <h1>라이브 퀴즈 컨트롤</h1>
            <p className="page-desc">
                <strong>{room.title}</strong> (코드: {room.code}) 방에서{" "}
                <strong>{pack.title}</strong> 퀴즈팩을 사용해 실시간 퀴즈를
                진행합니다.
            </p>

            <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
                <button
                    type="button"
                    className="secondary-btn"
                    onClick={() =>
                        navigate(`/teacher/classes/${room.class_id}/rooms`)
                    }
                >
                    ← 방 관리로 돌아가기
                </button>
            </p>

            {errorMsg && (
                <p
                    className="form-message"
                    style={{ color: "var(--danger)" }}
                >
                    {errorMsg}
                </p>
            )}

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns:
                        "minmax(260px, 280px) minmax(0, 1fr)",
                    gap: "1rem",
                    alignItems: "flex-start",
                }}
            >
                {/* 왼쪽: 세션 상태 + 학생 접속 링크/QR + 메시지 */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                    }}
                >
                    <div className="card">
                        <h2>세션 상태</h2>
                        <p>
                            <strong>방 코드:</strong> {room.code}
                        </p>
                        <p>
                            <strong>퀴즈팩:</strong> {pack.title}
                        </p>
                        <p className="hint">
                            학생은 학생 모드 / 방 코드 화면에서 이 방 코드(
                            {room.code})를 입력하면 현재 진행 중인 문제를 볼 수
                            있습니다.
                        </p>

                        {/* ✅ 학생 접속 링크 / QR */}
                        {studentJoinUrl && (
                            <div style={{ marginTop: "0.75rem" }}>
                                <h3
                                    style={{
                                        fontSize: "0.95rem",
                                        marginBottom: "0.25rem",
                                    }}
                                >
                                    학생 접속 링크 / QR
                                </h3>
                                <p
                                    className="hint"
                                    style={{
                                        marginBottom: "0.25rem",
                                    }}
                                >
                                    이 링크를 공유하거나, 아래 버튼으로 QR 코드를
                                    띄워 학생들이 바로 접속하도록 안내하세요.
                                </p>
                                <div
                                    style={{
                                        display: "flex",
                                        gap: "0.5rem",
                                        alignItems: "center",
                                        marginBottom: "0.5rem",
                                    }}
                                >
                                    <input
                                        type="text"
                                        readOnly
                                        value={studentJoinUrl}
                                        style={{
                                            flex: 1,
                                            fontSize: "0.8rem",
                                            padding: "0.25rem 0.4rem",
                                        }}
                                        onFocus={(e) => e.target.select()}
                                    />
                                    <button
                                        type="button"
                                        className="secondary-btn"
                                        onClick={handleCopyStudentLink}
                                    >
                                        링크 복사
                                    </button>
                                </div>
                                {copyMsg && (
                                    <p
                                        className="hint"
                                        style={{
                                            marginBottom: "0.5rem",
                                        }}
                                    >
                                        {copyMsg}
                                    </p>
                                )}
                                <div
                                    style={{
                                        display: "flex",
                                        gap: "0.5rem",
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <button
                                        type="button"
                                        className="secondary-btn"
                                        onClick={handleOpenQrModal}
                                    >
                                        QR 모달 열기
                                    </button>
                                    <button
                                        type="button"
                                        className="secondary-btn"
                                        onClick={handleOpenQrWindow}
                                    >
                                        QR 새 창 열기
                                    </button>
                                </div>

                                <hr
                                    style={{
                                        borderColor: "var(--border-subtle)",
                                        margin: "0.75rem 0",
                                    }}
                                />
                            </div>
                        )}

                        {!studentJoinUrl && (
                            <hr
                                style={{
                                    borderColor: "var(--border-subtle)",
                                    margin: "0.75rem 0",
                                }}
                            />
                        )}

                        {session ? (
                            <>
                                <p>
                                    현재 세션 상태:{" "}
                                    <strong>
                                        {session.status === "running"
                                            ? "진행 중"
                                            : "종료됨"}
                                    </strong>
                                </p>
                                <p>
                                    문제 진행:{" "}
                                    <strong>
                                        {currentNumber} / {totalCount || 0}
                                    </strong>
                                </p>

                                {session.status === "running" ? (
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
                                            className="secondary-btn"
                                            disabled={
                                                saving ||
                                                session.current_index <= 0
                                            }
                                            onClick={() =>
                                                handleMoveQuestion(-1)
                                            }
                                        >
                                            이전 문제
                                        </button>
                                        <button
                                            type="button"
                                            className="secondary-btn"
                                            disabled={
                                                saving ||
                                                session.current_index >=
                                                totalCount - 1
                                            }
                                            onClick={() =>
                                                handleMoveQuestion(1)
                                            }
                                        >
                                            다음 문제
                                        </button>
                                        <button
                                            type="button"
                                            className="secondary-btn"
                                            disabled={saving}
                                            onClick={handleEndSession}
                                        >
                                            세션 종료
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        className="primary-btn"
                                        disabled={saving}
                                        onClick={handleStartSession}
                                        style={{
                                            marginTop: "0.75rem",
                                        }}
                                    >
                                        새 세션 다시 시작
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <p>
                                    현재 이 방에서 진행 중인 세션이 없습니다.
                                </p>
                                <button
                                    type="button"
                                    className="primary-btn"
                                    disabled={saving || totalCount === 0}
                                    onClick={handleStartSession}
                                    style={{ marginTop: "0.75rem" }}
                                >
                                    새 퀴즈 세션 시작
                                </button>
                                {totalCount === 0 && (
                                    <p
                                        className="hint"
                                        style={{
                                            marginTop: "0.5rem",
                                        }}
                                    >
                                        이 퀴즈팩에는 아직 문항이 없습니다.
                                        퀴즈팩 에디터에서 문제를 먼저
                                        추가해주세요.
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    {/* 학생 메시지 / 링크 카드 */}
                    <div className="card">
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "0.5rem",
                            }}
                        >
                            <h2 style={{ marginBottom: 0 }}>
                                학생 메시지 / 링크 보내기
                            </h2>
                            <button
                                type="button"
                                className="secondary-btn"
                                onClick={handleOpenStudentStatusModal}
                            >
                                학생 상태 보기
                            </button>
                        </div>

                        <form
                            onSubmit={handleSendMessage}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.5rem",
                                marginTop: "0.5rem",
                            }}
                        >
                            <label className="form-field">
                                <span>대상</span>
                                <div style={{ fontSize: "0.9rem" }}>
                                    전체 학생에게 보내기
                                    <div
                                        className="hint"
                                        style={{
                                            fontSize: "0.8rem",
                                            marginTop: "0.15rem",
                                        }}
                                    >
                                        개별 학생에게는 위의{" "}
                                        <strong>학생 상태 보기</strong> 버튼을
                                        눌러 모달에서 선택 후 메시지를 보낼 수
                                        있습니다.
                                    </div>
                                </div>
                            </label>

                            <label className="form-field">
                                <span>메시지 내용</span>
                                <textarea
                                    rows={2}
                                    value={messageBody}
                                    onChange={(e) =>
                                        setMessageBody(e.target.value)
                                    }
                                    placeholder="예: 잠시 후 새 방으로 이동합니다."
                                />
                            </label>

                            <label className="form-field">
                                <span>링크 (선택)</span>
                                <input
                                    type="url"
                                    value={messageLink}
                                    onChange={(e) =>
                                        setMessageLink(e.target.value)
                                    }
                                    placeholder="예: https://... 또는 /student?code=..."
                                />
                            </label>

                            <button
                                type="submit"
                                className="primary-btn"
                                disabled={sendingMessage}
                            >
                                {sendingMessage
                                    ? "보내는 중..."
                                    : "학생에게 보내기"}
                            </button>
                        </form>

                        {messages.length > 0 && (
                            <div style={{ marginTop: "0.75rem" }}>
                                <h3
                                    style={{
                                        fontSize: "0.9rem",
                                        marginBottom: "0.35rem",
                                    }}
                                >
                                    최근 보낸 메시지
                                </h3>
                                <ul
                                    style={{
                                        listStyle: "none",
                                        padding: 0,
                                        margin: 0,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "0.25rem",
                                    }}
                                >
                                    {messages.slice(0, 5).map((m) => (
                                        <li
                                            key={m.id}
                                            style={{
                                                fontSize: "0.85rem",
                                                borderTop:
                                                    "1px solid var(--border-subtle)",
                                                paddingTop: "0.25rem",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent:
                                                        "space-between",
                                                    gap: "0.5rem",
                                                }}
                                            >
                                                <span>
                                                    {m.target_type === "all"
                                                        ? "전체"
                                                        : m.target_nickname ??
                                                        "개인"}
                                                </span>
                                                <span
                                                    style={{
                                                        color: "var(--text-sub)",
                                                    }}
                                                >
                                                    {new Date(
                                                        m.created_at,
                                                    ).toLocaleTimeString([], {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </span>
                                            </div>
                                            {m.body && (
                                                <div>{m.body}</div>
                                            )}
                                            {m.link_url && (
                                                <div
                                                    style={{
                                                        fontSize: "0.8rem",
                                                        color: "var(--accent)",
                                                    }}
                                                >
                                                    링크: {m.link_url}
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                {/* 오른쪽: 현재 문제 미리보기 + 통계 */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                    }}
                >
                    <div className="card">
                        <h2>현재 문제 (학생 화면 미리보기)</h2>

                        {!session || session.status !== "running" ? (
                            <p>
                                진행 중인 세션이 없습니다. 왼쪽에서 세션을
                                시작해주세요.
                            </p>
                        ) : !currentQuestion ? (
                            <p>
                                현재 인덱스에 해당하는 문항을 찾을 수 없습니다.
                                (문항 삭제 후 재정렬이 필요할 수 있습니다)
                            </p>
                        ) : (
                            <>
                                <p
                                    style={{
                                        marginBottom: "0.5rem",
                                        fontSize: "0.9rem",
                                    }}
                                >
                                    <strong>
                                        Q{currentNumber} / {totalCount}
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

                                <ul className="feature-list">
                                    {(currentQuestion.options ?? []).map(
                                        (opt, idx) => (
                                            <li key={idx}>
                                                <strong>
                                                    {String.fromCharCode(
                                                        65 + idx,
                                                    )}
                                                    .
                                                </strong>{" "}
                                                <span>{opt}</span>
                                                {currentQuestion.answer_index ===
                                                    idx && (
                                                        <span
                                                            style={{
                                                                marginLeft:
                                                                    "0.4rem",
                                                                fontSize:
                                                                    "0.8rem",
                                                                color: "var(--accent)",
                                                            }}
                                                        >
                                                        (정답)
                                                    </span>
                                                    )}
                                            </li>
                                        ),
                                    )}
                                </ul>

                                <p
                                    className="hint"
                                    style={{
                                        marginTop: "0.75rem",
                                    }}
                                >
                                    지금은 학생 화면에서 개별 정답 여부를
                                    보여주지 않고, 교사가 답을 공개하거나
                                    설명하는 방식으로 사용하는 단계입니다.
                                    (나중에 정답 공개/리더보드도 붙일 수 있음)
                                </p>
                            </>
                        )}
                    </div>

                    {/* ✅ 일반 퀴즈 방에서만 quiz_answers 기반 통계 표시 */}
                    {room.game_key !== "qdd" &&
                        session &&
                        session.status === "running" &&
                        currentQuestion && (
                            <div className="card">
                                <QuestionStatsPanel
                                    sessionId={session.id}
                                    questionId={currentQuestion.id}
                                    options={currentQuestion.options ?? []}
                                    correctIndex={currentQuestion.answer_index ?? -1}
                                />
                            </div>
                        )}

                    {/* QDD / QuizMon 방일 때 game_events 기반 실시간 통계 */}
                    {(room.game_key === "qdd" ||
                            room.game_key === "quizmon") &&
                        session &&
                        session.status === "running" &&
                        currentQuestion && (
                            <div className="card">
                                <h2>QDD 실시간 통계 (game_events)</h2>
                                {(() => {
                                    let stats: QddQuestionStats | undefined;
                                    if (room.game_key === "qdd") {
                                        const key =
                                            getQddKeyForQuestion(
                                                currentQuestion,
                                            );
                                        stats = key ? qddStats[key] : undefined;
                                    } else if (room.game_key === "quizmon") {
                                        // QuizMon 은 payload.questionId = quiz_questions.id 기준
                                        stats = qddStats[currentQuestion.id];
                                    }

                                    if (!stats) {
                                        return (
                                            <p className="hint">
                                                아직 이 문제에 대한 QDD 응답이 없습니다.
                                            </p>
                                        );
                                    }

                                    const accuracy =
                                        stats.total > 0
                                            ? Math.round((stats.correct / stats.total) * 100)
                                            : 0;

                                    return (
                                        <>
                                            <p
                                                style={{
                                                    marginBottom: "0.5rem",
                                                    fontSize: "0.9rem",
                                                }}
                                            >
                                                응답 수:{" "}
                                                <strong>
                                                    {stats.total}명
                                                </strong>{" "}
                                                / 정답:{" "}
                                                <strong>
                                                    {stats.correct}명
                                                </strong>{" "}
                                                (정답률 {accuracy}
                                                %)
                                            </p>
                                            <ul className="feature-list">
                                                {(currentQuestion.options ??
                                                    []).map(
                                                    (opt, idx) => {
                                                        const count =
                                                            stats.options[
                                                                idx
                                                                ] ?? 0;
                                                        return (
                                                            <li key={idx}>
                                                                <strong>
                                                                    {String.fromCharCode(
                                                                        65 +
                                                                        idx,
                                                                    )}
                                                                    .
                                                                </strong>{" "}
                                                                <span>
                                                                    {opt ??
                                                                        "(빈 보기)"}
                                                                </span>
                                                                <span
                                                                    style={{
                                                                        marginLeft:
                                                                            "0.4rem",
                                                                        fontSize:
                                                                            "0.8rem",
                                                                        color: "var(--text-sub)",
                                                                    }}
                                                                >
                                                                    {count}
                                                                    명
                                                                </span>
                                                            </li>
                                                        );
                                                    },
                                                )}
                                            </ul>
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                </div>
            </div>

            {/* 🔹 QuizMon 전용 클래스 패널 (교사용 미리보기) */}
            {room?.game_key === "quizmon" && pack && (
                <div className="card">
                    <h2>QuizMon 클래스 패널 (베타)</h2>
                    <p className="hint">
                        현재 세션의 퀴즈를 사용해 퀴즈몬 배틀을 시뮬레이션합니다.
                        (지금은 통계와는 독립된 테스트용 화면입니다.)
                    </p>
                    <div
                        style={{
                            borderTop: "1px solid var(--border-subtle, #eee)",
                            marginTop: "0.75rem",
                            paddingTop: "0.75rem",
                        }}
                    >
                        <QuizMonClassPanel
                            roomId={room.id}
                            pack={pack}
                            session={quizMonSession}
                            // onQuizAnswer는 나중에 game_events 연동할 때 여기서 넘겨줄 예정
                        />
                    </div>
                </div>
            )}

                {/* 🔹 세션 전체 요약 (문항별 정답률 표) */}
            {session && (
                <div className="card" style={{ marginTop: "1rem" }}>
                    <SessionSummaryPanel
                        sessionId={session.id}
                        questions={questions}
                        // QDD 방일 때는 game_events(=QDD) 통계도 함께 더해줌
                        qddStatsByQuestion={
                            room?.game_key === "qdd"
                                ? qddStatsByQuestionId
                                : undefined
                        }
                    />
                </div>
            )}
            
            {/* 학생 상태 + 개별 메시지 모달 */}
            {showStudentStatusModal && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(15, 23, 42, 0.75)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1001,
                        padding: "1rem",
                    }}
                >
                    <div
                        className="card"
                        style={{
                            maxWidth: "860px",
                            width: "100%",
                            maxHeight: "80vh",
                            overflow: "auto",
                            background: "rgba(15, 23, 42, 0.98)",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "0.5rem",
                            }}
                        >
                            <h2 style={{ marginBottom: 0 }}>
                                학생 상태 & 개인 메시지
                            </h2>
                            <button
                                type="button"
                                className="secondary-btn"
                                onClick={() =>
                                    setShowStudentStatusModal(false)
                                }
                            >
                                닫기
                            </button>
                        </div>

                        <p
                            className="hint"
                            style={{ marginTop: "0.4rem" }}
                        >
                            좌측에서 학생을 선택하면, 우측에서 해당 학생에게만
                            보내는 메시지를 작성할 수 있습니다.
                        </p>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "minmax(0, 1.1fr) minmax(0, 1.4fr)",
                                gap: "1rem",
                                marginTop: "0.75rem",
                            }}
                        >
                            {/* 왼쪽: 학생 리스트 */}
                            <div>
                                <h3
                                    style={{
                                        fontSize: "0.95rem",
                                        marginBottom: "0.4rem",
                                    }}
                                >
                                    학생 목록
                                </h3>
                                {students.length === 0 ? (
                                    <p className="hint">
                                        아직 이 세션에서 답안을 제출한 학생이
                                        없습니다.
                                    </p>
                                ) : (
                                    <ul
                                        style={{
                                            listStyle: "none",
                                            padding: 0,
                                            margin: 0,
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "0.25rem",
                                        }}
                                    >
                                        {students.map((s) => {
                                            const isSelected =
                                                selectedStudentForMessage
                                                    ?.student_key ===
                                                s.student_key;

                                            return (
                                                <li
                                                    key={
                                                        s.student_key
                                                    }
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setSelectedStudentForMessage(
                                                                s,
                                                            )
                                                        }
                                                        style={{
                                                            width: "100%",
                                                            textAlign: "left",
                                                            padding:
                                                                "0.35rem 0.5rem",
                                                            borderRadius:
                                                                "0.4rem",
                                                            border: isSelected
                                                                ? "1px solid var(--accent)"
                                                                : "1px solid var(--border-subtle)",
                                                            background:
                                                                isSelected
                                                                    ? "rgba(56, 189, 248, 0.12)"
                                                                    : "rgba(15, 23, 42, 0.9)",
                                                            cursor: "pointer",
                                                            fontSize:
                                                                "0.85rem",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                display:
                                                                    "flex",
                                                                justifyContent:
                                                                    "space-between",
                                                                alignItems:
                                                                    "center",
                                                                gap: "0.5rem",
                                                            }}
                                                        >
                                                            <span>
                                                                <strong>
                                                                    {s.nickname ??
                                                                        "이름 없음"}
                                                                </strong>{" "}
                                                                (
                                                                {s.student_key.slice(
                                                                    -4,
                                                                )}
                                                                )
                                                            </span>
                                                            <span
                                                                style={{
                                                                    fontSize:
                                                                        "0.75rem",
                                                                    color: "var(--text-sub)",
                                                                }}
                                                            >
                                                                {s.answersCount}
                                                                문항{" "}
                                                                /{" "}
                                                                {s.lastAnsweredAt
                                                                    ? new Date(
                                                                        s.lastAnsweredAt,
                                                                    ).toLocaleTimeString(
                                                                        undefined,
                                                                        {
                                                                            hour: "2-digit",
                                                                            minute:
                                                                                "2-digit",
                                                                        },
                                                                    )
                                                                    : "-"}
                                                            </span>
                                                        </div>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            {/* 오른쪽: 선택된 학생에게 개인 메시지 */}
                            <div>
                                <h3
                                    style={{
                                        fontSize: "0.95rem",
                                        marginBottom: "0.4rem",
                                    }}
                                >
                                    개인 메시지 보내기
                                </h3>

                                {!selectedStudentForMessage ? (
                                    <p className="hint">
                                        왼쪽 목록에서 학생을 선택하면, 이곳에서
                                        개인 메시지를 작성할 수 있습니다.
                                    </p>
                                ) : (
                                    <form
                                        onSubmit={handleSendPersonalMessage}
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "0.5rem",
                                        }}
                                    >
                                        <div className="form-field">
                                            <span>대상 학생</span>
                                            <div
                                                style={{
                                                    fontSize: "0.9rem",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {selectedStudentForMessage.nickname ??
                                                    "이름 없음"}{" "}
                                                (
                                                {selectedStudentForMessage.student_key.slice(
                                                    -4,
                                                )}
                                                )
                                            </div>
                                        </div>

                                        <label className="form-field">
                                            <span>메시지 내용</span>
                                            <textarea
                                                rows={3}
                                                value={personalMessageBody}
                                                onChange={(e) =>
                                                    setPersonalMessageBody(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="예: 잠시 후 새 방 코드로 이동해주세요."
                                            />
                                        </label>

                                        <label className="form-field">
                                            <span>링크 (선택)</span>
                                            <input
                                                type="url"
                                                value={
                                                    personalMessageLink
                                                }
                                                onChange={(e) =>
                                                    setPersonalMessageLink(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="예: https://... 또는 /student?code=..."
                                            />
                                        </label>

                                        <button
                                            type="submit"
                                            className="primary-btn"
                                            disabled={sendingPersonalMessage}
                                        >
                                            {sendingPersonalMessage
                                                ? "보내는 중..."
                                                : "이 학생에게만 보내기"}
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ QR 모달 (전체 화면 오버레이) */}
            {showQrModal && studentJoinUrl && qrImageUrl && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                    }}
                >
                    <div
                        className="card"
                        style={{
                            maxWidth: "420px",
                            width: "90%",
                            background: "var(--surface, #fff)",
                            padding: "1.25rem",
                        }}
                    >
                        <h2
                            style={{
                                marginTop: 0,
                                marginBottom: "0.75rem",
                            }}
                        >
                            학생 접속 QR
                        </h2>
                        <p
                            className="hint"
                            style={{ marginBottom: "0.75rem" }}
                        >
                            수업 화면에 이 QR을 띄우고, 학생들이 카메라로 스캔해서
                            바로 입장하도록 안내하세요.
                        </p>
                        <div
                            style={{
                                textAlign: "center",
                                marginBottom: "0.75rem",
                            }}
                        >
                            <img
                                src={qrImageUrl}
                                alt="학생 접속 QR 코드"
                                style={{
                                    maxWidth: "100%",
                                    height: "auto",
                                }}
                            />
                        </div>
                        <p
                            style={{
                                fontSize: "0.8rem",
                                wordBreak: "break-all",
                                marginBottom: "0.75rem",
                            }}
                        >
                            {studentJoinUrl}
                        </p>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: "0.5rem",
                            }}
                        >
                            <button
                                type="button"
                                className="secondary-btn"
                                onClick={handleCopyStudentLink}
                            >
                                링크 복사
                            </button>
                            <button
                                type="button"
                                className="primary-btn"
                                onClick={() => setShowQrModal(false)}
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
