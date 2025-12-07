// src/pages/student/StudentRoomPage.tsx
import { useEffect, useState, useRef } from "react";
import { useLocation, useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { usePresence } from "../../hooks/usePresence";
import { useGameHostBridge } from "../../hooks/useGameHostBridge";
import type { QuizPackRow } from "./StudentPlayPackPage";
import { GAME_REGISTRY, type GameKey } from "../../games/gameRegistry";
import { ensurePlayStudentKey } from "../../utils/playStudentKey";
import { StudentGamePanel } from "./components/StudentGamePanel";
import { AutoPptStudentPanel } from "../../autoppt/AutoPptStudentPanel";

type RoomRow = {
    class_id: string | null;
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
    studentKey?: string;
    classId?: string | null;
    playStudentId?: string | null;
};

// PEM 엔딩에서 넘어오는 요약 데이터 타입 (PEM.html에서 postMessage로 보냄)
type PemRunSummary = {
    runId: string;
    version: string;
    starter: "grass" | "fire" | "water";
    pokemonName: string;
    stage: number;
    stats: {
        atk: number;
        def: number;
        skl: number;
        hp: number;
    };
    totalCorrect: number;
    totalQuestions: number;
    weekReached: number;
    endedAt: string;
};


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

    // QDD 전체화면 토글
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

    // 학생 식별 키: StudentJoinPage에서 받은 값 우선
    const [studentKey, setStudentKey] = useState<string>(() => {
        // 1순위: StudentJoinPage에서 넘겨준 값
        if (state.studentKey) return state.studentKey;
        // 그 외에는 일단 빈 문자열 → 나중에 room.class_id 로 보정
        return "";
    });

    // room / session / game_key 준비되면 game_sessions 조회
    useEffect(() => {
        if (!room?.id || !session?.id || !room.game_key) {
            setGameSessionId(null);
            return;
        }

        const loadGameSession = async () => {
            const { data, error } = await supabase
                .from("game_sessions")
                .select(
                    "id, room_id, game_id, quiz_pack_id, quiz_session_id, created_at",
                )
                .eq("room_id", room.id)
                .eq("game_id", room.game_key)
                .eq("quiz_session_id", session.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error(
                    "[StudentRoom] load game_session error",
                    error,
                );
                setGameSessionId(null);
                return;
            }

            if (data) {
                setGameSessionId(data.id);
            } else {
                console.warn(
                    "[StudentRoom] game_session not found for this quiz_session",
                );
                setGameSessionId(null);
            }
        };

        void loadGameSession();
    }, [room?.id, room?.game_key, session?.id]);

    // 🔹 PEM 엔딩 → ClassHub로 결과 전송 → Supabase pem_runs 저장
    useEffect(() => {
        if (!room?.id || !room.class_id || !studentKey) return;

        const handler = async (event: MessageEvent) => {
            const data = event.data;
            if (!data || typeof data !== "object") return;
            if (data.type !== "PEM_RUN_COMPLETE") return;

            const summary = data.payload as PemRunSummary | undefined;
            if (!summary) return;

            try {
                // console.log("[PEM] run summary:", summary);

                const row = {
                    run_id: summary.runId,
                    run_version: summary.version ?? "pem-v1",

                    class_id: room.class_id,
                    room_id: room.id,

                    student_key: studentKey,
                    nickname,

                    starter: summary.starter,
                    pokemon_name: summary.pokemonName,
                    stage: summary.stage,

                    atk: summary.stats?.atk ?? 0,
                    def: summary.stats?.def ?? 0,
                    skl: summary.stats?.skl ?? 0,
                    hp: summary.stats?.hp ?? 0,

                    total_correct: summary.totalCorrect ?? 0,
                    total_questions: summary.totalQuestions ?? 0,
                    week_reached: summary.weekReached ?? 0,

                    ended_at: summary.endedAt ?? new Date().toISOString(),

                    raw_payload: summary,
                };

                const { error } = await supabase
                    .from("pem_runs")
                    // 같은 run_id로 여러 번 들어오면 덮어쓰기
                    .upsert(row, { onConflict: "run_id" });

                if (error) {
                    console.error("[StudentRoom] save pem_runs error", error);
                    // 여기서 alert까지 띄우면 아이들 UX가 깨질 수 있어서 일단 로그만
                    return;
                }

                // 필요하면 로컬 피드백도 가능 (지금은 PEM.html 안에서 alert 띄우고 있음)
                // console.log("[StudentRoom] pem_runs saved");
            } catch (e) {
                console.error("[StudentRoom] pem_runs insert exception", e);
            }
        };

        window.addEventListener("message", handler);
        return () => {
            window.removeEventListener("message", handler);
        };
    }, [room?.id, room?.class_id, studentKey, nickname]);


    // 전체화면 시 body 스크롤 잠금
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

    // room.class_id 로딩 후 → 아직 키가 없으면 생성/보정
    useEffect(() => {
        // 이미 키가 있으면 (StudentJoin에서 받은 경우) 아무 것도 안 함
        if (studentKey) return;

        // 아직 방 정보를 로딩 중이면 기다리기
        if (loadingRoom) return;

        try {
            const classId = room?.class_id ?? state.classId ?? null;
            const key = ensurePlayStudentKey(classId);
            setStudentKey(key);
        } catch (e) {
            console.error("[StudentRoom] ensurePlayStudentKey error", e);
            // 문제 생기면 일단 fallback 하나 생성
            if (!studentKey) {
                setStudentKey("s-" + Math.random().toString(36).slice(2));
            }
        }
    }, [studentKey, loadingRoom, room?.class_id, state.classId]);

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

    const isAutoPptRoom = room?.game_key === "autoppt";

    const gameSpec = GAME_REGISTRY[effectiveGameKey];
    const isIframeGame = gameSpec?.mode === "iframe";
    const isReactGame = gameSpec?.mode === "react-component";
    const isQddRoom = effectiveGameKey === "qdd";
    const isPemRoom = effectiveGameKey === "pem";
    
    const studentId = studentKey;

    // ✅ iframe 게임용 세션 ID는 "game_sessions.id"를 사용
    const effectiveGameSessionId =
        isIframeGame && gameSessionId ? gameSessionId : "";

    useGameHostBridge({
        iframeRef,
        gameId: effectiveGameKey,
        gameSessionId: effectiveGameSessionId,
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
                    "id, class_id, code, title, game_key, status, created_at, quiz_pack_id",
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
        if (!room?.quiz_pack_id || isQddRoom || isPemRoom) {
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
                console.error(
                    "[StudentRoom] load question count error",
                    error,
                );
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
    }, [room?.quiz_pack_id, isQddRoom, isPemRoom]);

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

    const isGameRoom = isIframeGame || isReactGame || isAutoPptRoom;

    // iframe 게임일 때 기본 URL 생성 (QDD, Pixel 등)
    const currentGameSpec = gameSpec;
    const baseGameUrl =
        isIframeGame &&
        room &&
        pack &&
        currentGameSpec &&
        currentGameSpec.mode === "iframe"
            ? currentGameSpec.buildUrl({
                pack,
                roomId: room.id,
            })
            : null;

    // QDD만 sessionId를 쿼리 스트링으로 전달 (Pixel은 필요 없음)
    const gameUrl =
        baseGameUrl &&
        effectiveGameSessionId &&
        currentGameSpec &&
        currentGameSpec.key === "qdd"
            ? `${baseGameUrl}${
                baseGameUrl.includes("?") ? "&" : "?"
            }sessionId=${encodeURIComponent(effectiveGameSessionId)}`
            : baseGameUrl;

    if (!roomId) {
        return (
            <section
                className="page student-join"
                style={
                    isGameRoom
                        ? {
                            // 게임 방(QDD + QuizMon 등)은 페이지 폭 제한 풀기
                            maxWidth: "100%",
                            margin: "0",
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
                isGameRoom
                    ? {
                        // 모든 게임 방(QDD, QuizMon 등)의 페이지 폭 제한 해제
                        maxWidth: "100%",
                        margin: "0",
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
            <AutoPptStudentPanel roomId={roomId ?? null} />;

            {/* AutoPPT는 autoppt 방에서만 */}
            {isAutoPptRoom && (
                <AutoPptStudentPanel roomId={roomId ?? null} />
            )}

            {/* 기존 퀴즈/게임 영역 */}
            {!isAutoPptRoom && (
                <StudentGamePanel
                    gameKey={effectiveGameKey}
                    roomId={room.id}
                    pack={pack}
                    session={session as any}
                    currentQuestion={currentQuestion as any}
                    totalQuestions={questionCount ?? 0}
                    currentIndex={session?.current_index ?? 0}
                    selectedIndex={selectedIndex}
                    isCorrect={null}
                    submitting={submitting}
                    hasAnswered={hasAnswered}
                    submitMessage={submitMessage}
                    onAnswerClick={handleSubmitAnswer}
                    classId={room.class_id}
                    gameSessionId={gameSessionId}
                    studentId={studentId}
                    iframeSrc={gameUrl ?? null}
                    iframeRef={iframeRef}
                    isGameFullscreen={isGameFullscreen}
                    onToggleFullscreen={setIsGameFullscreen}
                />
            )}


            {/* 선생님 알림 카드 */}
            {messages.length > 0 && (
                <div
                    className="card"
                    style={{ maxWidth: 720, margin: "1rem auto 0" }}
                >
                    <h2>선생님 알림</h2>

                    {!showAllMessages ? (
                        <>
                            {lastMessage && (
                                <ul
                                    style={{
                                        listStyle: "none",
                                        padding: 0,
                                        margin: 0,
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
                                                justifyContent:
                                                    "space-between",
                                                gap: "0.5rem",
                                                marginBottom: "0.15rem",
                                            }}
                                        >
                                            <span>
                                                {lastMessage.target_type ===
                                                "all"
                                                    ? "전체 알림"
                                                    : "개인 알림"}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: "0.8rem",
                                                    color: "var(--text-sub)",
                                                }}
                                            >
                                                {formatTime(
                                                    lastMessage.created_at,
                                                )}
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
                            )}

                            {messages.length > 1 && (
                                <button
                                    type="button"
                                    className="secondary-btn"
                                    style={{
                                        marginTop: "0.75rem",
                                        fontSize: "0.8rem",
                                        padding: "0.25rem 0.5rem",
                                    }}
                                    onClick={() => setShowAllMessages(true)}
                                >
                                    이전 메시지 모두 보기
                                </button>
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
                                                justifyContent:
                                                    "space-between",
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

                            <button
                                type="button"
                                className="secondary-btn"
                                style={{
                                    marginTop: "0.75rem",
                                    fontSize: "0.8rem",
                                    padding: "0.25rem 0.5rem",
                                }}
                                onClick={() => setShowAllMessages(false)}
                            >
                                마지막 메시지만 보기
                            </button>
                        </>
                    )}
                </div>
            )}
        </section>
    );
}
