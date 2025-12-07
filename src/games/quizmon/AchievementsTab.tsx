// src/games/quizmon/AchievementsTab.tsx
import { useState } from "react";
import type { QuizmonProfileRow } from "./types";
import { useQuizmonContext } from "./QuizmonProvider";
import type { QuizmonAchievementWithProgress } from "./quizmonAchievements";

export type AchievementsTabProps = {
    profile: QuizmonProfileRow | null;
};

export function AchievementsTab({ profile }: AchievementsTabProps) {
    const {
        achievements,
        achievementsLoading,
        achievementsError,
        claimAchievementReward,
    } = useQuizmonContext();

    // ✅ 보상 수령 후 보여줄 모달 상태
    const [rewardModal, setRewardModal] = useState<{
        title: string;
        rewardGems: number;
    } | null>(null);

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

    const list: QuizmonAchievementWithProgress[] = achievements ?? [];
    const hasNoAchievements =
        !achievementsLoading && !achievementsError && list.length === 0;

    return (
        <>
            {/* 메인 업적 리스트 패널 */}
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
                    보세요. 완료된 업적은{" "}
                    <span style={{ color: "#facc15" }}>보상 받기</span>{" "}
                    버튼을 눌러 젬을 획득할 수 있습니다.
                </div>

                {achievementsLoading && (
                    <div
                        style={{
                            fontSize: "0.78rem",
                            color: "#9ca3af",
                        }}
                    >
                        업적을 불러오는 중입니다...
                    </div>
                )}

                {achievementsError && (
                    <div
                        style={{
                            fontSize: "0.78rem",
                            color: "#f97373",
                            background: "rgba(127,29,29,0.2)",
                            borderRadius: 8,
                            padding: "4px 8px",
                        }}
                    >
                        {achievementsError}
                    </div>
                )}

                {hasNoAchievements && (
                    <div
                        style={{
                            fontSize: "0.78rem",
                            color: "#9ca3af",
                            paddingTop: 4,
                        }}
                    >
                        아직 준비된 업적이 없습니다. 앞으로 수업용 콘텐츠에 맞는
                        업적이 추가될 예정입니다.
                    </div>
                )}

                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        marginTop: 4,
                    }}
                >
                    {list.map((entry) => {
                        const {
                            achievement,
                            progress,
                            completed,
                            claimed,
                            claimable,
                        } = entry;

                        const target = achievement.condition_value ?? 0;
                        const current = Math.min(
                            progress ?? 0,
                            target > 0 ? target : progress ?? 0,
                        );
                        const rewardGems = achievement.reward_gems ?? 0;

                        const ratio = target > 0 ? current / target : 0;
                        const percent = Math.round(ratio * 100);

                        let buttonLabel = "진행 중";
                        if (claimed) buttonLabel = "받음";
                        else if (claimable) buttonLabel = "보상 받기";
                        else if (completed) buttonLabel = "완료";

                        const disabled = !claimable;

                        return (
                            <div
                                key={achievement.id}
                                style={{
                                    padding: 12,
                                    borderRadius: 12,
                                    background: "rgba(15,23,42,0.9)",
                                    border: "1px solid rgba(55,65,81,0.9)",
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
                                        {achievement.title}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "0.75rem",
                                            color: "#9ca3af",
                                            marginTop: 2,
                                        }}
                                    >
                                        {achievement.description}
                                    </div>

                                    {/* 진행도 */}
                                    <div
                                        style={{
                                            marginTop: 8,
                                            fontSize: "0.75rem",
                                            color: "#9ca3af",
                                        }}
                                    >
                                        진행도: {current} / {target} ({percent}
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
                                                    target > 0
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
                                        보상: 젬 {rewardGems}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!claimable) return;
                                            await claimAchievementReward(
                                                achievement.id,
                                            );
                                            setRewardModal({
                                                title: achievement.title,
                                                rewardGems,
                                            });
                                        }}
                                        disabled={disabled}
                                        style={{
                                            padding: "4px 10px",
                                            fontSize: "0.75rem",
                                            borderRadius: 999,
                                            border: "none",
                                            cursor: disabled
                                                ? "default"
                                                : "pointer",
                                            background: claimed
                                                ? "rgba(55,65,81,0.8)"
                                                : claimable
                                                    ? "linear-gradient(135deg,#22c55e,#16a34a)"
                                                    : "rgba(31,41,55,0.9)",
                                            color: claimed
                                                ? "#9ca3af"
                                                : "#e5e7eb",
                                            opacity: disabled ? 0.7 : 1,
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

            {/* ✅ 보상 모달 */}
            {rewardModal && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 50,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(0,0,0,0.6)",
                    }}
                >
                    <div
                        style={{
                            background: "rgba(15,23,42,0.98)",
                            borderRadius: 16,
                            border: "1px solid rgba(250,204,21,0.7)",
                            padding: "16px 20px",
                            width: 280,
                            boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                            textAlign: "center",
                            fontSize: "0.8rem",
                            color: "#e5e7eb",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                color: "#facc15",
                                marginBottom: 8,
                            }}
                        >
                            업적 보상 획득!
                        </div>
                        <div
                            style={{
                                whiteSpace: "pre-line",
                                marginBottom: 8,
                            }}
                        >
                            {rewardModal.title}
                            {"\n"}
                            <span style={{ color: "#facc15" }}>
                                젬 +{rewardModal.rewardGems}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setRewardModal(null)}
                            style={{
                                marginTop: 4,
                                padding: "6px 18px",
                                borderRadius: 999,
                                border: "none",
                                cursor: "pointer",
                                background:
                                    "linear-gradient(135deg,#facc15,#eab308)",
                                color: "#111827",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                            }}
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
