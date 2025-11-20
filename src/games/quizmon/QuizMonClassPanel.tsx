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
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // 🔹 이번 레이드 요약 (정답/총문항)
    const [lastRaidResult, setLastRaidResult] = useState<LastRaidResult | null>(
        null,
    );

    // 🔹 Quizmon 프로필 훅 (학생 키가 없으면 내부에서 아무 일도 안 함)
    const { profile, applyRaidResult } = useQuizmonProfile({
        studentKey: studentId ?? null,
    });

    const partner = profile?.partner ?? null;
    let expNeeded = 0;
    let expRatio = 0;
    
    const handleBattleEnd = async (summary: { correct: number; total: number }) => {
        // 학생 키가 없다면 (교사 미리보기 등) 아무 것도 안 함
        if (!studentId) return;

        setLastRaidResult(summary);
        await applyRaidResult(summary); // 내부에서 quizmon_profiles 업데이트
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
            setLoading(true);
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
                setLoading(false);
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
            setLoading(false);
        };

        loadQuestions();

        return () => {
            cancelled = true;
        };
    }, [pack?.id]);

    // 🎯 2) 상태별 가드 (pack / session / loading…)

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
    if (loading || !quizpack) {
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

            {/* 🔹 레이드 결과 + 내 파트너 레벨/EXP 표시 */}
            {partner && lastRaidResult && (
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
                                    background: "#22c55e", // 연두색 느낌
                                    transition: "width 0.4s ease",
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
        </div>
    );
}
