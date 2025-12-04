// src/games/quizmon/QuizMonClassPanel.tsx
import { useEffect, useState, useCallback } from "react";
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
import type { QuizAnswerResult } from "./types";
import { StarterSelectPanel } from "./StarterSelectPanel";
import { useQuizmonContext } from "./QuizmonProvider";

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

    // 중앙 상태(프로필/몬스터) 컨텍스트
    const {
        profile,
        profileLoading,
        profileError,
        applyRaidResult,
        chooseStarter,
        monsters,
        collectionLoading,
        collectionError,
        refreshMonsters,
        healAllMonsters,
    } = useQuizmonContext();

    // 배틀 종료 → 프로필에 레이드 결과 반영 (레벨/EXP 업데이트)
    const handleBattleEnd = useCallback(
        async (summary: { correct: number; total: number }) => {
            if (!studentId) return; // 교사 미리보기 방지
            await applyRaidResult(summary);
        },
        [studentId, applyRaidResult],
    );

    // 🎯 퀴즈팩이 바뀔 때마다 quiz_questions → QuizPackJsonV1 로딩
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
    }, [pack?.id, pack?.title, pack?.subject, pack?.grade]);

    // =========================
    // ✅ 학생 프로필/스타터 선택 가드
    // =========================
    if (isStudent) {
        if (profileError) {
            return (
                <div style={{ padding: "1rem" }}>
                    <p>퀴즈몬 프로필을 불러오는 중 오류가 발생했습니다.</p>
                    <p>{String(profileError)}</p>
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
                    onChooseStarter={async ({ speciesId, trainerName }) => {
                        // chooseStarter의 시그니처도 여기에 맞춰 바꿔줄 예정
                        await chooseStarter({ speciesId, trainerName });
                        await refreshMonsters();
                    }}
                />
            );
        }
    }

    // =========================
    // ✅  렌더링: 전체화면 + 게임 씬만
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

                {/* 🔹 메인: 게임 씬만 (QuizMonBattleSection → QuizMonGame)
                    → 카드 자체를 뷰포트로 쓰고 내부만 스크롤되도록 설정 */}
                <div
                    className="card"
                    style={{
                        // 화면 높이 기준으로 카드 최대 높이 제한
                        maxHeight: isFullscreen
                            ? "calc(100vh - 4rem)" // 전체화면일 때는 조금 더 여유
                            : "calc(100vh - 7rem)", // 일반 모드(헤더 포함)에서의 뷰포트
                        overflowY: "auto", // 🔹 카드 내부 스크롤
                        overflowX: "hidden",
                    }}
                >
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
                        // useQuizmonProfile 이 반환하는 프로필 타입이
                        // QuizmonProfileRow 와 1:1 은 아니라서 any 캐스팅
                        profile={profile as any}
                        monsters={monsters}
                        collectionLoading={collectionLoading}
                        collectionError={collectionError}
                        onQuizAnswer={onQuizAnswer}
                        onBattleEnd={studentId ? handleBattleEnd : undefined}
                        onHealAll={isStudent ? healAllMonsters : undefined}
                        onRefreshCollection={refreshMonsters}
                    />
                </div>
            </div>
        </div>
    );
}
