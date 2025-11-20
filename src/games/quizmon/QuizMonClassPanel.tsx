// src/games/quizmon/QuizMonClassPanel.tsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import type {
    QuizPackRow,
    QuizQuestionRow,
} from "../../pages/student/StudentPlayPackPage";
import type {
    QuizPackJsonV1,
    QuizPackQuestionV1,
} from "../../types/quizPackJson";
import { QuizMonGame } from "./QuizMonGame";
import type { QuizAnswerResult } from "./types";
import { useQuizmonProfile } from "./useQuizmonProfile";
import { useQuizmonCollection } from "./useQuizmonCollection";
import { StarterSelectPanel } from "./StarterSelectPanel";

type SessionRow = {
    id: string;
    status: "pending" | "running" | "ended";
    current_index: number | null;
};

type QuizMonClassPanelProps = {
    roomId: string | null;
    pack: QuizPackRow | null;
    session: SessionRow | null;

    /** React 게임(학생 화면)에서만 사용: Supabase game_events 연동용 */
    gameSessionId?: string | null;
    studentId?: string | null;

    // ⭐ StudentRoomPage / TeacherRoomLivePage 쪽에서 넘겨줄 콜백
    onQuizAnswer?: (result: QuizAnswerResult) => void;
};

type LastRaidResult = {
    correct: number;
    total: number;
};

const LEVEL_CAP = 10;
const expNeededForLevel = (level: number) => 5 * level;

export function QuizMonClassPanel(props: QuizMonClassPanelProps) {
    const {
        roomId,
        pack,
        session,
        gameSessionId,
        studentId,
        onQuizAnswer,
    } = props;

    const [quizpack, setQuizpack] = useState<QuizPackJsonV1 | null>(null);
    const [quizLoading, setQuizLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [lastRaidResult, setLastRaidResult] =
        useState<LastRaidResult | null>(null);

    const isStudent = !!studentId;

    // 🔹 Quizmon 프로필 (학생일 때만 의미 있음)
    const {
        profile,
        loading: profileLoading,
        applyRaidResult,
        chooseStarter,
    } = useQuizmonProfile({
        studentKey: studentId ?? null,
    });

    const partner = profile?.partner ?? null;
    let expNeeded = 0;
    let expRatio = 0;

    // 🔹 컬렉션 / 가챠 (학생일 때만 실제로 데이터가 채워짐)
    const {
        monsters,
        loading: collLoading,
        error: collError,
        pullFreeGacha,
    } = useQuizmonCollection({ profileId: profile?.id ?? null });

    const handleBattleEnd = async (summary: { correct: number; total: number }) => {
        if (!studentId) return; // 교사 미리보기 방지

        setLastRaidResult(summary);
        await applyRaidResult(summary); // quizmon_profiles 갱신
    };

    if (partner) {
        if (partner.level >= LEVEL_CAP) {
            expNeeded = 1;
            expRatio = 1;
        } else {
            expNeeded = expNeededForLevel(partner.level);
            expRatio =
                expNeeded > 0
                    ? Math.max(0, Math.min(1, partner.exp / expNeeded))
                    : 0;
        }
    }

    // 🎯 1) 퀴즈팩이 바뀔 때마다 quiz_questions → QuizPackJsonV1 로딩
    useEffect(() => {
        if (!pack?.id) {
            setQuizpack(null);
            return;
        }

        let cancelled = false;

        const loadQuestions = async () => {
            setQuizLoading(true);
            setErrorMsg(null);

            const { data, error } = await supabase
                .from("quiz_questions")
                .select(
                    "id, pack_id, index_in_pack, prompt, options, answer_index",
                )
                .eq("pack_id", pack.id)
                .order("index_in_pack", { ascending: true });

            if (cancelled) return;

            if (error) {
                console.error(
                    "[QuizMonClassPanel] load quiz_questions error",
                    error,
                );
                setErrorMsg("퀴즈를 불러오는 중 오류가 발생했습니다.");
                setQuizpack(null);
                setQuizLoading(false);
                return;
            }

            const rows = (data ?? []) as QuizQuestionRow[];

            const questions: QuizPackQuestionV1[] = rows.map((row, idx) => ({
                id: row.id,
                index:
                    typeof (row as any).index_in_pack === "number"
                        ? (row as any).index_in_pack
                        : idx,
                prompt: row.prompt ?? "",
                options: (row.options ?? []) as string[],
                answerIndex: row.answer_index ?? 0,
                difficulty: null,
                tags: null,
                explanation: null,
                type: "choice",
            }));

            const qp: QuizPackJsonV1 = {
                type: "quizpack",
                version: "v1",
                pack: {
                    id: pack.id,
                    title: pack.title,
                    subject: pack.subject,
                    grade: pack.grade,
                    description: null,
                },
                questions,
            };

            setQuizpack(qp);
            setQuizLoading(false);
        };

        void loadQuestions();

        return () => {
            cancelled = true;
        };
    }, [pack?.id]);

    // =========================
    // ✅ 2) 상태별 가드 (Hook 호출 이후)
    // =========================

    // 🔐 학생인 경우: 프로필/스타터 선택 가드
    if (isStudent) {
        if (!profile || profileLoading) {
            return <p>프로필을 불러오는 중입니다...</p>;
        }

        if (!profile.starter_chosen) {
            return (
                <StarterSelectPanel
                    disabled={profileLoading}
                    onChooseStarter={async (speciesId) => {
                        await chooseStarter(speciesId);
                        // chooseStarter 내부에서 profile 갱신 → 다음 렌더부터는 로비/배틀 UI로 전환
                    }}
                />
            );
        }
    }

    if (!pack) {
        return (
            <p>
                이 방에는 아직 <strong>퀴즈팩</strong>이 연결되어 있지 않습니다.
                <br />
                선생님이 퀴즈팩을 선택하면 퀴즈몬 전투가 시작됩니다.
            </p>
        );
    }

    if (!session || session.status === "pending") {
        return (
            <p>
                선생님이 아직 <strong>퀴즈몬 게임</strong>을 시작하지 않았습니다.
                <br />
                수업이 시작되면 이 위치에 전투 화면이 표시됩니다.
            </p>
        );
    }

    if (session.status === "ended") {
        return <p>이 수업의 퀴즈몬 게임이 종료되었습니다.</p>;
    }

    // 여기까지 왔으면 session.status === "running"
    if (quizLoading || !quizpack) {
        return <p>퀴즈 데이터를 불러오는 중입니다…</p>;
    }

    if (errorMsg) {
        return (
            <p className="form-message error" style={{ marginTop: "0.5rem" }}>
                {errorMsg}
            </p>
        );
    }

    // 🎯 3) 실제 퀴즈몬 전투 컴포넌트
    return (
        <div>
            <QuizMonGame
                quizpack={quizpack}
                onQuizAnswer={onQuizAnswer}
                roomId={roomId}
                gameSessionId={gameSessionId}
                studentId={studentId}
                onBattleEnd={studentId ? handleBattleEnd : undefined}
            />

            {/* 🔹 레이드 결과 + 내 파트너 레벨/EXP (학생 전용) */}
            {isStudent && partner && lastRaidResult && (
                <section
                    className="card"
                    style={{
                        marginTop: "1rem",
                        padding: "0.75rem",
                        borderRadius: 8,
                        border: "1px solid #444",
                        background: "#111",
                        color: "#eee",
                    }}
                >
                    <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
                        이번 레이드 결과
                    </h3>

                    <p style={{ margin: 0, fontSize: 14 }}>
                        정답 {lastRaidResult.correct} / {lastRaidResult.total} (
                        {lastRaidResult.total > 0
                            ? Math.round(
                                (lastRaidResult.correct /
                                    lastRaidResult.total) *
                                100,
                            )
                            : 0}
                        %)
                    </p>

                    <div style={{ marginTop: "0.75rem" }}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "baseline",
                            }}
                        >
                            <strong>내 파트너</strong>
                            <span
                                style={{
                                    fontSize: 13,
                                    color: "#ccc",
                                }}
                            >
                                Lv. {partner.level}
                            </span>
                        </div>

                        <div
                            style={{
                                marginTop: 4,
                                background: "#222",
                                borderRadius: 999,
                                overflow: "hidden",
                                height: 10,
                            }}
                        >
                            <div
                                style={{
                                    width: `${expRatio * 100}%`,
                                    height: "100%",
                                    background: "#22c55e",
                                    transition: "width 0.3s ease",
                                }}
                            />
                        </div>

                        {partner.level < LEVEL_CAP ? (
                            <p
                                style={{
                                    fontSize: 12,
                                    marginTop: 4,
                                    color: "#aaa",
                                }}
                            >
                                EXP {partner.exp} / {expNeeded}
                            </p>
                        ) : (
                            <p
                                style={{
                                    fontSize: 12,
                                    marginTop: 4,
                                    color: "#facc15",
                                }}
                            >
                                MAX 레벨에 도달했습니다!
                            </p>
                        )}
                    </div>
                </section>
            )}

            {/* 🔹 내 몬스터들 + 무료 소환 버튼 (학생 전용) */}
            {isStudent && profile && (
                <section className="card" style={{ marginTop: "1rem" }}>
                    <h3>내 몬스터들 (베타)</h3>

                    <button
                        type="button"
                        className="secondary-btn"
                        disabled={!profile.id || collLoading}
                        onClick={async () => {
                            const result = await pullFreeGacha();
                            if (result) {
                                // TODO: "새 몬스터 획득!" 토스트/텍스트 연출
                                console.log("[QuizMon] gacha result", result);
                            }
                        }}
                    >
                        무료 소환 1회
                    </button>

                    {collError && (
                        <p
                            className="form-message error"
                            style={{ marginTop: "0.5rem" }}
                        >
                            {collError}
                        </p>
                    )}

                    <ul style={{ marginTop: "0.5rem" }}>
                        {monsters.map((m) => (
                            <li key={m.id}>
                                {m.species_id} Lv.{m.level}
                                {m.party_slot && ` (파티 ${m.party_slot}번 슬롯)`}
                            </li>
                        ))}
                        {monsters.length === 0 && (
                            <li>아직 획득한 몬스터가 없습니다.</li>
                        )}
                    </ul>
                </section>
            )}
        </div>
    );
}
