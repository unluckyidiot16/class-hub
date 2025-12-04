// src/games/quizmon/StarShopTab.tsx
import { useEffect, useState } from "react";
import type { QuizmonProfileRow } from "./types";
import {
    type StarShopEntry,
    type StarPurchaseResult,
    loadStarShopEntries,
    purchaseSpeciesWithStarShards,
} from "./starShop";

export type StarShopTabProps = {
    profile: QuizmonProfileRow | null;
    onProfileUpdated?: (profile: QuizmonProfileRow) => void;
    onPurchased?: (result: StarPurchaseResult) => void;
};

export function StarShopTab(props: StarShopTabProps) {
    const { profile, onProfileUpdated, onPurchased } = props;

    const [entries, setEntries] = useState<StarShopEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [buyingId, setBuyingId] = useState<string | null>(null);

    const starShards = profile?.star_shards ?? 0;

    // ✅ 최초 로드 & profile 변경 시 상점 목록 불러오기
    useEffect(() => {
        if (!profile?.id) {
            setEntries([]);
            return;
        }

        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(null);
            try {
                const list = await loadStarShopEntries({
                    profileId: profile.id,
                });
                if (cancelled) return;
                setEntries(list);
            } catch (e: any) {
                if (cancelled) return;
                console.error("[StarShopTab] load error", e);
                setError(
                    typeof e?.message === "string"
                        ? e.message
                        : "상점 정보를 불러오는 중 오류가 발생했습니다.",
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
    }, [profile?.id]);

    const handleBuy = async (speciesId: string) => {
        if (!profile) {
            setError("프로필 정보를 찾을 수 없습니다.");
            return;
        }

        setBuyingId(speciesId);
        setError(null);

        try {
            const { result, updatedProfile } =
                await purchaseSpeciesWithStarShards({
                    profile,
                    speciesId,
                });

            // 상위에서 프로필 갱신
            onProfileUpdated?.(updatedProfile);
            onPurchased?.(result);

            // 상점 목록도 다시 로드
            const list = await loadStarShopEntries({
                profileId: updatedProfile.id,
            });
            setEntries(list);
        } catch (e: any) {
            console.error("[StarShopTab] buy error", e);
            setError(
                typeof e?.message === "string"
                    ? e.message
                    : "포켓몬을 구매하는 중 오류가 발생했습니다.",
            );
        } finally {
            setBuyingId(null);
        }
    };

    const disabledReason = (entry: StarShopEntry): string | null => {
        if (!profile) return "프로필 없음";
        if (entry.alreadyOwned) return "이미 보유";
        if (starShards < entry.starShardsPrice) return "파편 부족";
        return null;
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
                        ⭐ Star Shards 상점
                    </div>
                    <div
                        style={{
                            fontSize: 11,
                            color: "#9ca3af",
                        }}
                    >
                        중복 보상으로 모은 파편으로 고급 포켓몬을 직접 구매할 수 있어요.
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
                    ⭐ Star Shards:{" "}
                    <span
                        style={{
                            color: "#facc15",
                            fontWeight: 700,
                        }}
                    >
                        {starShards}
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
                    상점 목록을 불러오는 중입니다...
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
                    const { species, starShardsPrice, alreadyOwned } = entry;
                    const disabledMsg = disabledReason(entry);
                    const isDisabled =
                        !!disabledMsg || buyingId === species.id;

                    return (
                        <div
                            key={species.id}
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
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                }}
                            >
                                {species.name}
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: "#9ca3af",
                                }}
                            >
                                #{species.pokedex_no ?? "??"} ·{" "}
                                {species.element}
                                {species.element2
                                    ? ` / ${species.element2}`
                                    : ""}
                            </div>

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
                                    ⭐ {starShardsPrice.toLocaleString()} Shards
                                </div>

                                {alreadyOwned && (
                                    <span
                                        style={{
                                            fontSize: 11,
                                            padding: "2px 6px",
                                            borderRadius: 999,
                                            backgroundColor:
                                                "rgba(34,197,94,0.15)",
                                            color: "#bbf7d0",
                                            border: "1px solid rgba(34,197,94,0.4)",
                                        }}
                                    >
                                        보유중
                                    </span>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => handleBuy(species.id)}
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
                                {buyingId === species.id
                                    ? "구매 중..."
                                    : disabledMsg ?? "구매하기"}
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
                        아직 Star Shards 상점에 등록된 포켓몬이 없습니다.
                    </div>
                )}
            </div>
        </div>
    );
}
