// src/pages/student/StudentRoomPage.tsx
import { useEffect, useState, useRef } from "react";
import { useLocation, useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { usePresence } from "../../hooks/usePresence";
import { useGameHostBridge } from "../../hooks/useGameHostBridge";
import type { QuizPackRow } from "./StudentPlayPackPage";
import { GAME_REGISTRY, type GameKey } from "../../games/gameRegistry";


type RoomRow = {
    class_id: null;
    id: string;
    code: string;
    title: string;
    game_key: string;
    status: string;
    created_at: string;
    quiz_pack_id?: string | null;
};

type QuizSessionRow = {
    id: string;
    room_id: string;
    pack_id: string;
    status: string;
    current_index: number;
};

type QuizQuestionRow = {
    id: string;
    pack_id: string;
    index_in_pack: number;
    prompt: string;
    options: string[] | null;
    answer_index: number | null;
};

type RoomMessageRow = {
    id: string;
    room_id: string;
    session_id: string | null;
    target_type: "all" | "student";
    target_student_key: string | null;
    target_nickname: string | null;
    body: string | null;
    link_url: string | null;
    created_at: string;
};

type LocationState = {
    nickname?: string;
    roomCode?: string;
    roomTitle?: string;
    gameKey?: string;
};

function makeRandomKey() {
    return "s-" + Math.random().toString(36).slice(2);
}

function formatTime(iso: string): string {
    try {
        const d = new Date(iso);
        const hh = d.getHours().toString().padStart(2, "0");
        const mm = d.getMinutes().toString().padStart(2, "0");
        return `${hh}:${mm}`;
    } catch {
        return "";
    }
}

export function StudentRoomPage() {
    const { roomId } = useParams<{ roomId: string }>();
    const location = useLocation();
    const state = (location.state || {}) as LocationState;

    const [room, setRoom] = useState<RoomRow | null>(null);
    const [loadingRoom, setLoadingRoom] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [pack, setPack] = useState<QuizPackRow | null>(null);

    // 세션 & 현재 문제
    const [session, setSession] = useState<QuizSessionRow | null>(null);
    const [currentQuestion, setCurrentQuestion] =
        useState<QuizQuestionRow | null>(null);
    const [lastQuestionId, setLastQuestionId] = useState<string | null>(null);

    // 전체 문항 수 (진행도 표시용)
    const [questionCount, setQuestionCount] = useState<number | null>(null);

    // 답안 전송 상태
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [hasAnswered, setHasAnswered] = useState(false);
    const [submitMessage, setSubmitMessage] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // "내 정보" 토글
    const [showProfile, setShowProfile] = useState(false);

    // 🔥 QDD 전체화면 토글
    const [isGameFullscreen, setIsGameFullscreen] = useState(false);

    // 메시지
    const [messages, setMessages] = useState<RoomMessageRow[]>([]);
    const [showAllMessages, setShowAllMessages] = useState(false);

    const [nickname] = useState(() => {
        if (state.nickname) return state.nickname;

        try {
            if (roomId && typeof window !== "undefined") {
                const storageKey = `classhub:room:${roomId}:nickname`;
                const saved = window.localStorage.getItem(storageKey);
                if (saved) return saved;
            }
        } catch {
            // ignore
        }

        return "학생";
    });

    const [gameSessionId, setGameSessionId] = useState<string | null>(null);
    const quizpackJson: any = null;

    // room / session / game_key 준비되면 game_sessions 조회
    useEffect(() => {
        if (!room?.id || !session?.id || !room.game_key) {
            setGameSessionId(null);
            return;
        }

        const loadGameSession = async () => {
            const { data, error } = await supabase
                .from("game_sessions")
                .select("id")
                .eq("room_id", room.id)
                .eq("game_id", room.game_key)
                .eq("quiz_session_id", session.id)
                .maybeSingle();

            if (error) {
                console.error("[StudentRoom] load game_session error", error);
                return;
            }

            if (data) {
                setGameSessionId(data.id);
            } else {
                console.warn("[StudentRoom] game_session not found for this quiz_session");
                setGameSessionId(null);
            }
        };

        void loadGameSession();
    }, [room?.id, room?.game_key, session?.id]);


    useEffect(() => {
        if (typeof document === "undefined") return;

        if (isGameFullscreen) {
            const original = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = original;
            };
        }
    }, [isGameFullscreen]);


    // 학생 식별 키 (방마다 로컬스토리지에 저장)
    const [studentKey] = useState(() => {
        try {
            const storageKey = roomId
                ? `classhub:room:${roomId}:studentKey`
                : "classhub:room:default";
            if (typeof window !== "undefined") {
                const existing = window.localStorage.getItem(storageKey);
                if (existing) return existing;
                const created = makeRandomKey();
                window.localStorage.setItem(storageKey, created);
                return created;
            }
        } catch {
            // ignore
        }
        return makeRandomKey();
    });

    // ✅ 브리지에 넘길 학생 ID는 studentKey를 그대로 사용
    const studentId = studentKey;

    // 뷰포트 폭에 따라 QDD iframe 비율 전환 (<= 768px → 세로형)
    const [, setIsNarrowViewport] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const mq = window.matchMedia("(max-width: 768px)");

        const handleChange = (event: MediaQueryListEvent) => {
            setIsNarrowViewport(event.matches);
        };

        // 최초 1회 반영
        setIsNarrowViewport(mq.matches);

        mq.addEventListener("change", handleChange);
        return () => mq.removeEventListener("change", handleChange);
    }, []);


    // presence용 방 코드
    const roomCodeForPresence =
        room?.code ?? state.roomCode ?? roomId ?? "";

    // QDD iframe 레퍼런스
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    // 접속 presence
    usePresence(roomCodeForPresence, "student", {
        studentId: studentKey,
        nickname,
    });

    // 이 방의 실제 게임 키 (rooms.game_key → navigation state → 기본값)
    const effectiveGameKey: GameKey =
        ((room?.game_key as GameKey) ??
            (state.gameKey as GameKey) ??
            "quiz-only");
    
    const gameSpec = GAME_REGISTRY[effectiveGameKey];
    const isIframeGame = gameSpec?.mode === "iframe";
    const isQddRoom = effectiveGameKey === "qdd";

    const isReactGame = gameSpec?.mode === "react-component";
    
    // ✅ iframe 게임용 세션 ID는 "game_sessions.id"를 사용
    const effectiveGameSessionId =
        isIframeGame && gameSessionId ? gameSessionId : "";


    useGameHostBridge({
        iframeRef,
        gameId: effectiveGameKey,
        gameSessionId: effectiveGameSessionId,   // ⬅ 여기만 살짝 교체
        roomId: room?.id ?? "",
        quizpackJson,
        studentId,
    });

    
    // 1) 방 기본 정보 로드
    useEffect(() => {
        if (!roomId) return;

        const loadRoom = async () => {
            setLoadingRoom(true);
            setErrorMsg(null);

            const { data, error } = await supabase
                .from("rooms")
                .select(
                    "id, code, title, game_key, status, created_at, quiz_pack_id",
                )
                .eq("id", roomId)
                .single();

            if (error) {
                console.error("[StudentRoom] load room error", error);
                setErrorMsg("이 방 정보를 불러오는 중 오류가 발생했습니다.");
                setLoadingRoom(false);
                return;
            }

            setRoom(data as RoomRow);
            setLoadingRoom(false);
        };

        void loadRoom();
    }, [roomId]);

    // 1-1) 퀴즈팩 정보 로드 (게임/퀴즈 공통)
    useEffect(() => {
        if (!room?.quiz_pack_id) {
            setPack(null);
            return;
        }

        let cancelled = false;
        const fetchPack = async () => {
            const { data, error } = await supabase
                .from("quiz_packs")
                .select("id, owner_id, title, subject, grade")
                .eq("id", room.quiz_pack_id)
                .single();

            if (cancelled) return;

            if (error) {
                console.error("[StudentRoom] load pack error", error);
                setPack(null);
                return;
            }

            setPack(data as QuizPackRow);
        };

        void fetchPack();
        return () => {
            cancelled = true;
        };
    }, [room?.quiz_pack_id]);

    // 1-2) 전체 문항 수 로드 (진행도 바용)
    useEffect(() => {
        // ✅ QDD 방에서는 Supabase 질문 카운트 사용 안 함
        if (!room?.quiz_pack_id || isQddRoom) {
            setQuestionCount(null);
            return;
        }

        let cancelled = false;

        const fetchCount = async () => {
            const { count, error } = await supabase
                .from("quiz_questions")
                .select("id", { count: "exact", head: true })
                .eq("pack_id", room.quiz_pack_id);

            if (error) {
                console.error("[StudentRoom] load question count error", error);
                return;
            }

            if (!cancelled) {
                setQuestionCount(typeof count === "number" ? count : null);
            }
        };

        void fetchCount();

        return () => {
            cancelled = true;
        };
    }, [room?.quiz_pack_id, isQddRoom]);


    // 2) 현재 세션/문제 폴링 (3초마다)
    useEffect(() => {
        if (!roomId) return;

        let cancelled = false;

        const fetchSessionAndQuestion = async () => {
            // 최신 세션
            const { data: sRow, error: sErr } = await supabase
                .from("quiz_sessions")
                .select("id, room_id, pack_id, status, current_index")
                .eq("room_id", roomId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (cancelled) return;

            if (sErr) {
                console.error("[StudentRoom] load session error", sErr);
                return;
            }

            if (!sRow || sRow.status === "ended") {
                setSession(null);
                setCurrentQuestion(null);
                return;
            }

            const sess = sRow as QuizSessionRow;
            setSession(sess);

            // ✅ QDD 방이면 여기까지만: 세션 정보만 유지하고 문제는 Supabase에서 안 가져옴
            if (isQddRoom) {
                setCurrentQuestion(null);
                return;
            }

            // 일반 퀴즈 방일 때만 현재 문제 로드
            const { data: qRow, error: qErr } = await supabase
                .from("quiz_questions")
                .select(
                    "id, pack_id, index_in_pack, prompt, options, answer_index",
                )
                .eq("pack_id", sess.pack_id)
                .eq("index_in_pack", sess.current_index)
                .maybeSingle();

            if (cancelled) return;

            if (qErr) {
                console.error("[StudentRoom] load question error", qErr);
                return;
            }

            if (!qRow) {
                setCurrentQuestion(null);
                return;
            }

            const normalized = {
                ...qRow,
                options: ((qRow as any).options ?? null) as string[] | null,
            } as QuizQuestionRow;

            setCurrentQuestion(normalized);

            // 새 문제로 넘어오면 답변 상태 리셋
            if (normalized.id !== lastQuestionId) {
                setLastQuestionId(normalized.id);
                setHasAnswered(false);
                setSelectedIndex(null);
                setSubmitMessage(null);
            }
        };

        void fetchSessionAndQuestion();
        const timer = window.setInterval(fetchSessionAndQuestion, 3000);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [roomId, lastQuestionId, isQddRoom]);



    // 2-3) 현재 문제에 대한 기존 답안 여부 체크
    useEffect(() => {
        if (!session?.id || !currentQuestion?.id || !studentKey) return;

        let cancelled = false;

        const checkAlreadyAnswered = async () => {
            const { data, error } = await supabase
                .from("quiz_answers")
                .select("selected_index")
                .eq("session_id", session.id)
                .eq("question_id", currentQuestion.id)
                .eq("student_key", studentKey)
                .order("created_at", { ascending: true }) // 여러 개 있다면 가장 처음 것
                .limit(1);

            if (cancelled) return;

            if (error) {
                console.error(
                    "[StudentRoom] load existing answer error",
                    error,
                );
                return;
            }

            if (data && data.length > 0) {
                setHasAnswered(true);
                setSelectedIndex(data[0].selected_index);
                setSubmitMessage("이미 이 문제에 답을 제출했습니다.");
            } else {
                // 새 문제로 넘어왔을 때 상태 초기화
                setHasAnswered(false);
                setSelectedIndex(null);
                setSubmitMessage(null);
            }
        };

        void checkAlreadyAnswered();

        return () => {
            cancelled = true;
        };
    }, [session?.id, currentQuestion?.id, studentKey]);

    // 3) 선생님 메시지 구독 (초기 조회 + Realtime)
    useEffect(() => {
        if (!roomId || !studentKey) return;

        let cancelled = false;

        const loadMessages = async () => {
            const { data, error } = await supabase
                .from("room_messages")
                .select(
                    "id, room_id, session_id, target_type, target_student_key, target_nickname, body, link_url, created_at",
                )
                .eq("room_id", roomId)
                .or(`target_type.eq.all,target_student_key.eq.${studentKey}`)
                .order("created_at", { ascending: true });

            if (cancelled) return;

            if (error) {
                console.error("[StudentRoom] load messages error", error);
                return;
            }

            setMessages((data ?? []) as RoomMessageRow[]);
        };

        void loadMessages();

        const channel = supabase
            .channel(`room_messages:room:${roomId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "room_messages",
                    filter: `room_id=eq.${roomId}`,
                },
                (payload) => {
                    const m = payload.new as RoomMessageRow;
                    if (
                        m.target_type === "all" ||
                        m.target_student_key === studentKey
                    ) {
                        setMessages((prev) => [...prev, m]);
                    }
                },
            )
            .subscribe();

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
        };
    }, [roomId, studentKey]);

    
    
    const handleSubmitAnswer = async (choiceIdx: number) => {
        if (!room || !session || !currentQuestion) return;
        if (hasAnswered || submitting) return;

        setSubmitting(true);
        setSubmitMessage(null);

        try {
            const isCorrect =
                currentQuestion.answer_index != null &&
                choiceIdx === currentQuestion.answer_index;

            const { error } = await supabase.from("quiz_answers").insert({
                session_id: session.id,
                room_id: room.id,
                pack_id: session.pack_id,
                question_id: currentQuestion.id,
                student_key: studentKey,
                nickname,
                selected_index: choiceIdx,
                is_correct: isCorrect,
            });

            if (error) {
                console.error("[StudentRoom] submit answer error", error);
                setSubmitMessage(
                    "답안을 전송하는 중 오류가 발생했습니다.",
                );
                return;
            }

            setHasAnswered(true);
            setSelectedIndex(choiceIdx);
            setSubmitMessage(
                isCorrect
                    ? "정답입니다! 🎉"
                    : "제출 완료! 정답은 선생님 화면에서 확인하세요.",
            );
        } finally {
            setSubmitting(false);
        }
    };


    if (loadingRoom) {
        return (
            <section className="page student-join">
                <h1>방 입장</h1>
                <p className="page-desc">방 정보를 불러오는 중...</p>
            </section>
        );
    }

    if (errorMsg || !room) {
        return (
            <section className="page student-join">
                <h1>방 입장</h1>
                <p className="page-desc">
                    {errorMsg ?? "방 정보를 찾을 수 없습니다."}
                </p>
                <Link to="/student" className="secondary-btn">
                    ← 방 코드 다시 입력하기
                </Link>
            </section>
        );
    }

    const roomTitle = state.roomTitle ?? room.title;
    const roomCode = state.roomCode ?? room.code;


    const currentGameSpec = gameSpec;
    const gameLabel = currentGameSpec?.label ?? "게임";
    const isGameRoom = isIframeGame || isReactGame;
    
    // iframe 게임일 때 기본 URL 생성 (QDD, Pixel 등)
    const baseGameUrl =
            isIframeGame && room && pack && currentGameSpec?.mode === "iframe"
                ? currentGameSpec.buildUrl({
                        pack,
                        roomId: room.id,
                })
                : null;
    
            // QDD만 sessionId를 쿼리 스트링으로 전달 (Pixel은 필요 없음)
                const gameUrl = 
                    baseGameUrl && 
                    effectiveGameSessionId && 
                    currentGameSpec?.key === "qdd" 
                        ? `${baseGameUrl}${
                                  baseGameUrl.includes("?") ? "&" : "?"
                                  }sessionId=${encodeURIComponent(effectiveGameSessionId)}`
                        : baseGameUrl;
    

    if (!roomId) {
        return (
            <section
                className="page student-join"
                style={
                    isQddRoom
                        ? {
                            // Chromebook(1366px)에서 가로폭 대부분 사용
                            maxWidth: "100%",
                            paddingInline: "1.5rem",
                        }
                        : undefined
                }
            >
                <h1>방 입장</h1>
                <p className="page-desc">잘못된 경로입니다.</p>
                <Link to="/student" className="secondary-btn">
                    ← 방 코드 다시 입력하기
                </Link>
            </section>
        );
    }

    const showProgress =
        session &&
        session.status === "running" &&
        questionCount &&
        questionCount > 0;

    const lastMessage =
        messages.length > 0 ? messages[messages.length - 1] : null;

    return (
        <section
            className="page student-join"
            style={
                isQddRoom
                    ? {
                        // 기본 .page의 max-width(보통 960px)를 덮어써서
                        // QDD 카드가 1920px까지 넓어질 수 있게 함
                        maxWidth: "100%",
                        // 좌우 여백 조금만 주기 (Chromebook 기준)
                        paddingInline: "1.5rem",
                    }
                    : undefined
            }
        >
            <h1>수업 방에 입장했습니다 🎉</h1>
            <p className="page-desc">
                선생님이 문제를 진행하거나 게임을 시작하면 아래에 현재
                문제/게임이 표시됩니다. 보기 중 하나를 선택해 답을 제출해
                주세요.
            </p>

            {/* 상단 요약 + 진행도 바 */}
            <div
                style={{
                    maxWidth: isIframeGame ? 1920 : 1080,
                    margin: "0 auto 1rem",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "0.5rem",
                        marginBottom: "0.4rem",
                    }}
                >
                    <div style={{ fontSize: "0.9rem" }}>
                        <strong>{roomTitle}</strong>
                        <span
                            style={{
                                marginLeft: "0.5rem",
                                fontSize: "0.85rem",
                                color: "var(--text-sub)",
                            }}
                        >
                            코드 {roomCode}
                        </span>
                    </div>
                    <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => setShowProfile((v) => !v)}
                        style={{
                            fontSize: "0.8rem",
                            padding: "0.25rem 0.5rem",
                        }}
                    >
                        {showProfile ? "내 정보 숨기기" : "내 정보 보기"}
                    </button>
                </div>

                {showProgress && (
                    <div>
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
                                        ((session!.current_index + 1) /
                                            questionCount) *
                                        100,
                                    ).toFixed(1)}%`,
                                    height: "100%",
                                    background:
                                        "var(--accent, #22c55e)",
                                    transition: "width 0.3s ease",
                                }}
                            />
                        </div>
                        <p
                            style={{
                                fontSize: "0.8rem",
                                marginTop: "0.25rem",
                                color: "var(--text-sub)",
                            }}
                        >
                            {session!.current_index + 1} / {questionCount} 문제
                            진행 중
                        </p>
                    </div>
                )}
            </div>

            {/* 내 정보: 필요할 때만 열어보기 */}
            {showProfile && (
                <div
                    className="card"
                    style={{ maxWidth: 520, margin: "0 auto 1rem" }}
                >
                    <h2>내 정보</h2>
                    <p>
                        <strong>닉네임:</strong> {nickname}
                    </p>
                    <p>
                        <strong>방 코드:</strong> {roomCode}
                    </p>
                    <p className="hint">
                        이 화면을 닫았다가 다시 들어와도, 같은 기기에서는 같은
                        학생으로 기록됩니다.
                    </p>
                </div>
            )}

            {/* 현재 문제 / 게임 영역 */}
            <div
                className="card"
                style={{
                    maxWidth: isQddRoom ? "100%" : 720,
                    margin: "0 auto",
                }}
            >
                {/* 카드 상단: 제목 + (QDD일 때만) 게임만 보기 버튼 */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        marginBottom: "0.5rem",
                    }}
                >
                    <h2 style={{ margin: 0 }}>
                        {isGameRoom ? "현재 게임" : "현재 문제"}
                    </h2>

                    {isIframeGame &&
                        session &&
                        session.status === "running" &&
                        gameUrl && (
                            <button
                                type="button"
                                className="secondary-btn"
                                style={{
                                    fontSize: "0.8rem",
                                    padding: "0.25rem 0.5rem",
                                }}
                                onClick={() => setIsGameFullscreen(true)}
                            >
                                게임만 보기
                            </button>
                        )}
                </div>

                {/* iframe 게임 / React 게임 / 기본 퀴즈 분기 */}
                {isIframeGame ? (
                    !pack ? (
                        <p>
                            이 방의 퀴즈팩 정보를 불러오지 못했습니다. 잠시 후
                            다시 시도해 주세요.
                        </p>
                    ) : !session ||
                    session.status !== "running" ||
                    !gameUrl ? (
                        <>
                            <p
                                style={{
                                    fontSize: "0.9rem",
                                    marginBottom: "0.5rem",
                                    color: "var(--text-sub)",
                                }}
                            >
                                이 방은{" "}
                                <strong>{gameLabel}</strong>{" "}
                                게임용 방입니다.
                            </p>
                            <p
                                style={{
                                    fontSize: "0.9rem",
                                    marginBottom: "0.5rem",
                                }}
                            >
                                선생님이 게임을 시작하면 지정된 게임 화면에서
                                플레이하게 됩니다.
                                <br />
                                <span
                                    style={{
                                        fontSize: "0.8rem",
                                        color: "var(--text-sub)",
                                    }}
                                >
                                    (게임이 시작되면 이 위치에 {gameLabel} 게임
                                    화면이 표시됩니다)
                                </span>
                            </p>
                        </>
                    ) : (
                        <div
                            className="qdd-frame-wrapper"
                            style={{
                                position: isGameFullscreen
                                    ? "fixed"
                                    : "relative",
                                inset: isGameFullscreen ? 0 : undefined,
                                top: isGameFullscreen ? 0 : undefined,
                                left: isGameFullscreen ? 0 : undefined,
                                width: isGameFullscreen ? "100vw" : "100%",
                                height: isGameFullscreen
                                    ? "100vh"
                                    : undefined,
                                // 전체화면 아닐 때는 비율로 높이 확보
                                aspectRatio: isGameFullscreen
                                    ? undefined
                                    : "16 / 10",
                                borderRadius: isGameFullscreen ? 0 : 12,
                                overflow: "hidden",
                                backgroundColor: "#000",
                                zIndex: isGameFullscreen ? 1000 : "auto",
                            }}
                        >
                            <iframe
                                title="퀴즈 다이스 디펜스(QDD)"
                                src={gameUrl ?? undefined}
                                ref={iframeRef}
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    width: "100%",
                                    height: "100%",
                                    border: "none",
                                }}
                                allowFullScreen
                            />

                            {isGameFullscreen && (
                                <button
                                    type="button"
                                    onClick={() => setIsGameFullscreen(false)}
                                    style={{
                                        position: "absolute",
                                        top: 8,
                                        right: 8,
                                        zIndex: 1001,
                                        padding: "0.4rem 0.6rem",
                                        borderRadius: 999,
                                        border: "none",
                                        fontSize: "0.8rem",
                                        background:
                                            "rgba(15, 23, 42, 0.75)",
                                        color: "#fff",
                                    }}
                                >
                                    ✕ 수업 화면
                                </button>
                            )}
                        </div>
                        )
                ) : gameSpec?.mode === "react-component" ? (
                    // 🔥 React 기반 게임 (QuizMon Class 등)
                    <gameSpec.component
                        roomId={room?.id ?? null}
                        classId={room?.class_id ?? null}
                        pack={pack}
                        session={session}
                        // QuizMon 등 React 게임에서도 game_events를 남길 수 있도록 전달
                        gameSessionId={gameSessionId}
                        studentId={studentId}
                    />
                ) : !session || session.status === "ended" ? (
                    <p>
                        현재 진행 중인 퀴즈 세션이 없습니다. 선생님이 수업을
                        시작하면 문제가 자동으로 표시됩니다.
                    </p>
                ) : !currentQuestion ? (
                    <p>현재 인덱스에 해당하는 문제를 불러오지 못했습니다.</p>
                ) : (
                    <>
                        <p
                            style={{
                                fontSize: "0.9rem",
                                marginBottom: "0.5rem",
                                color: "var(--text-sub)",
                            }}
                        >
                            선생님이 진행하는 문제에 맞춰 보기 중 하나를 선택해
                            주세요.
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
                            {(currentQuestion.options ?? []).map((opt, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    className={
                                        selectedIndex === idx
                                            ? "primary-btn"
                                            : "secondary-btn"
                                    }
                                    disabled={
                                        hasAnswered || submitting || !opt
                                    }
                                    onClick={() => handleSubmitAnswer(idx)}
                                    style={{ textAlign: "left" }}
                                >
                                    <strong
                                        style={{
                                            marginRight: "0.4rem",
                                        }}
                                    >
                                        {String.fromCharCode(65 + idx)}.
                                    </strong>
                                    {opt || "(빈 보기)"}
                                </button>
                            ))}
                        </div>

                        {submitMessage && (
                            <p
                                className="form-message"
                                style={{ marginTop: "0.75rem" }}
                            >
                                {submitMessage}
                            </p>
                        )}

                        {!hasAnswered && (
                            <p
                                className="hint"
                                style={{
                                    marginTop: "0.5rem",
                                    fontSize: "0.85rem",
                                }}
                            >
                                보기 버튼을 누르면 곧바로 답이 제출됩니다.
                                제출 후에는 다시 바꿀 수 없습니다.
                            </p>
                        )}
                    </>
                )}
            </div>

            {/* 선생님 알림 카드: 기본은 마지막 메시지 1개만, 버튼으로 전체 보기 */}
            {lastMessage && (
                <div
                    className="card"
                    style={{ maxWidth: 720, margin: "1rem auto 0" }}
                >
                    <h2>선생님 알림</h2>

                    {!showAllMessages ? (
                        <>
                            <ul
                                style={{
                                    listStyle: "none",
                                    padding: 0,
                                    margin: 0,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.4rem",
                                }}
                            >
                                <li
                                    key={lastMessage.id}
                                    style={{
                                        paddingTop: "0.25rem",
                                        borderTop:
                                            "1px solid var(--border-subtle)",
                                        fontSize: "0.9rem",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: "0.5rem",
                                            marginBottom: "0.15rem",
                                        }}
                                    >
                                        <span>
                                            {lastMessage.target_type === "all"
                                                ? "전체 알림"
                                                : "개인 알림"}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: "0.8rem",
                                                color: "var(--text-sub)",
                                            }}
                                        >
                                            {formatTime(lastMessage.created_at)}
                                        </span>
                                    </div>
                                    {lastMessage.body && (
                                        <div>{lastMessage.body}</div>
                                    )}
                                    {lastMessage.link_url && (
                                        <button
                                            type="button"
                                            className="secondary-btn"
                                            onClick={() => {
                                                window.location.href =
                                                    lastMessage.link_url!;
                                            }}
                                            style={{
                                                marginTop: "0.25rem",
                                                fontSize: "0.8rem",
                                                padding:
                                                    "0.25rem 0.5rem",
                                            }}
                                        >
                                            링크 열기
                                        </button>
                                    )}
                                </li>
                            </ul>

                            {messages.length > 1 && (
                                <div
                                    style={{
                                        marginTop: "0.5rem",
                                        textAlign: "right",
                                    }}
                                >
                                    <button
                                        type="button"
                                        className="secondary-btn"
                                        style={{
                                            fontSize: "0.8rem",
                                            padding:
                                                "0.25rem 0.5rem",
                                        }}
                                        onClick={() =>
                                            setShowAllMessages(true)
                                        }
                                    >
                                        모든 알림 보기 ({messages.length})
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <ul
                                style={{
                                    listStyle: "none",
                                    padding: 0,
                                    margin: 0,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.4rem",
                                }}
                            >
                                {messages.map((m) => (
                                    <li
                                        key={m.id}
                                        style={{
                                            paddingTop: "0.25rem",
                                            borderTop:
                                                "1px solid var(--border-subtle)",
                                            fontSize: "0.9rem",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                gap: "0.5rem",
                                                marginBottom: "0.15rem",
                                            }}
                                        >
                                            <span>
                                                {m.target_type === "all"
                                                    ? "전체 알림"
                                                    : "개인 알림"}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: "0.8rem",
                                                    color: "var(--text-sub)",
                                                }}
                                            >
                                                {formatTime(m.created_at)}
                                            </span>
                                        </div>
                                        {m.body && <div>{m.body}</div>}
                                        {m.link_url && (
                                            <button
                                                type="button"
                                                className="secondary-btn"
                                                onClick={() => {
                                                    window.location.href =
                                                        m.link_url!;
                                                }}
                                                style={{
                                                    marginTop: "0.25rem",
                                                    fontSize: "0.8rem",
                                                    padding:
                                                        "0.25rem 0.5rem",
                                                }}
                                            >
                                                링크 열기
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>

                            <div
                                style={{
                                    marginTop: "0.5rem",
                                    textAlign: "right",
                                }}
                            >
                                <button
                                    type="button"
                                    className="secondary-btn"
                                    style={{
                                        fontSize: "0.8rem",
                                        padding:
                                            "0.25rem 0.5rem",
                                    }}
                                    onClick={() =>
                                        setShowAllMessages(false)
                                    }
                                >
                                    최근 알림만 보기
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </section>
    );
}
