// src/games/quizmon/ProfileTab.tsx
import { useEffect, useMemo, useState } from "react";
import type { QuizmonProfileRow } from "./types";
import { supabase } from "../../lib/supabaseClient";

export type ProfileTabProps = {
    profile: QuizmonProfileRow | null;
    lastRaidResult?: { correct: number; total: number } | null;
};

export function ProfileTab({ profile, lastRaidResult }: ProfileTabProps) {
    // 인벤토리(Exp Dust / 레어 캔디) 및 레벨업 모달 상태
    const [levelModalOpen, setLevelModalOpen] = useState(false);
    const [inventoryLoading, setInventoryLoading] = useState(false);
    const [inventoryError, setInventoryError] = useState<string | null>(null);
    const [expDustCount, setExpDustCount] = useState(0);
    const [rareCandyCount, setRareCandyCount] = useState(0);

    // 현재 프로필 기준 인벤토리에서 강화 아이템만 간단히 집계
    useEffect(() => {
        if (!profile?.id) {
            setExpDustCount(0);
            setRareCandyCount(0);
            return;
        }

        let cancelled = false;

        const loadInventory = async () => {
            setInventoryLoading(true);
            setInventoryError(null);

            const { data, error } = await supabase
                .from("quizmon_inventory")
                .select("quantity, quizmon_items(item_type)")
                .eq("profile_id", profile.id);

            if (cancelled) return;

            if (error) {
                console.error("[ProfileTab] inventory select error", error);
                setInventoryError("인벤토리를 불러오는 중 오류가 발생했습니다.");
                setExpDustCount(0);
                setRareCandyCount(0);
            } else {
                let dust = 0;
                let candy = 0;

                (data ?? []).forEach((row: any) => {
                    const q = row.quantity ?? 0;
                    const t = row.quizmon_items?.item_type as string | undefined;
                    if (t === "exp_dust") dust += q;
                    if (t === "rare_candy") candy += q;
                });

                setExpDustCount(dust);
                setRareCandyCount(candy);
            }

            setInventoryLoading(false);
        };

        void loadInventory();

        return () => {
            cancelled = true;
        };
    }, [profile?.id]);

    // 트레이너 누적 기록 (profile이 없어도 0으로 계산)
    const totalRaids = profile?.total_raids ?? 0;
    const totalCorrect = profile?.total_correct ?? 0;
    const totalQuestions = profile?.total_questions ?? 0;

    const accuracy =
        totalQuestions > 0
            ? Math.round((totalCorrect / totalQuestions) * 100)
            : null;

    // 트레이너 레벨/경험치 (아직 DB에 필드가 없다면 기본값으로 동작)
    const trainerLevel =
        (profile as any)?.trainer_level != null
            ? (profile as any).trainer_level
            : 1;
    const trainerExp =
        (profile as any)?.trainer_exp != null
            ? (profile as any).trainer_exp
            : 0;
    const trainerExpToNext =
        (profile as any)?.trainer_exp_to_next != null
            ? (profile as any).trainer_exp_to_next
            : 100;

    const expRatio = useMemo(() => {
        if (!trainerExpToNext || trainerExpToNext <= 0) return 0;
        return Math.max(
            0,
            Math.min(1, trainerExp / trainerExpToNext),
        );
    }, [trainerExp, trainerExpToNext]);

    const handleLevelUpSingle = async () => {
        // TODO: quizmon_inventory / quizmon_profiles 업데이트 서비스와 연결
        setLevelModalOpen(false);
        window.alert(
            "1레벨 업 기능은 아직 서비스와 연결되지 않았습니다.\n" +
            "quizmonService에 Exp Dust / 레어 캔디 소비 로직을 추가한 뒤 이 버튼에서 호출해 주세요.",
        );
    };

    const handleLevelUpMax = async () => {
        // TODO: quizmon_inventory / quizmon_profiles 업데이트 서비스와 연결
        setLevelModalOpen(false);
        window.alert(
            "최대 레벨 업 기능은 아직 서비스와 연결되지 않았습니다.\n" +
            "가지고 있는 강화 아이템 수만큼 레벨을 올리는 로직을 나중에 연결해 주세요.",
        );
    };

    if (!profile) {
        return (
            <div
                style={{
                    fontSize: "0.8rem",
                    color: "#9ca3af",
                    padding: "0.5rem",
                }}
            >
                프로필 정보를 불러오는 중이거나 아직 생성되지 않았습니다.
            </div>
        );
    }

    const lastRaidText =
        lastRaidResult && lastRaidResult.total > 0
            ? `${lastRaidResult.correct} / ${lastRaidResult.total} 문제 정답`
            : "아직 최근 레이드 기록이 없습니다.";

    const totalPowerItems = expDustCount + rareCandyCount;

    return (
        <>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1.1fr 1fr",
                    gap: "0.75rem",
                    height: "100%",
                }}
            >
                {/* 왼쪽: 트레이너 / 누적 기록 */}
                <div
                    style={{
                        borderRadius: 12,
                        border: "1px solid rgba(148,163,184,0.5)",
                        padding: "0.9rem 0.9rem 0.75rem",
                        background:
                            "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,64,175,0.8))",
                        color: "#e5e7eb",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                    }}
                >
                    <div>
                        <div
                            style={{
                                fontSize: "0.85rem",
                                marginBottom: 4,
                            }}
                        >
                            트레이너 정보
                        </div>
                        <div
                            style={{
                                fontSize: "1rem",
                                fontWeight: 600,
                            }}
                        >
                            {profile.trainer_name ?? "미지의 트레이너"}
                        </div>
                        <div
                            style={{
                                fontSize: "0.8rem",
                                color: "#cbd5f5",
                                marginTop: 4,
                            }}
                        >
                            클래스 ID: {profile.class_id}
                        </div>
                    </div>

                    {/* 레벨 / 누적 통계 */}
                    <div
                        style={{
                            borderRadius: 10,
                            background: "rgba(15,23,42,0.8)",
                            padding: "0.6rem 0.75rem",
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(3, minmax(0, 1fr))",
                            gap: "0.5rem",
                            fontSize: "0.78rem",
                        }}
                    >
                        <StatChip
                            label="트레이너 레벨"
                            value={`Lv.${trainerLevel}`}
                        />
                        <StatChip
                            label="경험치"
                            value={`${trainerExp} / ${trainerExpToNext}`}
                        />
                        <StatChip
                            label="누적 레이드"
                            value={`${totalRaids}회`}
                        />
                        <StatChip
                            label="누적 정답"
                            value={`${totalCorrect}문제`}
                        />
                        <StatChip
                            label="총 풀이 문제"
                            value={`${totalQuestions}문제`}
                        />
                        <StatChip
                            label="정답률"
                            value={
                                accuracy !== null ? `${accuracy}%` : "-%"
                            }
                        />
                    </div>

                    {/* 경험치 게이지 + 인벤토리 요약 + 레벨업 버튼 */}
                    <div
                        style={{
                            borderRadius: 10,
                            background: "rgba(15,23,42,0.85)",
                            padding: "0.6rem 0.75rem 0.55rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.35rem",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "0.5rem",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "0.8rem",
                                    color: "#e5e7eb",
                                    fontWeight: 500,
                                }}
                            >
                                레벨 진행도
                            </div>
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    color: "#cbd5f5",
                                }}
                            >
                                {trainerExp} / {trainerExpToNext}
                            </div>
                        </div>
                        <div
                            style={{
                                position: "relative",
                                height: 10,
                                borderRadius: 999,
                                background: "rgba(15,23,42,0.9)",
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    background:
                                        "linear-gradient(90deg, #22c55e, #16a34a)",
                                    transformOrigin: "left center",
                                    transform: `scaleX(${expRatio})`,
                                    transition: "transform 200ms ease-out",
                                }}
                            />
                        </div>

                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "0.5rem",
                                marginTop: 4,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    color: "#9ca3af",
                                }}
                            >
                                사용 가능: Exp Dust{" "}
                                <span
                                    style={{
                                        color: "#e5e7eb",
                                        fontWeight: 600,
                                    }}
                                >
                                    {expDustCount}개
                                </span>
                                {" · "}레어 캔디{" "}
                                <span
                                    style={{
                                        color: "#e5e7eb",
                                        fontWeight: 600,
                                    }}
                                >
                                    {rareCandyCount}개
                                </span>
                                {inventoryLoading && " (불러오는 중)"}
                            </div>
                            <button
                                type="button"
                                onClick={() => setLevelModalOpen(true)}
                                disabled={
                                    inventoryLoading ||
                                    totalPowerItems === 0
                                }
                                style={{
                                    padding: "0.28rem 0.75rem",
                                    borderRadius: 999,
                                    border: "none",
                                    fontSize: "0.78rem",
                                    fontWeight: 600,
                                    cursor:
                                        inventoryLoading ||
                                        totalPowerItems === 0
                                            ? "not-allowed"
                                            : "pointer",
                                    background:
                                        inventoryLoading ||
                                        totalPowerItems === 0
                                            ? "rgba(75,85,99,0.9)"
                                            : "linear-gradient(90deg, #22c55e, #16a34a)",
                                    color: "#f9fafb",
                                    boxShadow:
                                        inventoryLoading ||
                                        totalPowerItems === 0
                                            ? "none"
                                            : "0 0 0 1px rgba(22,163,74,0.4)",
                                    opacity:
                                        inventoryLoading ||
                                        totalPowerItems === 0
                                            ? 0.6
                                            : 1,
                                }}
                            >
                                레벨 업
                            </button>
                        </div>
                        {inventoryError && (
                            <div
                                style={{
                                    marginTop: 4,
                                    fontSize: "0.72rem",
                                    color: "#f97373",
                                }}
                            >
                                {inventoryError}
                            </div>
                        )}
                    </div>

                    <div
                        style={{
                            fontSize: "0.75rem",
                            opacity: 0.9,
                        }}
                    >
                        앞으로는 여기에서 레이드별 상세 기록, 즐겨쓰는
                        몬스터, 수업별 통계 등을 더 자세히 볼 수 있도록
                        확장할 예정입니다.
                    </div>
                </div>

                {/* 오른쪽: 최근 레이드 / 메모 영역 */}
                <div
                    style={{
                        borderRadius: 12,
                        border: "1px solid rgba(148,163,184,0.5)",
                        padding: "0.9rem 0.9rem 0.75rem",
                        background:
                            "radial-gradient(circle at top, rgba(55,65,81,0.9), rgba(15,23,42,0.97))",
                        color: "#e5e7eb",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.6rem",
                    }}
                >
                    <div
                        style={{
                            fontSize: "0.85rem",
                            marginBottom: 2,
                        }}
                    >
                        최근 레이드 결과
                    </div>
                    <div
                        style={{
                            borderRadius: 10,
                            background: "rgba(15,23,42,0.9)",
                            padding: "0.6rem 0.75rem",
                            fontSize: "0.8rem",
                        }}
                    >
                        {lastRaidText}
                    </div>

                    <div
                        style={{
                            fontSize: "0.75rem",
                            opacity: 0.9,
                            marginTop: 4,
                        }}
                    >
                        교사가 레이드 결과를 바탕으로 피드백을 줄 수 있는
                        메모 영역이나, 학생에게 보여 줄 칭찬/도전 과제
                        안내도 이곳에 배치할 수 있습니다.
                    </div>
                </div>
            </div>

            {/* 레벨 업 모달 */}
            {levelModalOpen && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(15,23,42,0.75)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 40,
                    }}
                    onClick={() => setLevelModalOpen(false)}
                >
                    <div
                        style={{
                            width: "min(420px, 90vw)",
                            borderRadius: 16,
                            background:
                                "linear-gradient(135deg, #020617, #020617, #0f172a)",
                            border: "1px solid rgba(148,163,184,0.7)",
                            padding: "1rem 1.1rem 0.9rem",
                            boxShadow:
                                "0 18px 45px rgba(15,23,42,0.9)",
                            color: "#e5e7eb",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 8,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "0.9rem",
                                    fontWeight: 600,
                                }}
                            >
                                트레이너 레벨 업
                            </div>
                            <button
                                type="button"
                                onClick={() => setLevelModalOpen(false)}
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    color: "#9ca3af",
                                    cursor: "pointer",
                                    fontSize: "1rem",
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div
                            style={{
                                fontSize: "0.8rem",
                                color: "#cbd5f5",
                                marginBottom: 10,
                            }}
                        >
                            Exp Dust / 레어 캔디를 사용해 트레이너
                            레벨을 올릴 수 있습니다. 실제 경험치 계산과
                            아이템 소비 로직은 나중에 서비스에
                            연결하면 됩니다.
                        </div>

                        <div
                            style={{
                                borderRadius: 10,
                                background: "rgba(15,23,42,0.95)",
                                padding: "0.65rem 0.75rem",
                                marginBottom: 10,
                                display: "grid",
                                gridTemplateColumns:
                                    "repeat(2, minmax(0, 1fr))",
                                gap: "0.75rem",
                                fontSize: "0.8rem",
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "#9ca3af",
                                        marginBottom: 4,
                                    }}
                                >
                                    현재 레벨
                                </div>
                                <div
                                    style={{
                                        fontSize: "1.1rem",
                                        fontWeight: 700,
                                    }}
                                >
                                    Lv.{trainerLevel}
                                </div>
                                <div
                                    style={{
                                        marginTop: 4,
                                        fontSize: "0.75rem",
                                        color: "#cbd5f5",
                                    }}
                                >
                                    경험치 {trainerExp} /{" "}
                                    {trainerExpToNext}
                                </div>
                            </div>
                            <div
                                style={{
                                    borderLeft:
                                        "1px dashed rgba(55,65,81,0.9)",
                                    paddingLeft: "0.75rem",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "#9ca3af",
                                        marginBottom: 4,
                                    }}
                                >
                                    사용 가능 아이템
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 4,
                                    }}
                                >
                                    <div>
                                        <span
                                            style={{
                                                color: "#e5e7eb",
                                                fontWeight: 600,
                                            }}
                                        >
                                            Exp Dust
                                        </span>{" "}
                                        × {expDustCount}
                                    </div>
                                    <div>
                                        <span
                                            style={{
                                                color: "#e5e7eb",
                                                fontWeight: 600,
                                            }}
                                        >
                                            레어 캔디
                                        </span>{" "}
                                        × {rareCandyCount}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                gap: "0.5rem",
                                marginTop: 4,
                            }}
                        >
                            <button
                                type="button"
                                onClick={handleLevelUpSingle}
                                disabled={totalPowerItems === 0}
                                style={{
                                    flex: 1,
                                    padding: "0.55rem 0.5rem",
                                    borderRadius: 999,
                                    border: "none",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                    cursor:
                                        totalPowerItems === 0
                                            ? "not-allowed"
                                            : "pointer",
                                    background:
                                        totalPowerItems === 0
                                            ? "rgba(75,85,99,0.9)"
                                            : "linear-gradient(90deg, #22c55e, #16a34a)",
                                    color: "#f9fafb",
                                    opacity:
                                        totalPowerItems === 0
                                            ? 0.6
                                            : 1,
                                }}
                            >
                                1 레벨 업
                            </button>
                            <button
                                type="button"
                                onClick={handleLevelUpMax}
                                disabled={totalPowerItems === 0}
                                style={{
                                    flex: 1,
                                    padding: "0.55rem 0.5rem",
                                    borderRadius: 999,
                                    border: "none",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                    cursor:
                                        totalPowerItems === 0
                                            ? "not-allowed"
                                            : "pointer",
                                    background:
                                        totalPowerItems === 0
                                            ? "rgba(75,85,99,0.9)"
                                            : "linear-gradient(90deg, #4f46e5, #7c3aed)",
                                    color: "#f9fafb",
                                    opacity:
                                        totalPowerItems === 0
                                            ? 0.6
                                            : 1,
                                }}
                            >
                                최대 레벨 업
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

type StatChipProps = {
    label: string;
    value: string;
};

function StatChip({ label, value }: StatChipProps) {
    return (
        <div
            style={{
                borderRadius: 8,
                border: "1px solid rgba(55,65,81,0.9)",
                padding: "0.45rem 0.55rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.15rem",
            }}
        >
            <div
                style={{
                    fontSize: "0.7rem",
                    color: "#9ca3af",
                }}
            >
                {label}
            </div>
            <div
                style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#e5e7eb",
                }}
            >
                {value}
            </div>
        </div>
    );
}
