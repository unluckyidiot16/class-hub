// src/games/quizmon/QuizMonClassPanel.tsx
import type { ReactNode } from "react";
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
import { getMonsterSprite, getTrainerSprite } from "./assets";

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

    const playerDisplayName =
        profile
            ? ((profile as any).nickname ??
                (profile as any).display_name ??
                (profile as any).name ??
                "학생 트레이너")
            : "학생 트레이너";

    const partnerDisplayName =
        partner
            ? ((partner as any).nickname ??
                (partner as any).name ??          // 혹시 나중에 name 필드를 추가해도 커버
                (partner as any).species_id ??    // 종 ID라도 보여주기
                "파트너")
            : "파트너";


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
    // ✅ 2) 학생 프로필/스타터 선택 가드 (훅 호출 이후)
    // =========================
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

    // =========================
    // ✅ 3) 전투/수업 상태 카드 내용 구성
    // =========================

    let battleBody: ReactNode = null;

    if (!pack) {
        battleBody = (
            <p>
                이 방에는 아직 <strong>퀴즈팩</strong>이 연결되어 있지 않습니다.
                <br />
                선생님이 퀴즈팩을 선택하면 퀴즈몬 전투를 진행할 수 있어요.
            </p>
        );
    } else if (!session || session.status === "pending") {
        battleBody = (
            <p>
                선생님이 아직 <strong>퀴즈몬 게임</strong>을 시작하지 않았습니다.
                <br />
                수업이 시작되면 내 파트너가 전투에 참가합니다.
            </p>
        );
    } else if (session.status === "ended") {
        battleBody = (
            <p>
                이 수업의 퀴즈몬 게임이 종료되었습니다.
                <br />
                다음 수업을 기다리는 동안 로비에서 파트너를 관리해 보세요.
            </p>
        );
    } else if (quizLoading || !quizpack) {
        battleBody = <p>퀴즈 데이터를 불러오는 중입니다…</p>;
    } else if (errorMsg) {
        battleBody = (
            <p className="form-message error" style={{ marginTop: "0.5rem" }}>
                {errorMsg}
            </p>
        );
    } else {
        // session.status === "running" && quizpack 준비 완료
        battleBody = (
            <QuizMonGame
                quizpack={quizpack}
                onQuizAnswer={onQuizAnswer}
                roomId={roomId}
                gameSessionId={gameSessionId}
                studentId={studentId}
                onBattleEnd={studentId ? handleBattleEnd : undefined}
            />
        );
    }

// 스프라이트 URL (있으면 로비에서 사용)
    const trainerSpriteUrl = getTrainerSprite(
        // 나중에 profile.trainer_key 생기면 여기로 교체
        null,
    );

// 🔹 파트너 스프라이트: 여러 소스에서 species_id 추론
    let partnerSpeciesId: string | null = null;

    if (partner) {
        // 1) profile.partner 안에 species_id가 있으면 최우선 사용
        const fromPartner =
            ((partner as any).species_id as string | undefined) ?? undefined;

        // 2) 컬렉션에서 같은 몬스터 id 찾아보기
        const fromCollectionById =
            monsters.find((m) => m.id === (partner as any).id) ?? null;

        // 3) 둘 다 없으면 컬렉션의 첫 번째 몬스터라도 사용
        const fromCollection =
            fromCollectionById ??
            (monsters.length > 0 ? monsters[0] : null);

        partnerSpeciesId =
            fromPartner ?? (fromCollection ? fromCollection.species_id : null);
    }

    const partnerSpriteUrl = partnerSpeciesId
        ? getMonsterSprite(partnerSpeciesId)
        : null;

    // =========================
    // ✅ 4) 로비 + 전투 + 결과/컬렉션 렌더링
    // =========================

    return (
        <div>
            {/* 🔹 로비: 학생 + 파트너가 있을 때 항상 노출 */}
            {isStudent && profile && partner && (
                <section className="card" style={{ marginBottom: "1rem" }}>
                    {/* 상단: 타이틀 + 작은 배지 */}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "0.5rem",
                            gap: "0.75rem",
                        }}
                    >
                        <h3 style={{ margin: 0 }}>퀴즈몬 교실 로비</h3>
                        <span
                            style={{
                                fontSize: 12,
                                color: "#9ca3af",
                            }}
                        >
                Beta
            </span>
                    </div>

                    {/* 본문: 트레이너 카드 + 파트너 카드 */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "stretch",
                            justifyContent: "space-between",
                            gap: "1rem",
                        }}
                    >
                        {/* 트레이너 정보 (왼쪽) */}
                        <div
                            style={{
                                flex: 1,
                                display: "flex",
                                alignItems: "center",
                                gap: "0.75rem",
                            }}
                        >
                            <div
                                style={{
                                    width: 80,
                                    height: 80,
                                    borderRadius: 16,
                                    background: "#020617",
                                    border: "1px solid #1f2937",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}
                            >
                                {trainerSpriteUrl && (
                                    <img
                                        src={trainerSpriteUrl}
                                        alt="Trainer"
                                        style={{
                                            width: 64,
                                            height: 64,
                                            imageRendering: "pixelated",
                                        }}
                                    />
                                )}
                            </div>

                            <div style={{ flex: 1 }}>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "#9ca3af",
                                        marginBottom: 2,
                                    }}
                                >
                                    트레이너
                                </div>
                                <div
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 600,
                                        color: "#e5e7eb",
                                        marginBottom: 4,
                                    }}
                                >
                                    {playerDisplayName}
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "#9ca3af",
                                    }}
                                >
                                    파트너: {partnerDisplayName}
                                </div>
                            </div>
                        </div>

                        {/* 파트너 + EXP (오른쪽) */}
                        <div
                            style={{
                                flex: 1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                gap: "0.75rem",
                            }}
                        >
                            <div
                                style={{
                                    width: 80,
                                    height: 80,
                                    borderRadius: 16,
                                    background: "#020617",
                                    border: "1px solid #1f2937",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}
                            >
                                {partnerSpriteUrl && (
                                    <img
                                        src={partnerSpriteUrl}
                                        alt={partnerDisplayName}
                                        style={{
                                            width: 72,
                                            height: 72,
                                            imageRendering: "pixelated",
                                        }}
                                    />
                                )}
                            </div>

                            <div style={{ minWidth: 150 }}>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "baseline",
                                        marginBottom: 4,
                                    }}
                                >
                        <span
                            style={{
                                fontSize: 13,
                                color: "#9ca3af",
                            }}
                        >
                            파트너
                        </span>
                                    <span
                                        style={{
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: "#e5e7eb",
                                        }}
                                    >
                            Lv. {partner?.level ?? 1}
                        </span>
                                </div>

                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "#e5e7eb",
                                        marginBottom: 4,
                                    }}
                                >
                                    {partner && partner.level < LEVEL_CAP
                                        ? `EXP ${partner.exp} / ${expNeeded}`
                                        : "MAX 레벨"}
                                </div>

                                <div
                                    style={{
                                        background: "#111827",
                                        borderRadius: 999,
                                        overflow: "hidden",
                                        height: 8,
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
                            </div>
                        </div>
                    </div>

                    <p
                        style={{
                            fontSize: 12,
                            color: "#9ca3af",
                            marginTop: "0.75rem",
                        }}
                    >
                        퀴즈를 맞추면 파트너가 경험치를 얻어요. 오늘 수업에서 Lv.
                        {Math.min((partner?.level ?? 1) + 1, LEVEL_CAP)}을(를) 노려보세요!
                    </p>
                </section>
            )}
            {/* 🔹 메인 메뉴 (베타, 학생 전용) */}
            {isStudent && (
                <section className="card" style={{ marginBottom: "1rem" }}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fit, minmax(180px, 1fr))",
                            gap: "0.75rem",
                        }}
                    >
                        {[
                            {
                                key: "monsters",
                                title: "몬스터",
                                description: "보유 몬스터 확인",
                            },
                            {
                                key: "missions",
                                title: "미션",
                                description: "오늘의 수업 목표",
                            },
                            {
                                key: "dex",
                                title: "도감",
                                description: "발견한 몬스터 기록",
                            },
                            {
                                key: "settings",
                                title: "설정",
                                description: "퀴즈 옵션 및 사운드",
                            },
                        ].map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                disabled
                                style={{
                                    borderRadius: 16,
                                    padding: "0.75rem 0.9rem",
                                    border: "1px solid #1f2937",
                                    background:
                                        "radial-gradient(circle at top left, #1d4ed8 0, #020617 55%)",
                                    textAlign: "left",
                                    opacity: 0.85,
                                    cursor: "default",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: "#e5e7eb",
                                        marginBottom: 4,
                                    }}
                                >
                                    {item.title}
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "#9ca3af",
                                    }}
                                >
                                    {item.description}
                                </div>
                            </button>
                        ))}
                    </div>

                    <div
                        style={{
                            marginTop: "0.75rem",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.5rem",
                        }}
                    >
                        {["수업 정보", "소환", "도전 모드", "옵션"].map((label) => (
                            <button
                                key={label}
                                type="button"
                                disabled
                                style={{
                                    padding: "0.35rem 0.9rem",
                                    borderRadius: 999,
                                    border: "1px solid #1f2937",
                                    background: "#020617",
                                    fontSize: 12,
                                    color: "#e5e7eb",
                                    opacity: 0.85,
                                    cursor: "default",
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </section>
            )}
            {/* 🔹 전투/수업 상태 영역 */}
            <section className="card">

            <h3 style={{ marginTop: 0 }}>전투 / 수업 상태</h3>
                {battleBody}
            </section>

            {/* 🔹 레이드 결과 + 내 파트너 레벨/EXP (학생 전용, 전투 후) */}
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
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "0.75rem",
                            marginBottom: "0.5rem",
                        }}
                    >
                        <h3 style={{ margin: 0 }}>내 몬스터들 (베타)</h3>

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
                    </div>

                    {collError && (
                        <p
                            className="form-message error"
                            style={{ marginTop: "0.5rem" }}
                        >
                            {collError}
                        </p>
                    )}

                    {monsters.length === 0 ? (
                        <p
                            style={{
                                marginTop: "0.5rem",
                                fontSize: 13,
                                color: "#9ca3af",
                            }}
                        >
                            아직 획득한 몬스터가 없습니다.
                        </p>
                    ) : (
                        <div
                            style={{
                                marginTop: "0.5rem",
                                display: "grid",
                                gridTemplateColumns:
                                    "repeat(auto-fit, minmax(180px, 1fr))",
                                gap: "0.75rem",
                            }}
                        >
                            {monsters.map((m) => {
                                const spriteUrl = getMonsterSprite(m.species_id);
                                return (
                                    <div
                                        key={m.id}
                                        style={{
                                            display: "flex",
                                            gap: "0.75rem",
                                            padding: "0.5rem 0.75rem",
                                            borderRadius: 12,
                                            border: "1px solid #1f2937",
                                            background: "#020617",
                                            alignItems: "center",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 72,
                                                height: 72,
                                                borderRadius: 16,
                                                background: "#000",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                overflow: "hidden",
                                            }}
                                        >
                                            {spriteUrl && (
                                                <img
                                                    src={spriteUrl}
                                                    alt={m.species_id}
                                                    style={{
                                                        width: 64,
                                                        height: 64,
                                                        imageRendering: "pixelated",
                                                    }}
                                                />
                                            )}
                                        </div>

                                        <div style={{ flex: 1 }}>
                                            <div
                                                style={{
                                                    fontSize: 14,
                                                    fontWeight: 600,
                                                    color: "#e5e7eb",
                                                }}
                                            >
                                                {m.species_id}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    color: "#9ca3af",
                                                    marginTop: 2,
                                                }}
                                            >
                                                Lv.{m.level}{" "}
                                                {m.party_slot &&
                                                    `(파티 ${m.party_slot}번 슬롯)`}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

        </div>
    );
}
