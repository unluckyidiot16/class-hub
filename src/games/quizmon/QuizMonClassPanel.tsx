// src/games/quizmon/QuizMonClassPanel.tsx
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "../../lib/supabaseClient";
import type {
    QuizPackRow,
    QuizQuestionRow,
} from "../../pages/student/StudentPlayPackPage";
import type {
    QuizPackJsonV1,
    QuizPackQuestionV1,
} from "../../types/quizPackJson";
import { QuizMonBattleSection } from "./QuizMonBattleSection";
import type { QuizAnswerResult, QuizmonOwnedMonsterRow } from "./types";
import { useQuizmonProfile } from "./useQuizmonProfile";
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

    // 이 수업이 속한 반 ID
    classId?: string | null;

    /** React 게임(학생 화면)에서만 사용: Supabase game_events 연동용 */
    gameSessionId?: string | null;
    studentId?: string | null;

    // StudentRoomPage / TeacherRoomLivePage 쪽에서 넘겨줄 콜백
    onQuizAnswer?: (result: QuizAnswerResult) => void;
};


export function QuizMonClassPanel(props: QuizMonClassPanelProps) {
    const {
        roomId,
        pack,
        session,
        classId,
        gameSessionId,
        studentId,
        onQuizAnswer,
    } = props;

    const [quizpack, setQuizpack] = useState<QuizPackJsonV1 | null>(null);
    const [quizLoading, setQuizLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // 전체화면 토글
    const [isFullscreen, setIsFullscreen] = useState(false);

    const isStudent = !!studentId;

    const [ownedMonsters, setOwnedMonsters] =
        useState<QuizmonOwnedMonsterRow[]>([]);
    const [collectionLoading, setCollectionLoading] = useState(false);
    const [collectionError, setCollectionError] = useState<string | null>(null);


    // 🔹 QuizMon 프로필 (학생일 때만 의미 있음)
    const {
        profile,
        loading: profileLoading,
        error: profileError,
        applyRaidResult,
        chooseStarter,
    } = useQuizmonProfile({
        classId: classId ?? null,
        studentKey: studentId ?? null,
    });

    // 🔹 학생 프로필이 준비되면 보유 몬스터 컬렉션 로딩
        useEffect(() => {
                if (!isStudent || !profile?.id) {
                    setOwnedMonsters([]);
                        setCollectionLoading(false);
                        setCollectionError(null);
                        return;
                    }
        
                    let cancelled = false;
        
                    const loadOwnedMonsters = async () => {
                        setCollectionLoading(true);
                        setCollectionError(null);
            
                            const { data, error } = await supabase
                            .from("quizmon_owned_monsters")
                            .select("*")
                            .eq("profile_id", profile.id)
                            .order("created_at", { ascending: true });
            
                            if (cancelled) return;
            
                            if (error) {
                                 console.error(
                                        "[QuizMonClassPanel] load quizmon_owned_monsters error",
                                        error,
                                    );
                                setCollectionError(
                                        "보유 몬스터를 불러오는 중 오류가 발생했습니다.",
                                    );
                                setOwnedMonsters([]);
                            } else {
                                setOwnedMonsters((data ?? []) as QuizmonOwnedMonsterRow[]);
                            }
            
                            setCollectionLoading(false);
                    };
        
                    void loadOwnedMonsters();
        
                    return () => {
                        cancelled = true;
                    };
            }, [isStudent, profile?.id]);
    

    // 배틀 종료 → 프로필에 레이드 결과 반영 (레벨/EXP 업데이트)
    const handleBattleEnd = async (summary: { correct: number; total: number }) => {
        if (!studentId) return; // 교사 미리보기 방지
        await applyRaidResult(summary);
    };
    
    
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
    // ✅ 2) 학생 프로필/스타터 선택 가드
    // =========================
    if (isStudent) {
        if (profileError) {
            return (
                <div style={{ padding: "1rem" }}>
                    <p>퀴즈몬 프로필을 불러오는 중 오류가 발생했습니다.</p>
                    <p
                        style={{
                            fontSize: "0.8rem",
                            color: "#9ca3af",
                            marginTop: "0.5rem",
                            whiteSpace: "pre-wrap",
                        }}
                    >
                        {profileError}
                    </p>
                </div>
            );
        }

        if (!profile) {
            return <p>프로필을 불러오는 중입니다...</p>;
        }

        if (!profile.starter_chosen) {
            return (
                <StarterSelectPanel
                    disabled={profileLoading}
                    onChooseStarter={async (speciesId) => {
                        await chooseStarter(speciesId);
                        // 필요하면 여기서도 refresh() 호출
                    }}
                />
            );
        }
    }

    // =========================
// ✅ 3) 렌더링: 전체화면 + 게임 씬만
// =========================

    const wrapperStyle: CSSProperties = isFullscreen
        ? {
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "#020617",
            padding: "1rem",
            overflowY: "auto" as CSSProperties["overflowY"],
        }
        : {};

// 👇 학생 / 교사 / 전체화면에 따라 내부 컨테이너 폭 분기
    const innerStyle: CSSProperties = isFullscreen
        ? {
            maxWidth: 1280,
            margin: "0 auto",
        }
        : isStudent
            ? {
                width: "100%",
                maxWidth: "100%",
                margin: 0,
            }
            : {
                maxWidth: 960,
                margin: "0 auto",
            };

    return (
        <div style={wrapperStyle}>
            <div style={innerStyle}>
                {/* 상단 헤더 + 전체화면 버튼 */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.75rem",
                    }}
                >
                    <h2
                        style={{
                            margin: 0,
                            fontSize: 16,
                            fontWeight: 600,
                        }}
                    >
                        QuizMon 수업 화면
                    </h2>
                    <button
                        type="button"
                        onClick={() => setIsFullscreen((v) => !v)}
                        style={{
                            padding: "0.35rem 0.9rem",
                            borderRadius: 999,
                            border: "1px solid #4b5563",
                            background: "#020617",
                            color: "#e5e7eb",
                            fontSize: 12,
                            cursor: "pointer",
                        }}
                    >
                        {isFullscreen ? "✕ 전체화면" : "전체화면"}
                    </button>
                </div>

                {/* 🔹 메인: 게임 씬만 (QuizMonBattleSection → QuizMonGame) */}
                <div className="card">
                    <QuizMonBattleSection
                        mode="class"
                        pack={pack}
                        session={session ?? null}
                        quizpack={quizpack}
                        quizLoading={quizLoading}
                        errorMsg={errorMsg}
                        roomId={roomId}
                        gameSessionId={gameSessionId}
                        studentId={studentId}
                        profileId={profile?.id ?? null}
                        profile={profile ?? null}
                        monsters={ownedMonsters}
                        collectionLoading={collectionLoading}
                        collectionError={collectionError}
                        onQuizAnswer={onQuizAnswer}
                        onBattleEnd={studentId ? handleBattleEnd : undefined}
                    />
                </div>
            </div>
        </div>
    );

}
