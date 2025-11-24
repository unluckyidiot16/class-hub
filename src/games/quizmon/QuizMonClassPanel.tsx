// src/games/quizmon/QuizMonClassPanel.tsx
import { useRef, useEffect, useState, useCallback } from "react";
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
import type {
    QuizAnswerResult,
    QuizmonOwnedMonsterRow,
} from "./types";
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
    const [healing, setHealing] = useState(false);

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

    // 보유 몬스터 로딩 중복 방지용
    const refreshingRef = useRef(false);

    /**
     * 보유 몬스터 컬렉션 로딩
     * - 기존 owned_monsters가 없고, profile.partner / starter_species_id 만 있는
     *   예전 데이터도 자동으로 마이그레이션해 줌.
     */
    const refreshOwnedMonsters = useCallback(async () => {
        if (!profile?.id) return;
        if (refreshingRef.current) return;

        refreshingRef.current = true;
        setCollectionLoading(true);
        setCollectionError(null);

        try {
            let rows: QuizmonOwnedMonsterRow[] = [];

            // 1) 현재 프로필 기준 owned_monsters 조회
            const { data, error } = await supabase
                .from("quizmon_owned_monsters")
                .select("*")
                .eq("profile_id", profile.id)
                .order("created_at", { ascending: true });

            if (error) {
                console.error(
                    "[QuizMonClassPanel] refreshOwnedMonsters error",
                    error,
                );
                setCollectionError(
                    "보유 몬스터를 불러오는 중 오류가 발생했습니다.",
                );
                setOwnedMonsters([]);
                return;
            }

            rows = (data ?? []) as QuizmonOwnedMonsterRow[];

            // 2) 마이그레이션: owned_monsters가 비었는데
            //    profile.partner / starter_species_id 가 있으면
            //    starter 개체를 1마리 생성해 준다.
            if (!rows.length) {
                const anyProfile = profile as any;
                const fallbackSpeciesId =
                    (anyProfile.partner as string | null) ??
                    (anyProfile.starter_species_id as string | null) ??
                    null;

                if (fallbackSpeciesId) {
                    const { data: inserted, error: insertError } =
                        await supabase
                            .from("quizmon_owned_monsters")
                            .insert({
                                profile_id: profile.id,
                                species_id: fallbackSpeciesId,
                                level: 1,
                                exp: 0,
                                party_slot: 1,
                                current_hp: null,
                                is_fainted: false,
                                learned_moves: [] as string[],
                            })
                            .select("*")
                            .single();

                    if (insertError) {
                        console.error(
                            "[QuizMonClassPanel] create starter owned_monster error",
                            insertError,
                        );
                    } else if (inserted) {
                        rows = [inserted as QuizmonOwnedMonsterRow];
                    }
                }
            }

            setOwnedMonsters(rows);
        } finally {
            refreshingRef.current = false;
            setCollectionLoading(false);
        }
    }, [profile]);

    // 🔹 학생 프로필이 준비되면 1회 자동 로딩
    useEffect(() => {
        void refreshOwnedMonsters();
    }, [refreshOwnedMonsters]);

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

    // 🔹 모든 보유 몬스터 전체 회복
    const healAllMonsters = useCallback(async () => {
        if (!profile?.id) return;

        setHealing(true);
        try {
            const { error } = await supabase
                .from("quizmon_owned_monsters")
                .update({
                    current_hp: null, // null = 풀피로 간주
                    is_fainted: false,
                })
                .eq("profile_id", profile.id);

            if (error) {
                console.error(
                    "[QuizMonClassPanel] healAllMonsters error",
                    error,
                );
                setCollectionError("몬스터 회복 중 오류가 발생했습니다.");
                return;
            }

            await refreshOwnedMonsters();
        } finally {
            setHealing(false);
        }
    }, [profile?.id, refreshOwnedMonsters]);

    // =========================
    // ✅ 학생 프로필/스타터 선택 가드
    // =========================
    if (isStudent && profileError) {
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

    if (isStudent && !profile) {
        return <p>프로필을 불러오는 중입니다...</p>;
    }

    if (isStudent && profile && !profile.starter_chosen) {
        return (
            <StarterSelectPanel
                disabled={profileLoading}
                onChooseStarter={async (speciesId) => {
                    await chooseStarter(speciesId);
                    await refreshOwnedMonsters();
                }}
            />
        );
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
                        monsters={ownedMonsters}
                        collectionLoading={collectionLoading || healing}
                        collectionError={collectionError}
                        onQuizAnswer={onQuizAnswer}
                        onBattleEnd={studentId ? handleBattleEnd : undefined}
                        onHealAll={isStudent ? healAllMonsters : undefined}
                        onRefreshCollection={refreshOwnedMonsters}
                    />
                </div>
            </div>
        </div>
    );
}
