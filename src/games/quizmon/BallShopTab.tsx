// src/games/quizmon/BallShopTab.tsx
import { useEffect, useState } from "react";
import type { QuizmonProfileRow } from "./types";
import {
    type BallShopEntry,
    type BallPurchaseResult,
    loadBallShopEntries,
    purchaseBallWithGold,
} from "./ballShop";

export type BallShopTabProps = {
    profile: QuizmonProfileRow | null;
    onProfileUpdated?: (profile: QuizmonProfileRow) => void;
    onPurchased?: (result: BallPurchaseResult) => void;
};

export function BallShopTab(props: BallShopTabProps) {
    const { profile, onProfileUpdated, onPurchased } = props;

    const [localProfile, setLocalProfile] = useState<QuizmonProfileRow | null>(
        profile,
    );
    const [entries, setEntries] = useState<BallShopEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [buyingId, setBuyingId] = useState<string | null>(null);

    // 상위 profile 이 바뀌면 로컬 상태도 동기화
    useEffect(() => {
        setLocalProfile(profile);
    }, [profile?.id, profile?.gold]);

    const effectiveProfile = localProfile ?? profile;
    const gold = effectiveProfile?.gold ?? 0;

    // 상점 목록 로드
    useEffect(() => {
        if (!effectiveProfile?.id) {
            setEntries([]);
            return;
        }

        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(null);
            try {
                const list = await loadBallShopEntries({
                    profileId: effectiveProfile.id,
                });
                if (cancelled) return;
                setEntries(list);
            } catch (e: any) {
                if (cancelled) return;
                console.error("[BallShopTab] load error", e);
                setError(
                    typeof e?.message === "string"
                        ? e.message
                        : "포켓볼 상점 정보를 불러오는 중 오류가 발생했습니다.",
                );
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [effectiveProfile?.id]);

    const handleBuy = async (itemId: string) => {
        const baseProfile = effectiveProfile;
        if (!baseProfile) {
            setError("프로필 정보를 찾을 수 없습니다.");
            return;
        }

        setBuyingId(itemId);
        setError(null);

        try {
            const { result, updatedProfile } = await purchaseBallWithGold({
                profile: baseProfile,
                itemId,
                quantity: 1,
            });

            // 로컬 프로필 갱신 (골드 감소 반영)
            setLocalProfile(updatedProfile);

            // 상위 프로필 갱신 (헤더 등)
            onProfileUpdated?.(updatedProfile);
            onPurchased?.(result);

            // 상점 목록도 다시 로드 (보유 수량 갱신용)
            const list = await loadBallShopEntries({
                profileId: updatedProfile.id,
            });
            setEntries(list);
        } catch (e: any) {
            console.error("[BallShopTab] buy error", e);
            setError(
                typeof e?.message === "string"
                    ? e.message
                    : "포켓볼을 구매하는 중 오류가 발생했습니다.",
            );
        } finally {
            setBuyingId(null);
        }
    };

    const disabledReason = (entry: BallShopEntry): string | null => {
        if (!effectiveProfile) return "프로필 없음";
        if (gold < entry.goldPrice) return "골드 부족";
        return null;
    };

    const getBallLabel = (entry: BallShopEntry) => {
        switch (entry.ballType) {
            case "poke":
                return "기본 포켓볼";
            case "great":
                return "슈퍼볼";
            case "ultra":
                return "하이퍼볼";
            default:
                return "포켓볼";
        }
    };

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                color: "#e5e7eb",
            }}
        >
            {/* 헤더 */}
            <div
                style={{
                    marginBottom: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: 14,
                            fontWeight: 600,
                        }}
                    >
                        🎯 포켓볼 상점
                    </div>
                    <div
                        style={{
                            fontSize: 11,
                            color: "#9ca3af",
                        }}
                    >
                        골드로 포켓볼을 구입해 포획 확률을 높여보세요.
                    </div>
                </div>

                <div
                    style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: "1px solid #4b5563",
                        fontSize: 12,
                        background: "rgba(15,23,42,0.9)",
                    }}
                >
                    💰 Gold:{" "}
                    <span
                        style={{
                            color: "#facc15",
                            fontWeight: 700,
                        }}
                    >
                        {gold.toLocaleString()}
                    </span>
                </div>
            </div>

            {/* 에러 / 로딩 */}
            {error && (
                <div
                    style={{
                        marginBottom: 8,
                        padding: "6px 10px",
                        borderRadius: 8,
                        backgroundColor: "rgba(127,29,29,0.2)",
                        border: "1px solid #7f1d1d",
                        fontSize: 12,
                    }}
                >
                    {error}
                </div>
            )}

            {loading && !entries.length && (
                <div
                    style={{
                        fontSize: 12,
                        color: "#9ca3af",
                        padding: 8,
                    }}
                >
                    포켓볼 목록을 불러오는 중입니다...
                </div>
            )}

            {/* 목록 */}
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    marginTop: 4,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 10,
                }}
            >
                {entries.map((entry) => {
                    const disabledMsg = disabledReason(entry);
                    const isDisabled = 
                        !!disabledMsg || buyingId === entry.item.id;
                    return (<div
                            key={entry.item.id}
                            style={{
                                borderRadius: 12,
                                border: "1px solid #1f2937",
                                background:
                                    "linear-gradient(135deg,#020617,#020617,#111827)",
                                padding: 10,
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                            }}
                        >
                            {/* 이름 + 타입 */}
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 8,
                                }}
                            >
                                <div>
                                    <div
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 600,
                                        }}
                                    >
                                        {getBallLabel(entry)}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: "#9ca3af",
                                        }}
                                    >
                                        {entry.item.name}
                                    </div>
                                </div>

                                {/* 간단한 보유 수량 표시 */}
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "#9ca3af",
                                        textAlign: "right",
                                    }}
                                >
                                    보유:{" "}
                                    <span
                                        style={{
                                            color: "#bfdbfe",
                                            fontWeight: 600,
                                        }}
                                    >
                                      {entry.quantityOwned}
                                    </span>
                                </div>
                            </div>

                            {entry.item.description && (
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "#9ca3af",
                                        marginTop: 2,
                                    }}
                                >
                                    {entry.item.description}
                                </div>
                            )}

                            {/* 가격 */}
                            <div
                                style={{
                                    marginTop: 4,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 8,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "#fbbf24",
                                    }}
                                >
                                    💰 {entry.goldPrice.toLocaleString()} Gold
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleBuy(entry.item.id)}
                                disabled={isDisabled}
                                style={{
                                    marginTop: 6,
                                    padding: "6px 8px",
                                    borderRadius: 8,
                                    border: "1px solid #4b5563",
                                    backgroundColor: isDisabled
                                        ? "rgba(15,23,42,0.6)"
                                        : "#0f172a",
                                    color: isDisabled ? "#6b7280" : "#e5e7eb",
                                    fontSize: 12,
                                    cursor: isDisabled
                                        ? "default"
                                        : "pointer",
                                    textAlign: "center",
                                }}
                            >
                                {buyingId === entry.item.id
                                    ? "구매 중..."
                                    : disabledMsg ?? "1개 구매"}
                            </button>
                        </div>
                    );
                })}

                {!loading && !entries.length && (
                    <div
                        style={{
                            fontSize: 12,
                            color: "#9ca3af",
                        }}
                    >
                        아직 포켓볼 상점에 등록된 아이템이 없습니다.
                    </div>
                )}
            </div>
        </div>
    );
}
