// src/games/quizmon/AchievementsTab.tsx
import { useEffect, useState } from "react";
import type { QuizmonProfileRow } from "./types";
import {
    loadAchievementsForProfile,
    claimAchievementRewardRpc,
    type QuizmonAchievementWithProgress,
} from "./quizmonAchievements";

export type AchievementsTabProps = {
    profile: QuizmonProfileRow | null;
};

export function AchievementsTab({ profile }: AchievementsTabProps) {
    const profileId = profile?.id ?? null;

    const [items, setItems] = useState<QuizmonAchievementWithProgress[]>([]);
    const [loading, setLoading] = useState(false);
    const [rewardModal, setRewardModal] = useState<{
        title: string;
        rewardGems: number;
    } | null>(null);

    const reload = async () => {
        if (!profileId) {
            setItems([]);
            return;
        }
        setLoading(true);
        try {
            const rows = await loadAchievementsForProfile(profileId);
            setItems(rows);
        } catch (err) {
            console.error("[AchievementsTab] load error", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profileId]);

    const handleClaimClick = async (a: QuizmonAchievementWithProgress) => {
        if (!profileId) return;
        if (!a.claimable) return;

        try {
            await claimAchievementRewardRpc(profileId, a.achievement.code);

            // ✅ 모달로 보상 안내
            setRewardModal({
                title: a.achievement.title,
                rewardGems: a.achievement.reward_gems,
            });

            // 목록 상태 갱신
            await reload();
        } catch (err) {
            console.error("[AchievementsTab] claim error", err);
        }
    };

    if (!profileId) {
        return (
            <div className="p-4 text-sm text-slate-300">
                프로필 정보를 찾을 수 없습니다.
            </div>
        );
    }

    return (
        <div className="relative h-full flex flex-col gap-3 p-4 text-sm text-slate-100">
            {loading && (
                <div className="text-xs text-slate-400 mb-2">
                    업적을 불러오는 중입니다...
                </div>
            )}

            <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
                {items.map((a) => {
                    const { achievement } = a;
                    const progress = a.progress ?? 0;
                    const target = achievement.condition_value || 0;
                    const percent =
                        target > 0 ? Math.min(100, (progress / target) * 100) : 0;

                    const statusLabel = a.claimed
                        ? "수령 완료"
                        : a.claimable
                            ? "보상 받기"
                            : a.completed
                                ? "완료"
                                : "진행 중";

                    return (
                        <div
                            key={achievement.id}
                            className="bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3 flex flex-col gap-2"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    <div className="font-semibold text-slate-50">
                                        {achievement.title}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5 whitespace-pre-line">
                                        {achievement.description}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className="text-xs text-yellow-300">
                                        보상: 젬 {achievement.reward_gems}
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!a.claimable}
                                        onClick={() => handleClaimClick(a)}
                                        className={`px-3 py-1 rounded-full text-xs font-semibold transition
                                            ${a.claimable
                                            ? "bg-emerald-500 hover:bg-emerald-400 text-slate-900"
                                            : "bg-slate-700 text-slate-300 cursor-default"
                                        }`}
                                    >
                                        {statusLabel}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-sky-400 transition-all"
                                        style={{ width: `${percent}%` }}
                                    />
                                </div>
                                <div className="whitespace-nowrap">
                                    진행도: {progress} / {target}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {items.length === 0 && !loading && (
                    <div className="text-xs text-slate-400">
                        활성화된 업적이 없습니다.
                    </div>
                )}
            </div>

            {/* ✅ 보상 모달 */}
            {rewardModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-slate-900 border border-yellow-400/60 rounded-xl px-6 py-5 w-[280px] shadow-xl text-center">
                        <div className="text-sm font-semibold text-yellow-300 mb-2">
                            업적 보상 획득!
                        </div>
                        <div className="text-xs text-slate-200 mb-3 whitespace-pre-line">
                            {rewardModal.title}
                            {"\n"}
                            <span className="text-yellow-300">
                                젬 +{rewardModal.rewardGems}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setRewardModal(null)}
                            className="mt-1 inline-flex items-center justify-center px-4 py-1.5 rounded-full text-xs font-semibold bg-yellow-400 text-slate-900 hover:bg-yellow-300 transition"
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
