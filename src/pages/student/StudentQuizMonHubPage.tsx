// src/pages/student/StudentQuizMonHubPage.tsx
import { useState } from "react";
import { useQuizmonProfile } from "../../games/quizmon/useQuizmonProfile";
import { useQuizmonCollection } from "../../games/quizmon/useQuizmonCollection";
import { StarterSelectPanel } from "../../games/quizmon/StarterSelectPanel";
import {
    getMonsterSprite,
    getTrainerSprite,
} from "../../games/quizmon/assets";
import { QuizMonBattleSection } from "../../games/quizmon/QuizMonBattleSection";
import type { QuizPackJsonV1 } from "../../types/quizPackJson";

type TabKey = "battle" | "gacha" | "collection" | "missions";

// 연습/샌드박스용 더미 퀴즈팩 (나중에 실제 퀴즈팩 로딩으로 교체 가능)
const dummyQuizpack: QuizPackJsonV1 = {
    type: "quizpack",
    version: "v1",
    pack: {
        id: "quizmon-hub-practice",
        title: "퀴즈몬 연습 팩",
        subject: "연습",
        grade: "any",
    },
    questions: [
        {
            id: "q1",
            index: 0,
            prompt: "2 + 3 = ?",
            options: ["4", "5", "6", "7"],
            answerIndex: 1,
        },
        {
            id: "q2",
            index: 1,
            prompt: "영어로 '고양이'는?",
            options: ["dog", "cat", "bird", "fish"],
            answerIndex: 1,
        },
    ],
};

const LEVEL_CAP = 10;
const expNeededForLevel = (level: number) => 5 * level;

export default function StudentQuizMonHubPage() {
    const [activeTab, setActiveTab] = useState<TabKey>("battle");

    // TODO: 실제로는 studentKey 를 수업/로그인 컨텍스트에서 가져와서 넘기기
    const {
        profile,
        loading: profileLoading,
        chooseStarter,
    } = useQuizmonProfile({
        studentKey: null,
    });

    const {
        monsters,
        loading: collLoading,
    } = useQuizmonCollection({ profileId: profile?.id ?? null });

    // --- 프로필 로딩/가드 ---

    if (profileLoading) {
        return (
            <section className="page student-quizmon">
                <h1>퀴즈몬 허브</h1>
                <p className="page-desc">프로필을 불러오는 중입니다…</p>
            </section>
        );
    }

    if (!profile) {
        return (
            <section className="page student-quizmon">
                <h1>퀴즈몬 허브</h1>
                <p className="page-desc">
                    아직 퀴즈몬 프로필이 생성되지 않았습니다.
                    <br />
                    수업 시간에 퀴즈몬이 연동된 뒤 다시 접속해 주세요.
                </p>
            </section>
        );
    }

    if (!profile.starter_chosen) {
        return (
            <section className="page student-quizmon">
                <h1>퀴즈몬 파트너 선택</h1>
                <p className="page-desc">
                    첫 번째 파트너를 선택하면 퀴즈로 얻은 보상으로
                    퀴즈몬을 키울 수 있어요.
                </p>
                <div className="card">
                    <StarterSelectPanel
                        onChooseStarter={(speciesId) =>
                            Promise.resolve(chooseStarter(speciesId))
                        }
                    />
                </div>
            </section>
        );
    }

    // --- 프로필/파트너/컬렉션 요약 ---

    const partner = profile.partner ?? null;

    const playerDisplayName =
        (profile as any).nickname ??
        (profile as any).display_name ??
        (profile as any).name ??
        "학생 트레이너";

    const partnerDisplayName =
        partner
            ? ((partner as any).nickname ??
                (partner as any).name ??
                (partner as any).species_id ??
                "파트너")
            : "파트너";

    let expNeeded = 0;
    let expRatio = 0;

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

    const trainerSpriteUrl = getTrainerSprite(null);

    const partnerSpriteUrl = partner
        ? getMonsterSprite(
            (((partner as any).species_id as string | undefined) ?? null) as
                | string
                | null,
        )
        : null;

    const totalMonsters = monsters?.length ?? 0;

    // --- 탭 렌더링 ---

    const renderActiveTab = () => {
        if (activeTab === "battle") {
            return (
                <QuizMonBattleSection
                    mode="practice"
                    title="연습 배틀 (샌드박스)"
                    quizpack={dummyQuizpack}
                    quizLoading={false}
                />
            );
        }

        if (activeTab === "gacha") {
            return (
                <div style={{ paddingTop: "0.5rem" }}>
                    <p>
                        소환 기능은 곧 추가 예정입니다.
                        <br />
                        퀴즈룸에서 얻은 보상으로 새 퀴즈몬을 뽑을 수 있게 될
                        거예요.
                    </p>
                </div>
            );
        }

        if (activeTab === "collection") {
            return (
                <div style={{ paddingTop: "0.5rem" }}>
                    {collLoading ? (
                        <p>컬렉션을 불러오는 중입니다…</p>
                    ) : totalMonsters === 0 ? (
                        <p>
                            아직 획득한 퀴즈몬이 없습니다.
                            <br />
                            수업에서 보상을 모은 뒤 소환을 통해 퀴즈몬을
                            모아보세요.
                        </p>
                    ) : (
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "repeat(auto-fit, minmax(140px, 1fr))",
                                gap: "0.75rem",
                            }}
                        >
                            {monsters!.map((m: any) => {
                                const spriteUrl = getMonsterSprite(
                                    (m.species_id as string | undefined) ??
                                    null,
                                );
                                return (
                                    <div
                                        key={m.id}
                                        className="card"
                                        style={{
                                            padding: "0.5rem",
                                            display: "flex",
                                            gap: "0.5rem",
                                            alignItems: "center",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 12,
                                                background: "#020617",
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
                                                        width: 48,
                                                        height: 48,
                                                        imageRendering:
                                                            "pixelated",
                                                    }}
                                                />
                                            )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    color: "#9ca3af",
                                                }}
                                            >
                                                {m.species_id}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 14,
                                                    fontWeight: 600,
                                                    color: "#e5e7eb",
                                                }}
                                            >
                                                {m.nickname ??
                                                    m.name ??
                                                    "이름 없음"}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    color: "#9ca3af",
                                                }}
                                            >
                                                Lv. {m.level}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            );
        }

        // missions
        return (
            <div style={{ paddingTop: "0.5rem" }}>
                <p>
                    미션/업적 기능은 곧 추가 예정입니다.
                    <br />
                    오늘의 퀴즈 목표, 출석 미션 등을 여기에 모을 수 있어요.
                </p>
            </div>
        );
    };

    const TABS: { key: TabKey; label: string }[] = [
        { key: "battle", label: "연습 배틀" },
        { key: "gacha", label: "소환" },
        { key: "collection", label: "도감" },
        { key: "missions", label: "미션" },
    ];

    return (
        <section className="page student-quizmon">
            <h1>퀴즈몬 허브</h1>
            <p className="page-desc">
                퀴즈룸에서 얻은 보상으로 퀴즈몬을 뽑고, 성장시키고, 연습
                배틀을 할 수 있는 공간입니다.
            </p>

            {/* 상단: 트레이너 / 파트너 요약 카드 */}
            <section className="card" style={{ marginBottom: "1rem" }}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "1rem",
                    }}
                >
                    {/* 트레이너 */}
                    <div style={{ display: "flex", gap: "0.75rem" }}>
                        <div
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: 16,
                                background: "#020617",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                            }}
                        >
                            {trainerSpriteUrl && (
                                <img
                                    src={trainerSpriteUrl}
                                    alt="trainer"
                                    style={{
                                        width: 64,
                                        height: 64,
                                        imageRendering: "pixelated",
                                    }}
                                />
                            )}
                        </div>
                        <div>
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
                                보유 퀴즈몬: {totalMonsters}마리
                            </div>
                        </div>
                    </div>

                    {/* 파트너 */}
                    {partner && (
                        <div
                            style={{
                                display: "flex",
                                gap: "0.75rem",
                                alignItems: "center",
                            }}
                        >
                            <div
                                style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: 16,
                                    background: "#020617",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    overflow: "hidden",
                                }}
                            >
                                {partnerSpriteUrl && (
                                    <img
                                        src={partnerSpriteUrl}
                                        alt={partnerDisplayName}
                                        style={{
                                            width: 64,
                                            height: 64,
                                            imageRendering: "pixelated",
                                        }}
                                    />
                                )}
                            </div>
                            <div style={{ minWidth: 150 }}>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "#9ca3af",
                                        marginBottom: 2,
                                    }}
                                >
                                    파트너
                                </div>
                                <div
                                    style={{
                                        fontSize: 15,
                                        fontWeight: 600,
                                        color: "#e5e7eb",
                                        marginBottom: 4,
                                    }}
                                >
                                    {partnerDisplayName}
                                </div>
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
                                            fontSize: 12,
                                            color: "#9ca3af",
                                        }}
                                    >
                                        Lv. {partner.level}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 12,
                                            color: "#9ca3af",
                                        }}
                                    >
                                        EXP {partner.exp}/{expNeeded}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        background: "#222",
                                        borderRadius: 999,
                                        overflow: "hidden",
                                        height: 8,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${Math.round(
                                                expRatio * 100,
                                            )}%`,
                                            height: "100%",
                                            background:
                                                "linear-gradient(90deg, #22c55e, #4ade80)",
                                            transition: "width 0.2s ease-out",
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* 메인 탭 + 콘텐츠 */}
            <section className="card">
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                        marginBottom: "0.75rem",
                    }}
                >
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveTab(tab.key)}
                                className={isActive ? "primary-btn" : "secondary-btn"}
                                style={{
                                    padding: "0.4rem 0.9rem",
                                    fontSize: 13,
                                }}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {renderActiveTab()}
            </section>
        </section>
    );
}
