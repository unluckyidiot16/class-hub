// src/games/quizmon/AchievementsTab.tsx
import type { QuizmonProfileRow } from "./types";

export type AchievementsTabProps = {
    profile: QuizmonProfileRow | null;

    /** 이미 보상 수령이 끝난 업적 id 목록 (향후 DB 연동용) */
    claimedIds?: string[];

    /** "보상 받기" 눌렀을 때 호출되는 콜백 */
    onClaim?: (achievementId: string) => void | Promise<void>;
};

type AchievementView = {
    id: string;
    title: string;
    description: string;
    current: number;
    target: number;
    rewardGems: number;
    isClaimed: boolean;
};

function buildDefaultAchievements(
    profile: QuizmonProfileRow | null,
    claimedIds?: string[],
): AchievementView[] {
    const p: any = profile ?? {};
    const totalBattles = p.total_battles ?? 0;
    const totalCorrect = p.total_correct ?? 0;
    const totalRaids = p.total_raids ?? 0;

    const claimedSet = new Set(claimedIds ?? []);

    const raw: Array<
        Omit<AchievementView, "current" | "isClaimed"> & { stat: number }
    > = [
        {
            id: "first_battle",
            title: "첫 번째 전투 완료!",
            description: "아무 던전이든 1회 클리어하기",
            stat: totalBattles,
            target: 1,
            rewardGems: 5,
        },
        {
            id: "correct_10",
            title: "정답 10개 달성",
            description: "퀴즈 정답을 10개 맞히기",
            stat: totalCorrect,
            target: 10,
            rewardGems: 10,
        },
        {
            id: "raid_clear_1",
            title: "첫 레이드 클리어",
            description: "수업용 레이드를 1회 클리어하기",
            stat: totalRaids,
            target: 1,
            rewardGems: 15,
        },
    ];

    return raw.map((a) => {
        const current = Math.min(a.stat, a.target);
        const isClaimed = claimedSet.has(a.id);
        return {
            id: a.id,
            title: a.title,
            description: a.description,
            target: a.target,
            current,
            rewardGems: a.rewardGems,
            isClaimed,
        };
    });
}

export function AchievementsTab({
                                    profile,
                                    claimedIds,
                                    onClaim,
                                }: AchievementsTabProps) {
    if (!profile) {
        return (
            <div
                style={{
                    fontSize: "0.8rem",
                    color: "#9ca3af",
                    padding: "0.5rem",
                }}
            >
                프로필 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.
            </div>
        );
    }

    const achievements = buildDefaultAchievements(profile, claimedIds);

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                fontSize: "0.85rem",
            }}
        >
            <div
                style={{
                    fontSize: "0.9rem",
                    color: "#e5e7eb",
                    fontWeight: 600,
                }}
            >
                업적
            </div>
            <div
                style={{
                    fontSize: "0.78rem",
                    color: "#9ca3af",
                }}
            >
                퀴즈를 풀고 던전을 클리어하며 다양한 도전 과제를 달성해
                보세요. 완료된 업적은 보상 받기 버튼을 눌러 젬을
                획득할 수 있습니다.
            </div>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                }}
            >
                {achievements.map((a) => {
                    const ratio = a.target > 0 ? a.current / a.target : 0;
                    const percent = Math.round(ratio * 100);
                    const completed = a.current >= a.target;
                    const claimable =
                        !!onClaim && completed && !a.isClaimed;

                    let buttonLabel = "진행 중";
                    if (a.isClaimed) buttonLabel = "받음";
                    else if (claimable) buttonLabel = "보상 받기";
                    else if (completed) buttonLabel = "완료";

                    return (
                        <div
                            key={a.id}
                            style={{
                                padding: 12,
                                borderRadius: 12,
                                background: "rgba(15,23,42,0.9)",
                                border:
                                    "1px solid rgba(55,65,81,0.9)",
                                display: "flex",
                                gap: 12,
                                alignItems: "center",
                            }}
                        >
                            <div
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: "0.85rem",
                                        fontWeight: 600,
                                        color: "#e5e7eb",
                                    }}
                                >
                                    {a.title}
                                </div>
                                <div
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "#9ca3af",
                                        marginTop: 2,
                                    }}
                                >
                                    {a.description}
                                </div>
                                <div
                                    style={{
                                        marginTop: 8,
                                        fontSize: "0.75rem",
                                        color: "#9ca3af",
                                    }}
                                >
                                    진행도: {a.current} / {a.target} (
                                    {percent}
                                    %)
                                </div>
                                <div
                                    style={{
                                        marginTop: 4,
                                        height: 6,
                                        borderRadius: 999,
                                        background: "#111827",
                                    }}
                                >
                                    <div
                                        style={{
                                            height: "100%",
                                            borderRadius: 999,
                                            width: `${
                                                a.target > 0
                                                    ? Math.min(
                                                        100,
                                                        Math.max(
                                                            6,
                                                            percent,
                                                        ),
                                                    )
                                                    : 0
                                            }%`,
                                            background:
                                                "linear-gradient(90deg,#22c55e,#3b82f6)",
                                        }}
                                    />
                                </div>
                            </div>

                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "flex-end",
                                    gap: 4,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "#facc15",
                                    }}
                                >
                                    보상: 젬 {a.rewardGems}
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        claimable &&
                                        onClaim?.(a.id)
                                    }
                                    disabled={!claimable}
                                    style={{
                                        padding: "4px 10px",
                                        fontSize: "0.75rem",
                                        borderRadius: 999,
                                        border: "none",
                                        cursor: claimable
                                            ? "pointer"
                                            : "default",
                                        background: a.isClaimed
                                            ? "rgba(55,65,81,0.8)"
                                            : claimable
                                                ? "linear-gradient(135deg,#22c55e,#16a34a)"
                                                : "rgba(31,41,55,0.9)",
                                        color: a.isClaimed
                                            ? "#9ca3af"
                                            : "#e5e7eb",
                                        opacity: claimable ? 1 : 0.7,
                                    }}
                                >
                                    {buttonLabel}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
