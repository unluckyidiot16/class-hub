// src/pages/teacher/TeacherRoomLivePage.tsx
import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { QuestionStatsPanel } from "../../components/QuestionStatsPanel";
import { SessionSummaryPanel } from "../../components/SessionSummaryPanel";
import { usePresence } from "../../hooks/usePresence";
import PresenceSidebar from "../../components/PresenceSidebar";
import {ensureGameSession, endGameSession } from "../../api/gameSessions";

import { QuizMonClassPanel } from "../../games/quizmon/QuizMonClassPanel";
import {QuizmonProvider} from "../../games/quizmon/QuizmonProvider";
import type { QuizmonRaidSessionRow } from "../../games/quizmon/quizmonRaidSessions";
import {
    getActiveRaidSession,
    createRaidSession,
    closeActiveRaidSession,
} from "../../games/quizmon/quizmonRaidSessions";


// 🔹 PEM 한 판 클리어 기록 (pem_runs 테이블)
type PemRunRow = {
    id: string;
    run_id: string;
    class_id: string;
    room_id: string;
    student_key: string;
    nickname: string | null;

    starter: "grass" | "fire" | "water";
    pokemon_name: string;
    stage: number;

    atk: number;
    def: number;
    skl: number;
    hp: number;

    total_correct: number;
    total_questions: number;
    week_reached: number;

    ended_at: string;
    run_version: string | null;
    raw_payload: any;
};

// 🔹 토너먼트 매치 단위
type PemMatch = {
    id: string;
    round: string; // "예선", "8강", "준결승", ...
    left: PemRunRow;
    right: PemRunRow;
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

type PlayStudentRow = {
    id: string;
    class_id: string;
    student_key: string;
    nickname: string | null;
    coins: number;
    last_seen_at: string | null;
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
    options: Record<number, number>;
};

// 🔹 클래스 레이드용 학생별 누적 데미지 집계 타입
type RaidStat = {
    studentId: string;       // = game_events.student_id (student_key)
    totalAnswers: number;    // 전체 응답 수
    correctAnswers: number;  // 정답 수
    totalRaidDamage: number; // 누적 데미지 점수
};

// 🔹 클래스 레이드 보상 미리보기용 타입
type RaidRewardRow = {
    studentKey: string;
    nickname: string | null;
    totalAnswers: number;
    correctAnswers: number;
    accuracy: number;
    totalRaidDamage: number;
    gems: number;
};

type RaidRankingEntry = {
    studentKey: string;
    nickname: string | null;
    totalAnswers: number;
    correctAnswers: number;
    accuracy: number;
    totalRaidDamage: number;
};

type RaidResultSnapshot = {
    capturedAt: string; // 스냅샷 시각
    raidStats: Record<string, RaidStat>;
    ranking: RaidRankingEntry[];
    rewards: RaidRewardRow[];
    bossMaxHp: number;
    totalRaidDamage: number;
    bossHpRemaining: number;
    bossDefeated: boolean;
    raidParticipantCount: number;
};


type BuildRaidRewardOptions = {
    baseGem?: number;
    damageUnit?: number;
    maxBonusGem?: number;
    topBonusGemByRank?: number[];
};

// 🔹 누적 데미지 / 순위 기반 간단 보상안 생성
function buildRaidRewards(
    ranking: {
        studentKey: string;
        nickname: string | null;
        totalAnswers: number;
        correctAnswers: number;
        accuracy: number;
        totalRaidDamage: number;
    }[],
    options: BuildRaidRewardOptions = {},
): RaidRewardRow[] {
    const {
        baseGem = 10,                  // 참여만 해도 10젬
        damageUnit = 50,              // 50데미지당 1젬 추가
        maxBonusGem = 3,              // 데미지 보너스 최대 3젬
        topBonusGemByRank = [1, 1, 1] // 상위 3명 각 1젬 보너스
    } = options;

    if (!ranking.length) return [];

    return ranking.map((r, index) => {
        const bonusByDamage =
            damageUnit > 0
                ? Math.min(
                    maxBonusGem,
                    Math.floor((r.totalRaidDamage ?? 0) / damageUnit),
                )
                : 0;

        const rankBonus = topBonusGemByRank[index] ?? 0;

        return {
            ...r,
            gems: baseGem + bonusByDamage + rankBonus,
        };
    });
}


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

// 🔹 QuizMon 레이드용: game_events → 학생별 누적 데미지로 반영
function applyRaidEvent(
    base: Record<string, RaidStat>,
    row: GameEventRow,
): Record<string, RaidStat> {
    if (!row.payload) return base;

    // QuizMon 레이드만 집계
    if (row.event_type !== "quizmon-answer") {
        return base;
    }

    // payload 정규화
    let raw = row.payload as any;
    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw);
        } catch (e) {
            console.warn("[Raid] invalid payload JSON, skip", row.payload);
            return base;
        }
    }

    const payload = raw as {
        questionId?: string;
        correct?: boolean;
        raidDamage?: number;
    };

    if (!payload.questionId) {
        return base;
    }

    const studentId = row.student_id;
    if (!studentId) return base;

    const correct = !!payload.correct;
    const dmg =
        typeof payload.raidDamage === "number"
            ? payload.raidDamage
            : correct
                ? 10
                : 0; // 🔁 v1 기본값: 정답 1개 = 10 데미지

    const existing = base[studentId] ?? {
        studentId,
        totalAnswers: 0,
        correctAnswers: 0,
        totalRaidDamage: 0,
    };

    const next: RaidStat = {
        studentId,
        totalAnswers: existing.totalAnswers + 1,
        correctAnswers: existing.correctAnswers + (correct ? 1 : 0),
        totalRaidDamage: existing.totalRaidDamage + dmg,
    };

    return {
        ...base,
        [studentId]: next,
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

// 🔹 초기 game_events 목록 → 레이드 통계 맵
function buildRaidStats(rows: GameEventRow[]): Record<string, RaidStat> {
    console.log("[Raid] buildRaidStats input count:", rows.length);
    let stats: Record<string, RaidStat> = {};
    for (const row of rows) {
        stats = applyRaidEvent(stats, row);
    }
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

    // 🔹 반 단위 play_students 지갑 상태
    const [playStudents, setPlayStudents] = useState<PlayStudentRow[]>([]);
    const [playStudentsLoading, setPlayStudentsLoading] = useState(false);
    const [selectedPlayStudentIds, setSelectedPlayStudentIds] = useState<string[]>([]);
    const [walletCoinsDelta, setWalletCoinsDelta] = useState(0);
    const [walletGemsDelta, setWalletGemsDelta] = useState(0);
    const [walletStarShardsDelta, setWalletStarShardsDelta] = useState(0);
    const [walletSaving, setWalletSaving] = useState(false);

    // 🔹 PEM runs & 토너먼트 상태
    const [pemRuns, setPemRuns] = useState<PemRunRow[]>([]);
    const [pemRunsLoading, setPemRunsLoading] = useState(false);
    const [pemBracket, setPemBracket] = useState<PemMatch[]>([]);
    const [currentPemMatchIndex, setCurrentPemMatchIndex] = useState<number | null>(null);

    const pemIframeRef = useRef<HTMLIFrameElement | null>(null);

    // 🔹 QuizMon 클래스 레이드용 학생별 누적 데미지
    const [raidStats, setRaidStats] =
        useState<Record<string, RaidStat>>({});

    // 🔹 레이드 보상 미리보기 모달 상태
    const [showRaidRewardModal, setShowRaidRewardModal] = useState(false);
    const [rewardCopyMsg, setRewardCopyMsg] = useState<string | null>(null);

    // 🔹 레이드 결과 스냅샷 (종료 시점)
    const [raidResultSnapshot, setRaidResultSnapshot] =
        useState<RaidResultSnapshot | null>(null);


    // 🔹 play_students 재조회 함수
    const reloadPlayStudents = async (classId: string) => {
        setPlayStudentsLoading(true);
        try {
            const { data, error } = await supabase
                .from("play_students")
                .select(
                    "id, class_id, student_key, nickname, coins, last_seen_at",
                )
                .eq("class_id", classId)
                .order("nickname", { ascending: true });

            if (error) {
                console.error("[TeacherRoomLive] load play_students error", error);
                return;
            }

            setPlayStudents((data ?? []) as PlayStudentRow[]);
        } finally {
            setPlayStudentsLoading(false);
        }
    };

    // 🔹 room.class_id 기준으로 play_students 로딩
    useEffect(() => {
        if (!room?.class_id) {
            setPlayStudents([]);
            setSelectedPlayStudentIds([]);
            return;
        }
        void reloadPlayStudents(room.class_id);
    }, [room?.class_id]);

    // 🔹 pem_runs 로딩 (이 반/방에서 PEM 클리어한 기록)
    useEffect(() => {
        if (!room?.id || !room.class_id) {
            setPemRuns([]);
            return;
        }

        const loadPemRuns = async () => {
            setPemRunsLoading(true);
            try {
                const { data, error } = await supabase
                    .from("pem_runs")
                    .select("*")
                    .eq("class_id", room.class_id)
                    .eq("room_id", room.id)
                    .order("ended_at", { ascending: true });

                if (error) {
                    console.error("[TeacherRoomLive] load pem_runs error", error);
                    return;
                }

                setPemRuns((data ?? []) as PemRunRow[]);
            } finally {
                setPemRunsLoading(false);
            }
        };

        void loadPemRuns();
    }, [room?.id, room?.class_id]);


    // 🔹 play_students 선택 토글
    const togglePlayStudentSelection = (id: string) => {
        setSelectedPlayStudentIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    };

    const toggleSelectAllPlayStudents = () => {
        if (playStudents.length === 0) return;
        setSelectedPlayStudentIds((prev) =>
            prev.length === playStudents.length
                ? []
                : playStudents.map((p) => p.id),
        );
    };

    // 🔹 보상 지급 RPC 호출
    const handleGrantWallet = async (e?: any) => {
        if (e) e.preventDefault();
        if (!room?.class_id) {
            setErrorMsg("이 방은 반(class)에 연결되어 있지 않아 보상을 지급할 수 없습니다.");
            return;
        }

        if (selectedPlayStudentIds.length === 0) {
            setErrorMsg("보상을 줄 학생을 하나 이상 선택해주세요.");
            return;
        }

        const coins = Math.max(0, walletCoinsDelta | 0);
        const gems = Math.max(0, walletGemsDelta | 0);
        const starShards = Math.max(0, walletStarShardsDelta | 0);

        if (coins === 0 && gems === 0 && starShards === 0) {
            setErrorMsg("지급할 코인/젬/조각 중 하나 이상을 1 이상으로 입력해주세요.");
            return;
        }

        setWalletSaving(true);
        setErrorMsg(null);

        try {
            const { error } = await supabase.rpc("grant_play_student_wallet", {
                _class_id: room.class_id,
                _targets: selectedPlayStudentIds,
                _coins: coins,
                _gems: gems,
                _star_shards: starShards,
            });

            if (error) {
                console.error(
                    "[TeacherRoomLive] grant_play_student_wallet error",
                    error,
                );
                setErrorMsg("보상을 지급하는 중 오류가 발생했습니다.");
                return;
            }

            // 지급 후 최신 지갑 상태 다시 로딩
            await reloadPlayStudents(room.class_id);

            // 입력값은 초기화
            setWalletCoinsDelta(0);
            setWalletGemsDelta(0);
            setWalletStarShardsDelta(0);
        } finally {
            setWalletSaving(false);
        }
    };



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

    // 🔹 QuizMon 클래스 레이드용: 학생별 랭킹 리스트
    const raidRanking = useMemo(() => {
        if (!room || room.game_key !== "quizmon") return [];

        // 🔹 raidStats 를 기준으로 랭킹을 만든 뒤,
        //     students 에서 닉네임만 찾아와 붙이는 방식
        const entries = Object.values(raidStats);

        return entries
            .map((rs) => {
                const s = students.find(
                    (stu) => stu.student_key === rs.studentId,
                );

                const accuracy =
                    rs.totalAnswers > 0
                        ? Math.round(
                            (rs.correctAnswers / rs.totalAnswers) * 100,
                        )
                        : 0;

                return {
                    studentKey: rs.studentId,
                    nickname: s?.nickname ?? null,
                    totalAnswers: rs.totalAnswers,
                    correctAnswers: rs.correctAnswers,
                    accuracy,
                    totalRaidDamage: rs.totalRaidDamage,
                };
            })
            .sort((a, b) => {
                // 🔹 데미지 내림차순, 동점이면 정답 수 기준
                if (b.totalRaidDamage !== a.totalRaidDamage) {
                    return b.totalRaidDamage - a.totalRaidDamage;
                }
                return b.correctAnswers - a.correctAnswers;
            });
    }, [room, raidStats, students]);


    const raidRewards: RaidRewardRow[] = useMemo(
        () => buildRaidRewards(raidRanking),
        [raidRanking],
    );

    // 🔹 v2: 클래스 레이드용 공유 보스 HP 계산
    const {
        bossMaxHp,
        totalRaidDamage,
        bossHpRemaining,
        bossDefeated,
        raidParticipantCount,
    } = useMemo(() => {
        if (!room || room.game_key !== "quizmon") {
            return {
                bossMaxHp: 0,
                totalRaidDamage: 0,
                bossHpRemaining: 0,
                bossDefeated: false,
                raidParticipantCount: 0,
            };
        }

        const entries = Object.values(raidStats);
        const totalRaidDamage = entries.reduce(
            (sum, r) => sum + (r.totalRaidDamage ?? 0),
            0,
        );

        const raidParticipantCount = entries.length;
        const bossMaxHp = 1000 + raidParticipantCount * 200;

        const bossHpRemaining = Math.max(0, bossMaxHp - totalRaidDamage);

        const bossDefeated = bossHpRemaining <= 0 && bossMaxHp > 0;

        return {
            bossMaxHp,
            totalRaidDamage,
            bossHpRemaining,
            bossDefeated,
            raidParticipantCount,
        };
    }, [room, raidStats]);



    // DB quiz_questions.row -> QDD questionId 문자열로 변환
    function getQddKeyForQuestion(q: QuizQuestionRow): string | null {
        if (!qddQuestionPrefix) return null;
        const n = q.index_in_pack + 1;               // 0-based → 1-based
        const suffix = String(n).padStart(3, "0");   // 1 → "001"
        return `${qddQuestionPrefix}-${suffix}`;     // "Eng5_9-001"
    }


    // 🔹 스냅샷이 있다면 스냅샷 기준, 없으면 라이브 기준 값 사용
    const effectiveBossMaxHp =
        raidResultSnapshot?.bossMaxHp ?? bossMaxHp;
    const effectiveTotalRaidDamage =
        raidResultSnapshot?.totalRaidDamage ?? totalRaidDamage;
    const effectiveBossHpRemaining =
        raidResultSnapshot?.bossHpRemaining ?? bossHpRemaining;
    const effectiveRaidParticipantCount =
        raidResultSnapshot?.raidParticipantCount ?? raidParticipantCount;
    const effectiveBossDefeated =
        raidResultSnapshot?.bossDefeated ?? bossDefeated;

    // 랭킹 / 보상도 스냅샷 우선
    const effectiveRaidRanking =
        raidResultSnapshot?.ranking ?? raidRanking;
    const effectiveRaidRewards =
        raidResultSnapshot?.rewards ?? raidRewards;

    const effectiveBossProgress =
        effectiveBossMaxHp > 0
            ? Math.min(1, effectiveTotalRaidDamage / effectiveBossMaxHp)
            : 0;
    
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

    // 현재 퀴즈 세션과 연결된 game_sessions.id (QDD/QuizMon 공용)
    const [activeGameSessionId, setActiveGameSessionId] =
        useState<string | null>(null);

    // 🔹 QuizMon 레이드 세션 상태
    const [activeRaidSession, setActiveRaidSession] =
        useState<QuizmonRaidSessionRow | null>(null);
    const [raidSaving, setRaidSaving] = useState(false);

    // 🔹 레이드 보스 설정 (교사용 UI)
    const [raidBossSpeciesId, setRaidBossSpeciesId] = useState<string>("0001");
    const [raidBossLevel, setRaidBossLevel] = useState<number>(30);

    useEffect(() => {
        if (activeRaidSession) {
            setRaidBossSpeciesId(activeRaidSession.boss_species_id);
            setRaidBossLevel(activeRaidSession.boss_level);
        }
        // 레이드가 없을 때는 이전에 입력해둔 값 그대로 둠
    }, [activeRaidSession]);


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

    // 🔹 room / session 이 이미 있는 상태에서 들어온 교사도 game_sessions.id를 얻도록
    useEffect(() => {
        // ✅ 기본 가드: 아직 로드 안 됐으면 game_session도 비움
        if (!room || !pack || !session) {
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
    }, [
        room?.id,
        room?.game_key,
        pack?.id,
        session?.id,        // ✅ status 대신 id만 의존
    ]);



    // 🔹 QuizMon 레이드 세션 동기화
    useEffect(() => {
        if (
            !room ||
            room.game_key !== "quizmon" ||
            !room.class_id ||
            !activeGameSessionId
        ) {
            setActiveRaidSession(null);
            return;
        }

        let cancelled = false;

        const syncRaidSession = async () => {
            try {
                const raid = await getActiveRaidSession({
                    roomId: room.id,
                    gameSessionId: activeGameSessionId,
                });
                if (!cancelled) {
                    setActiveRaidSession(raid);
                }
            } catch (e) {
                console.error(
                    "[TeacherRoomLive] syncRaidSession error",
                    e,
                );
            }
        };

        void syncRaidSession();

        return () => {
            cancelled = true;
        };
    }, [room?.id, room?.class_id, room?.game_key, activeGameSessionId]);



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

            const requiresPack = roomData.game_key !== "pem";

            if (requiresPack && !roomData.quiz_pack_id) {
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
                .select("*")
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

            const rows = data as GameEventRow[];

            setQddStats(buildQddStats(rows));

            // ✅ 레이드가 열려 있지 않으면 기존 raidStats 스냅샷을 그대로 유지
            if (!activeRaidSession) {
                return;
            }

            const raidCreatedAt =
                (activeRaidSession as any).created_at as string | undefined;

            let raidRows = rows;

            if (raidCreatedAt) {
                raidRows = rows.filter((row) => {
                    // created_at 문자열 비교 (ISO 기준)
                    return row.created_at >= raidCreatedAt;
                });
            }

            console.log("[Raid] filtered events for current raid:", raidRows.length);
            setRaidStats(buildRaidStats(raidRows));

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
                    // 🔹 레이드 통계도 같이 반영
                    setRaidStats((prev) => {
                        if (!activeRaidSession) return prev;

                        const raidCreatedAt =
                            (activeRaidSession as any).created_at as string | undefined;

                        // created_at 없으면 그냥 반영
                        if (!raidCreatedAt) {
                            return applyRaidEvent(prev, row);
                        }

                        const createdAt = (row.created_at ?? "") as string;
                        // 현재 레이드 시작 이전에 찍힌 이벤트면 무시
                        if (createdAt < raidCreatedAt) return prev;

                        return applyRaidEvent(prev, row);
                    });
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
        activeRaidSession,
    ]);

    // 🔹 레이드 시작
    const handleStartRaid = async () => {
        // ✅ 조건 불만족 시 명확한 에러 메시지 표시
        if (!room) {
            setErrorMsg("방 정보를 불러오지 못했습니다.");
            return;
        }
        if (!room.class_id) {
            setErrorMsg("이 방은 반(class)에 연결되어 있지 않아 레이드를 열 수 없습니다. 방 설정에서 반을 연결해주세요.");
            return;
        }
        if (!activeGameSessionId) {
            setErrorMsg("게임 세션이 아직 준비되지 않았습니다. 퀴즈 세션을 먼저 시작해주세요.");
            return;
        }
        if (raidSaving) return;

        try {
            setRaidSaving(true);
            setErrorMsg(null);

            // ✅ 이전 레이드 결과 스냅샷 초기화
            setRaidResultSnapshot(null);

            const speciesId = (raidBossSpeciesId || "").trim() || "0001";
            const rawLevel = Number(raidBossLevel);
            const safeLevel = Number.isFinite(rawLevel)
                ? Math.max(1, Math.min(100, rawLevel))
                : 1;

            // 입력값을 한 번 정리해서 state에도 반영
            setRaidBossSpeciesId(speciesId);
            setRaidBossLevel(safeLevel);

            const raid = await createRaidSession({
                roomId: room.id,
                classId: room.class_id,
                gameSessionId: activeGameSessionId,
                bossSpeciesId: speciesId,
                bossLevel: safeLevel,
            });

            setActiveRaidSession(raid);
        } catch (err) {
            console.error("[TeacherRoomLive] handleStartRaid error", err);
            setErrorMsg("레이드를 시작하는 중 오류가 발생했습니다.");
        } finally {
            setRaidSaving(false);
        }
    };


    // 🔹 레이드 종료
    // 🔹 레이드 종료
    const handleEndRaid = async () => {
        if (!room || !activeGameSessionId) return;
        if (!activeRaidSession) return;
        if (raidSaving) return;

        const ok = window.confirm(
            "이 레이드를 종료하고, 현재까지의 누적 데미지 기준으로 보상을 계산할까요? (종료 후에는 이 레이드를 다시 열 수 없습니다.)",
        );
        if (!ok) return;

        // 🔹 이 시점의 raidRanking / 보스 상태가 스냅샷 기준
        const hadParticipants = raidRanking.length > 0;

        if (hadParticipants) {
            setRaidResultSnapshot({
                capturedAt: new Date().toISOString(),
                raidStats,
                ranking: raidRanking,
                rewards: raidRewards,
                bossMaxHp,
                totalRaidDamage,
                bossHpRemaining,
                bossDefeated,
                raidParticipantCount,
            });
        } else {
            setRaidResultSnapshot(null);
        }

        try {
            setRaidSaving(true);
            setErrorMsg(null);

            await closeActiveRaidSession({
                roomId: room.id,
                gameSessionId: activeGameSessionId,
            });

            // ✅ 이제 이 방에는 activeRaidSession 없음
            setActiveRaidSession(null);

            if (hadParticipants) {
                // ✅ 종료 직전 스냅샷 기준으로 모달 오픈
                setShowRaidRewardModal(true);
            } else {
                window.alert(
                    "이번 레이드에 참여한 학생이 아직 없어 보상 미리보기는 열지 않습니다.",
                );
            }
        } catch (err) {
            console.error("[TeacherRoomLive] handleEndRaid error", err);
            setErrorMsg("레이드를 종료하는 중 오류가 발생했습니다.");
        } finally {
            setRaidSaving(false);
        }
    };



    // 🔹 PEM 토너먼트 자동 편성 (단순 셔플 + 순서대로 매칭)
    const handleBuildPemTournament = () => {
        if (!pemRuns.length) {
            alert("PEM을 끝낸 학생 데이터가 아직 없습니다.");
            return;
        }

        // 예시: 정답 수 기준 내림차순 정렬 → 가볍게 셔플
        const sorted = [...pemRuns].sort(
            (a, b) => (b.total_correct ?? 0) - (a.total_correct ?? 0),
        );
        const shuffled = sorted.sort(() => Math.random() - 0.5);

        const matches: PemMatch[] = [];
        for (let i = 0; i + 1 < shuffled.length; i += 2) {
            const left = shuffled[i];
            const right = shuffled[i + 1];

            matches.push({
                id: `match-${i / 2}`,
                round: "예선",
                left,
                right,
            });
        }

        if (!matches.length) {
            alert("경기를 만들 수 있을 만큼 학생이 충분하지 않습니다.");
            return;
        }

        setPemBracket(matches);
        setCurrentPemMatchIndex(0);
    };


    // 🔹 현재 선택된 매치를 PEM iframe에 전달 → 관전 모드 시작
    const handleStartPemMatch = (index: number) => {
        const match = pemBracket[index];
        if (!match) return;
        if (!pemIframeRef.current) {
            alert("PEM 관전용 화면이 아직 로딩되지 않았습니다.");
            return;
        }

        const left = match.left;
        const right = match.right;

        const payload = {
            player: {
                starter: left.starter,
                pokemonName: left.pokemon_name,
                stage: left.stage,
                stats: {
                    atk: left.atk,
                    def: left.def,
                    skl: left.skl,
                    hp: left.hp,
                },
            },
            enemy: {
                starter: right.starter,
                pokemonName: right.pokemon_name,
                stage: right.stage,
                stats: {
                    atk: right.atk,
                    def: right.def,
                    skl: right.skl,
                    hp: right.hp,
                },
            },
            meta: {
                title: `${match.round} · ${left.nickname ?? left.student_key} vs ${
                    right.nickname ?? right.student_key
                }`,
                week: left.week_reached ?? 8,
            },
        };

        // 🔸 PEM.html 안에는, 아래 메시지를 받아서 Game.startSpectatorBattle(payload)를 호출하는
        // window.addEventListener("message", ...) 핸들러가 필요함
        pemIframeRef.current.contentWindow?.postMessage(
            {
                type: "PEM_START_SPECTATOR_BATTLE",
                payload,
            },
            "*",
        );

        setCurrentPemMatchIndex(index);
    };



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

    const allPlayStudentsSelected =
        playStudents.length > 0 &&
        selectedPlayStudentIds.length === playStudents.length;


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

    // 🔹 레이드 보상안 텍스트로 복사
    const handleCopyRaidRewards = async () => {
        if (!effectiveRaidRewards.length) return;

        const header = "클래스 레이드 보상안\n";
        const bodyLines = effectiveRaidRewards.map((r, idx) => {
            const name = r.nickname ?? r.studentKey ?? "무명 트레이너";
            return `${idx + 1}위 ${name} — 정답 ${r.correctAnswers}/${r.totalAnswers}, 데미지 ${r.totalRaidDamage}, 보상 젬 ${r.gems}개`;
        });

        const text = `${header}\n${bodyLines.join("\n")}`;

        try {
            await navigator.clipboard.writeText(text);
            setRewardCopyMsg("보상안이 클립보드에 복사되었습니다.");
            setTimeout(() => setRewardCopyMsg(null), 2000);
        } catch (err) {
            console.error("[TeacherRoomLive] copy raid rewards error", err);
            setErrorMsg("보상안을 복사하는 중 문제가 발생했습니다. 직접 선택해서 복사해주세요.");
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
                    {/* 반 학생 지갑 / 보상 지급 */}
                    {room.class_id && (
                        <div className="card">
                            <h2>이 반 학생 지갑 / 보상 지급</h2>
                            <p className="hint">
                                이 반에서 한 번이라도 입장한 학생(기기) 목록입니다. 선택한 학생들에게
                                코인/젬/조각을 한 번에 지급할 수 있습니다.
                            </p>

                            {playStudentsLoading ? (
                                <p style={{ marginTop: "0.5rem" }}>
                                    학생 지갑 정보를 불러오는 중입니다...
                                </p>
                            ) : playStudents.length === 0 ? (
                                <p className="hint" style={{ marginTop: "0.5rem" }}>
                                    아직 이 반에서 접속한 학생이 없습니다. 학생이 한 번이라도
                                    입장하면 자동으로 목록에 나타납니다.
                                </p>
                            ) : (
                                <>
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            marginTop: "0.5rem",
                                            marginBottom: "0.25rem",
                                            fontSize: "0.85rem",
                                        }}
                                    >
                                        <div>
                                            선택된 학생:{" "}
                                            <strong>
                                                {selectedPlayStudentIds.length} / {playStudents.length}
                                            </strong>
                                        </div>
                                        <button
                                            type="button"
                                            className="secondary-btn"
                                            onClick={toggleSelectAllPlayStudents}
                                        >
                                            {allPlayStudentsSelected ? "전체 해제" : "전체 선택"}
                                        </button>
                                    </div>

                                    <ul
                                        style={{
                                            listStyle: "none",
                                            padding: 0,
                                            margin: 0,
                                            maxHeight: "180px",
                                            overflow: "auto",
                                            borderRadius: "0.5rem",
                                            border: "1px solid var(--border-subtle)",
                                        }}
                                    >
                                        {playStudents.map((ps) => {
                                            const checked = selectedPlayStudentIds.includes(ps.id);
                                            return (
                                                <li
                                                    key={ps.id}
                                                    style={{
                                                        borderBottom:
                                                            "1px solid var(--border-subtle)",
                                                    }}
                                                >
                                                    <label
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "0.5rem",
                                                            padding: "0.3rem 0.5rem",
                                                            fontSize: "0.8rem",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() =>
                                                                togglePlayStudentSelection(ps.id)
                                                            }
                                                            style={{ margin: 0 }}
                                                        />
                                                        <div style={{ flex: 1 }}>
                                                            <div>
                                                                <strong>
                                                                    {ps.nickname ?? "이름 없음"}
                                                                </strong>{" "}
                                                                (
                                                                {ps.student_key.slice(-4)}
                                                                )
                                                            </div>
                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    gap: "0.5rem",
                                                                    color: "var(--text-sub)",
                                                                    marginTop: "0.1rem",
                                                                }}
                                                            >
                                                                <span>코인 {ps.coins}</span>
                                                            </div>
                                                        </div>
                                                    </label>
                                                </li>
                                            );
                                        })}
                                    </ul>

                                    <form
                                        onSubmit={handleGrantWallet}
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "0.4rem",
                                            marginTop: "0.6rem",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: "0.5rem",
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            <label
                                                className="form-field"
                                                style={{
                                                    flex: "1 1 80px",
                                                    minWidth: "80px",
                                                    fontSize: "0.8rem",
                                                }}
                                            >
                                                <span>코인 +</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={walletCoinsDelta}
                                                    onChange={(e) =>
                                                        setWalletCoinsDelta(
                                                            Math.max(
                                                                0,
                                                                Number(e.target.value) || 0,
                                                            ),
                                                        )
                                                    }
                                                />
                                            </label>
                                            <label
                                                className="form-field"
                                                style={{
                                                    flex: "1 1 80px",
                                                    minWidth: "80px",
                                                    fontSize: "0.8rem",
                                                }}
                                            >
                                                <span>젬 +</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={walletGemsDelta}
                                                    onChange={(e) =>
                                                        setWalletGemsDelta(
                                                            Math.max(
                                                                0,
                                                                Number(e.target.value) || 0,
                                                            ),
                                                        )
                                                    }
                                                />
                                            </label>
                                            <label
                                                className="form-field"
                                                style={{
                                                    flex: "1 1 80px",
                                                    minWidth: "80px",
                                                    fontSize: "0.8rem",
                                                }}
                                            >
                                                <span>조각 +</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={walletStarShardsDelta}
                                                    onChange={(e) =>
                                                        setWalletStarShardsDelta(
                                                            Math.max(
                                                                0,
                                                                Number(e.target.value) || 0,
                                                            ),
                                                        )
                                                    }
                                                />
                                            </label>
                                        </div>

                                        <button
                                            type="submit"
                                            className="primary-btn"
                                            disabled={
                                                walletSaving ||
                                                selectedPlayStudentIds.length === 0
                                            }
                                        >
                                            {walletSaving
                                                ? "보상 지급 중..."
                                                : "선택한 학생에게 보상 지급"}
                                        </button>
                                        <p className="hint" style={{ marginTop: "0.2rem" }}>
                                            * 이 버튼은 `grant_play_student_wallet` RPC를 호출해
                                            DB의 <code>play_students</code> 지갑을 바로 업데이트합니다.
                                        </p>
                                    </form>
                                </>
                            )}
                        </div>
                    )}


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
                                <h2>
                                    {room.game_key === "qdd" ? "QDD" : "퀴즈몬"} 실시간 통계 (game_events)
                                </h2>
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

                    {/* 🔹 QuizMon 클래스 레이드 v2 – 레이드 컨트롤 + 공유 보스 HP + 랭킹 */}
                    {room?.game_key === "quizmon" && session && (
                        <>
                            {/* 레이드 컨트롤 패널 */}
                            <div className="card" style={{ marginTop: "1rem" }}>
                                <h2>QuizMon 레이드 컨트롤</h2>
                                <p className="hint">
                                    이 세션 동안 진행할 레이드를 시작/종료합니다. 레이드가 열려 있어야
                                    학생 쪽에서 &quot;레이드&quot; 버튼이 활성화됩니다.
                                </p>

                                {/* 게임 세션 준비 상태 표시 */}
                                {!activeGameSessionId && (
                                    <div
                                        style={{
                                            marginTop: "0.5rem",
                                            padding: "0.75rem",
                                            borderRadius: 8,
                                            background: "#1e293b",
                                            border: "1px solid #f59e0b",
                                            fontSize: "0.85rem",
                                            color: "#fbbf24",
                                        }}
                                    >
                                        ⏳ 게임 세션을 준비하는 중입니다... 잠시 기다려주세요.
                                    </div>
                                )}

                                {activeGameSessionId && (
                                    <div
                                        style={{
                                            marginTop: "0.5rem",
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: "0.75rem",
                                            justifyContent: "space-between",
                                            alignItems: "flex-end",
                                        }}
                                    >
                                        {/* 왼쪽: 보스 설정 폼 */}
                                        <div
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "0.4rem",
                                                flex: "1 1 220px",
                                                maxWidth: "340px",
                                            }}
                                        >
                                            <label
                                                className="form-field"
                                                style={{ fontSize: "0.85rem" }}
                                            >
                                                <span>보스 종 ID</span>
                                                <input
                                                    type="text"
                                                    value={raidBossSpeciesId}
                                                    onChange={(e) =>
                                                        setRaidBossSpeciesId(e.target.value)
                                                    }
                                                    placeholder="예: 0001"
                                                    disabled={!!activeRaidSession || raidSaving}
                                                />
                                            </label>
                                            <label
                                                className="form-field"
                                                style={{ fontSize: "0.85rem" }}
                                            >
                                                <span>보스 레벨</span>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={100}
                                                    value={raidBossLevel}
                                                    onChange={(e) =>
                                                        setRaidBossLevel(
                                                            Number(e.target.value) || 1,
                                                        )
                                                    }
                                                    disabled={!!activeRaidSession || raidSaving}
                                                />
                                            </label>
                                            <p className="hint" style={{ marginTop: "0.1rem" }}>
                                                * 종 ID는 나중에 실제 도감 데이터(예: 0001, 0004)와
                                                연결할 예정입니다.
                                            </p>
                                        </div>

                                        {/* 오른쪽: 상태 + 버튼 */}
                                        <div
                                            style={{
                                                flex: "0 0 auto",
                                                minWidth: "170px",
                                                textAlign: "right",
                                            }}
                                        >
                                            {activeRaidSession ? (
                                                <>
                                                    <div
                                                        style={{
                                                            fontSize: "0.85rem",
                                                            marginBottom: "0.35rem",
                                                        }}
                                                    >
                                                        <div>
                                                            <strong>상태:</strong> 진행 중
                                                        </div>
                                                        <div>
                                                            <strong>보스:</strong>{" "}
                                                            {activeRaidSession.boss_species_id}{" "}
                                                            (Lv.{activeRaidSession.boss_level})
                                                        </div>
                                                    </div>
                                                    <button
                                                        className="btn btn-secondary"
                                                        onClick={handleEndRaid}
                                                        disabled={raidSaving}
                                                    >
                                                        레이드 종료
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <div
                                                        style={{
                                                            fontSize: "0.85rem",
                                                            marginBottom: "0.35rem",
                                                        }}
                                                    >
                                                        {!session || session.status !== "running" ? (
                                                            <span style={{ color: "#f59e0b" }}>
                                                                퀴즈 세션을 먼저 시작해주세요.
                                                            </span>
                                                        ) : !room?.class_id ? (
                                                            <span style={{ color: "#f59e0b" }}>
                                                                방에 반(class)이 연결되어 있지 않습니다.
                                                            </span>
                                                        ) : (
                                                            "현재 열린 레이드가 없습니다."
                                                        )}
                                                    </div>
                                                    <button
                                                        className="btn btn-primary"
                                                        onClick={handleStartRaid}
                                                        disabled={
                                                            raidSaving ||
                                                            !session ||
                                                            session.status !== "running" ||
                                                            !room?.class_id
                                                        }
                                                    >
                                                        레이드 오픈
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 공유 보스 HP 카드 */}
                            <div className="card" style={{ marginTop: "1rem" }}>
                                <h2>클래스 레이드 v2 — 보스 HP</h2>
                                <p className="hint">
                                    현재 세션 동안 퀴즈몬 정답으로 누적된 데미지를 모아 공유 보스 HP를
                                    깎습니다. (임시 HP = 1000 + 학생 수 × 200)
                                </p>

                                <div
                                    style={{
                                        marginTop: "0.75rem",
                                        padding: "0.6rem 0.8rem",
                                        borderRadius: 8,
                                        border: "1px solid #111827",
                                        background: "#020617",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            fontSize: 13,
                                        }}
                                    >
                                        <span style={{ fontWeight: 600 }}>Boss HP</span>
                                        <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        {effectiveBossHpRemaining} / {effectiveBossMaxHp}
                    </span>
                                    </div>

                                    {/* HP 바 */}
                                    <div
                                        style={{
                                            marginTop: 6,
                                            height: 10,
                                            borderRadius: 999,
                                            background: "#111827",
                                            overflow: "hidden",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: `${effectiveBossProgress * 100}%`,
                                                height: "100%",
                                                background: bossDefeated
                                                    ? "linear-gradient(90deg,#22c55e,#a3e635)"
                                                    : "linear-gradient(90deg,#ef4444,#f97316)",
                                                transition: "width 0.25s ease-out",
                                            }}
                                        />
                                    </div>

                                    {/* 상태 텍스트 */}
                                    <div
                                        style={{
                                            marginTop: 4,
                                            display: "flex",
                                            justifyContent: "space-between",
                                            fontSize: 11,
                                            color: "#9ca3af",
                                        }}
                                    >
                                   <span>
                                    누적 데미지: <strong>{effectiveTotalRaidDamage}</strong>{" "}
                                        / 필요 데미지: <strong>{effectiveBossMaxHp}</strong>
                                    </span>
                                        <span>
                                      참여 학생: <strong>{effectiveRaidParticipantCount}명</strong>
                                    </span>

                                    </div>

                                    {/* 레이드 상태 메시지 */}
                                    <div
                                        style={{
                                            marginTop: 6,
                                            fontSize: 12,
                                            color:
                                                raidParticipantCount === 0
                                                    ? "#e5e7eb"
                                                    : bossDefeated
                                                        ? "#a3e635"
                                                        : "#e5e7eb",
                                            fontWeight: 500,
                                        }}
                                    >
                                        {effectiveRaidParticipantCount === 0 ? (
                                            <>아직 레이드에 참여한 학생이 없습니다. 퀴즈 정답이 쌓이면 보스 HP가 줄어듭니다.</>
                                        ) : effectiveBossDefeated ? (
                                            <>✅ 보스가 쓰러졌습니다! (보상 분배 UI는 추후 연동 예정)</>
                                        ) : (
                                            <>학생들이 정답을 맞출수록 보스 HP가 줄어듭니다.</>
                                        )}
                                    </div>

                                    {/* v2 테스트용 간단 메뉴 버튼 */}
                                    <div
                                        style={{
                                            marginTop: 8,
                                            display: "flex",
                                            justifyContent: "flex-end",
                                            gap: 8,
                                            fontSize: 12,
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRaidStats({});
                                                setRaidResultSnapshot(null);
                                            }}
                                            style={{
                                                padding: "0.3rem 0.7rem",
                                                borderRadius: 999,
                                                border: "1px solid #4b5563",
                                                background: "#020617",
                                                color: "#e5e7eb",
                                                cursor: "pointer",
                                            }}
                                        >
                                            레이드 초기화
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowRaidRewardModal(true)}
                                            disabled={effectiveRaidRanking.length === 0}
                                            style={{
                                                padding: "0.3rem 0.7rem",
                                                borderRadius: 999,
                                                border: "1px solid #b91c1c",
                                                background:
                                                    effectiveRaidRanking.length === 0
                                                        ? "linear-gradient(90deg,#4b5563,#6b7280)"
                                                        : effectiveBossDefeated
                                                            ? "linear-gradient(90deg,#b91c1c,#f97316)"
                                                            : "linear-gradient(90deg,#4b5563,#6b7280)",
                                                color: "#fef2f2",
                                                cursor:
                                                    effectiveRaidRanking.length === 0 ? "not-allowed" : "pointer",
                                                fontWeight: 600,
                                                opacity: effectiveRaidRanking.length === 0 ? 0.6 : 1,
                                            }}
                                        >
                                            보상 메뉴 열기
                                        </button>

                                    </div>
                                </div>
                            </div>

                            {/* 🔹 QuizMon 클래스 레이드 — 보상 미리보기 모달 */}
                            {showRaidRewardModal && (
                                <div
                                    style={{
                                        position: "fixed",
                                        inset: 0,
                                        background: "rgba(15, 23, 42, 0.8)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        zIndex: 1002,
                                        padding: "1rem",
                                    }}
                                >
                                    <div
                                        className="card"
                                        style={{
                                            width: "100%",
                                            maxWidth: "780px",
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
                                                marginBottom: "0.4rem",
                                            }}
                                        >
                                            <h2 style={{ marginBottom: 0 }}>
                                                클래스 레이드 보상 미리보기
                                            </h2>
                                            <button
                                                type="button"
                                                className="secondary-btn"
                                                onClick={() => setShowRaidRewardModal(false)}
                                            >
                                                닫기
                                            </button>
                                        </div>

                                        <p className="hint" style={{ marginBottom: "0.6rem" }}>
                                            이 화면은 이번 레이드 결과를 바탕으로 한{" "}
                                            <strong>추천 보상안</strong>입니다. 실제 지급은 아래
                                            숫자를 참고해 선생님이 결정하거나, 왼쪽{" "}
                                            <strong>반 학생 지갑 / 보상 지급</strong> 카드에서
                                            선택한 학생에게 젬을 지급해 주세요.
                                        </p>

                                        <div
                                            style={{
                                                fontSize: "0.85rem",
                                                marginBottom: "0.5rem",
                                                display: "flex",
                                                flexWrap: "wrap",
                                                gap: "0.75rem",
                                            }}
                                        >
                                      <span>
                                         보스 HP:{" "}
                                     <strong>
                                          {effectiveBossHpRemaining} / {effectiveBossMaxHp}
                                         </strong>
                                    </span>
                                            <span>
                                        누적 데미지: <strong>{effectiveTotalRaidDamage}</strong>
                                    </span>
                                            <span>
                                         참여 학생: <strong>{effectiveRaidParticipantCount}명</strong>
                                    </span>
                                            <span>
                                        보스 상태:{" "}
                                                {effectiveBossDefeated ? (
                                                    <strong style={{ color: "#a3e635" }}>격파</strong>
                                                ) : (
                                                    <strong style={{ color: "#f97316" }}>생존</strong>
                                                )}
                                    </span>

                                        </div>

                                        {effectiveRaidRewards.length === 0 ? (
                                            <p className="hint">
                                                아직 집계된 레이드 데이터가 없습니다.
                                            </p>
                                        ) : (
                                            <>
                                                <div
                                                    style={{
                                                        overflowX: "auto",
                                                        marginBottom: "0.75rem",
                                                    }}
                                                >
                                                    <table className="simple-table">
                                                        <thead>
                                                        <tr>
                                                            <th>#</th>
                                                            <th>학생</th>
                                                            <th>정답 수</th>
                                                            <th>정답률</th>
                                                            <th>누적 데미지</th>
                                                            <th>추천 젬</th>
                                                        </tr>
                                                        </thead>
                                                        <tbody>
                                                        {effectiveRaidRewards.map((r, idx) => (
                                                            <tr key={r.studentKey ?? idx}>
                                                                <td>{idx + 1}</td>
                                                                <td>{r.nickname ?? r.studentKey}</td>
                                                                <td>
                                                                    {r.correctAnswers} /{" "}
                                                                    {r.totalAnswers}
                                                                </td>
                                                                <td>{r.accuracy}%</td>
                                                                <td>{r.totalRaidDamage}</td>
                                                                <td>{r.gems}</td>
                                                            </tr>
                                                        ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                <div
                                                    style={{
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "center",
                                                        gap: "0.5rem",
                                                    }}
                                                >
                                                    <p className="hint" style={{ margin: 0 }}>
                                                        * 상단 숫자는 임시 규칙
                                                        (기본 1젬 + 데미지에 따른 보너스 + 상위 3명
                                                        추가 1젬)으로 계산된 값입니다.
                                                    </p>
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            gap: "0.5rem",
                                                            alignItems: "center",
                                                        }}
                                                    >
                                                        {rewardCopyMsg && (
                                                            <span
                                                                style={{
                                                                    fontSize: "0.8rem",
                                                                    color: "var(--accent)",
                                                                }}
                                                            >
                                    {rewardCopyMsg}
                                </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className="secondary-btn"
                                                            onClick={handleCopyRaidRewards}
                                                        >
                                                            보상안 복사하기
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                        </>
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
                        <QuizmonProvider
                            classId={room.class_id ?? null}
                            studentId={null} // 교사 화면이라 학생 프로필 없음
                        >
                            <QuizMonClassPanel
                                roomId={room.id}
                                pack={pack}
                                session={quizMonSession}
                                classId={room.class_id}
                                // onQuizAnswer는 나중에 game_events 연동할 때 여기서 넘겨줄 예정
                            />
                        </QuizmonProvider>
                    </div>
                </div>
            )}

            {/* 🔹 PEM 토너먼트 관전 섹션 */}
            {room && (
                <div className="card" style={{ marginTop: "1rem" }}>
                    <h2>PEM 토너먼트 관전</h2>
                    <p className="hint">
                        학생들이 PEM을 끝까지 플레이하면, 그 결과가 이곳에 저장됩니다.
                        아래 버튼으로 자동 토너먼트를 편성하고, 왼쪽 화면에서는 전투 씬을,
                        오른쪽에서는 현재 경기와 토너먼트 구성을 함께 볼 수 있습니다.
                    </p>

                    {/* 상단 요약 + 편성 버튼 */}
                    <div
                        style={{
                            marginTop: "0.5rem",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "0.5rem",
                        }}
                    >
                        <div style={{ fontSize: "0.9rem" }}>
                            PEM 클리어 데이터:{" "}
                            <strong>{pemRuns.length}</strong>명
                            {pemRunsLoading && (
                                <span style={{ marginLeft: "0.5rem" }}>(불러오는 중...)</span>
                            )}
                        </div>
                        <button
                            type="button"
                            className="secondary-btn"
                            onClick={handleBuildPemTournament}
                        >
                            토너먼트 자동 편성
                        </button>
                    </div>

                    {/* 🔹 메인 영역: 왼쪽 = 전투 씬, 오른쪽 = 현재 경기 + 브래킷 */}
                    <div
                        style={{
                            marginTop: "0.75rem",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "1rem",
                            alignItems: "stretch",
                        }}
                    >
                        {/* 왼쪽: 관전용 PEM iframe */}
                        <div
                            style={{
                                flex: "1 1 360px",
                                minWidth: 0,
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "0.8rem",
                                    marginBottom: "0.25rem",
                                    color: "var(--text-sub)",
                                }}
                            >
                                왼쪽 화면에 PEM 게임(관전 모드)을 띄워주세요.
                            </div>
                            <iframe
                                ref={pemIframeRef}
                                src="https://unluckyidiot16.github.io/WebGames/PEM/PEM.html"
                                style={{
                                    width: "100%",
                                    maxWidth: "640px",
                                    border: "none",
                                    borderRadius: "1rem",
                                    aspectRatio: "16 / 9",
                                    background: "#000",
                                    marginTop: "0.25rem",
                                }}
                                allow="fullscreen"
                            />
                        </div>

                        {/* 오른쪽: 현재 경기 카드 + 토너먼트 리스트 */}
                        <div
                            style={{
                                flex: "1 1 320px",
                                minWidth: 0,
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.75rem",
                            }}
                        >
                            {/* 현재 경기 카드 */}
                            {pemBracket.length > 0 && (
                                (() => {
                                    const safeIndex =
                                        currentPemMatchIndex != null
                                            ? currentPemMatchIndex
                                            : 0;
                                    const current = pemBracket[safeIndex];
                                    if (!current) return null;

                                    const leftName =
                                        current.left.nickname ?? current.left.student_key;
                                    const rightName =
                                        current.right.nickname ?? current.right.student_key;

                                    return (
                                        <div
                                            style={{
                                                padding: "0.75rem 0.85rem",
                                                borderRadius: "0.9rem",
                                                background:
                                                    "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(129,140,248,0.18))",
                                                border:
                                                    "1px solid rgba(129,140,248,0.5)",
                                                boxShadow:
                                                    "0 14px 30px rgba(15,23,42,0.35)",
                                                transform: "translateY(-2px)",
                                                transition:
                                                    "transform 0.25s ease-out, box-shadow 0.25s ease-out",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: "0.8rem",
                                                    color: "var(--text-sub)",
                                                    marginBottom: "0.25rem",
                                                }}
                                            >
                                                현재 경기
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "0.95rem",
                                                    fontWeight: 700,
                                                    marginBottom: "0.35rem",
                                                }}
                                            >
                                                {current.round}
                                            </div>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    gap: "0.5rem",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        flex: "1 1 0",
                                                        textAlign: "left",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            fontSize: "0.75rem",
                                                            opacity: 0.7,
                                                            marginBottom: "0.1rem",
                                                        }}
                                                    >
                                                        플레이어 1
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontWeight: 700,
                                                            fontSize: "0.9rem",
                                                        }}
                                                    >
                                                        {leftName}
                                                    </div>
                                                </div>
                                                <div
                                                    style={{
                                                        padding: "0 0.5rem",
                                                        fontSize: "0.8rem",
                                                        opacity: 0.8,
                                                    }}
                                                >
                                                    VS
                                                </div>
                                                <div
                                                    style={{
                                                        flex: "1 1 0",
                                                        textAlign: "right",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            fontSize: "0.75rem",
                                                            opacity: 0.7,
                                                            marginBottom: "0.1rem",
                                                        }}
                                                    >
                                                        플레이어 2
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontWeight: 700,
                                                            fontSize: "0.9rem",
                                                        }}
                                                    >
                                                        {rightName}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()
                            )}

                            {/* 토너먼트 매치 리스트 (간단 브래킷 + 상승 느낌 애니메이션) */}
                            {pemBracket.length > 0 && (
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "0.85rem",
                                            color: "var(--text-sub)",
                                        }}
                                    >
                                        편성된 경기 수:{" "}
                                        <strong>{pemBracket.length}</strong>
                                    </div>
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
                                        {pemBracket.map((m, idx) => {
                                            const leftName =
                                                m.left.nickname ?? m.left.student_key;
                                            const rightName =
                                                m.right.nickname ?? m.right.student_key;
                                            const isCurrent =
                                                currentPemMatchIndex === idx;

                                            return (
                                                <li
                                                    key={m.id}
                                                    style={{
                                                        padding: "0.45rem 0.6rem",
                                                        borderRadius: "0.6rem",
                                                        border:
                                                            "1px solid var(--border-subtle, #1f2937)",
                                                        backgroundColor: isCurrent
                                                            ? "rgba(79,70,229,0.12)"
                                                            : "rgba(15,23,42,0.55)",
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "center",
                                                        gap: "0.5rem",
                                                        boxShadow: isCurrent
                                                            ? "0 10px 24px rgba(15,23,42,0.45)"
                                                            : "none",
                                                        transform: isCurrent
                                                            ? "translateY(-4px)"
                                                            : "translateY(0)",
                                                        transition:
                                                            "transform 0.25s ease-out, box-shadow 0.25s ease-out, background-color 0.25s ease-out, border-color 0.25s ease-out",
                                                    }}
                                                >
                                        <span
                                            style={{
                                                fontSize: "0.82rem",
                                                flex: "1 1 auto",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}
                                        >
                                            <strong>{m.round}</strong> ·{" "}
                                            {leftName} vs {rightName}
                                        </span>
                                                    <button
                                                        type="button"
                                                        className="secondary-btn"
                                                        style={{
                                                            fontSize: "0.8rem",
                                                            padding: "0.3rem 0.6rem",
                                                            flexShrink: 0,
                                                        }}
                                                        onClick={() =>
                                                            handleStartPemMatch(idx)
                                                        }
                                                    >
                                                        이 경기 시작
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}

                            {pemBracket.length === 0 && (
                                <div
                                    style={{
                                        fontSize: "0.8rem",
                                        color: "var(--text-sub)",
                                    }}
                                >
                                    아직 편성된 경기가 없습니다. 위의{" "}
                                    <strong>토너먼트 자동 편성</strong> 버튼을 눌러
                                    경기를 만들어 주세요.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}


            {/* 🔹 세션 전체 요약 (문항별 정답률 표) */}
            {session && (
                <div className="card" style={{ marginTop: "1rem" }}>
                    <SessionSummaryPanel
                        sessionId={session.id}
                        questions={questions}
                        // QDD / QuizMon 방일 때는 game_events 기반 통계도 함께 더해줌
                        qddStatsByQuestion={
                            room?.game_key === "qdd" ||
                            room?.game_key === "quizmon"
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