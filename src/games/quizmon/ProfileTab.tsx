// src/games/quizmon/ProfileTab.tsx
import { useMemo } from "react";
import type { QuizmonProfileRow } from "./types";

export type ProfileTabProps = {
    profile: QuizmonProfileRow | null;
    lastRaidResult?: { correct: number; total: number } | null;
    onOpenLevelUpModal?: () => void; // ⭐ optional
    onBuyExpDust?: () => void;
};


export function ProfileTab({
                               profile,
                               lastRaidResult,
                               onOpenLevelUpModal,
                               onBuyExpDust,
                           }: ProfileTabProps) {
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

    const totalRaids = profile.total_raids ?? 0;
    const totalCorrect = profile.total_correct ?? 0;
    const totalQuestions = profile.total_questions ?? 0;

    const gold = (profile as any).gold ?? 0;
    const gems = (profile as any).gems ?? 0;
    const shards = (profile as any).star_shards ?? 0;

    const accuracy =
        totalQuestions > 0
            ? Math.round((totalCorrect / totalQuestions) * 100)
            : null;

    // 트레이너 레벨/경험치 (필드 없으면 기본값)
    const trainerLevel =
        (profile as any).trainer_level != null
            ? (profile as any).trainer_level
            : 1;
    const trainerExp =
        (profile as any).trainer_exp != null
            ? (profile as any).trainer_exp
            : 0;
    const trainerExpToNext =
        (profile as any).trainer_exp_to_next != null
            ? (profile as any).trainer_exp_to_next
            : 100;

    const expRatio = useMemo(() => {
        if (!trainerExpToNext || trainerExpToNext <= 0) return 0;
        return Math.max(
            0,
            Math.min(1, trainerExp / trainerExpToNext),
        );
    }, [trainerExp, trainerExpToNext]);

    const lastRaidText =
        lastRaidResult && lastRaidResult.total > 0
            ? `${lastRaidResult.correct} / ${lastRaidResult.total} 문제 정답`
            : "아직 최근 레이드 기록이 없습니다.";

    return (
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

                {/* 경험치 게이지 */}
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
                            fontSize: "0.75rem",
                            opacity: 0.9,
                            marginTop: 4,
                        }}
                    >
                        앞으로는 여기에서 트레이너 레벨별 보상,
                        도전 과제 등을 추가해 게임 진행을 돕는
                        구조로 확장할 예정입니다.
                    </div>
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

                {/* ⭐ 골드 → Exp Dust 상점 (MVP) */}
                <div
                    style={{
                        marginTop: 8,
                        borderRadius: 10,
                        background: "rgba(15,23,42,0.9)",
                        padding: "0.6rem 0.75rem",
                        fontSize: "0.78rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.4rem",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "0.8rem",
                                fontWeight: 500,
                            }}
                        >
                            강화 아이템 상점 (Gold → Exp Dust)
                        </div>
                        <div
                            style={{
                                fontSize: "0.75rem",
                                color: "#eab308",
                            }}
                        >
                            Gold: {gold} · Gems: {gems} · Shards: {shards}
                        </div>
                    </div>

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
                                fontSize: "0.75rem",
                                color: "#cbd5f5",
                            }}
                        >
                            Exp Dust 1개를 Gold 10개로 구매합니다.
                            (MVP용 단일 상품)
                        </div>
                        <button
                            type="button"
                            onClick={onBuyExpDust}
                            disabled={!onBuyExpDust || gold < 10}
                            style={{
                                padding: "0.35rem 0.8rem",
                                borderRadius: 999,
                                border: "none",
                                backgroundColor:
                                    !onBuyExpDust || gold < 10
                                        ? "#4b556380"
                                        : "#facc15",
                                color:
                                    !onBuyExpDust || gold < 10
                                        ? "#9ca3af"
                                        : "#1f2937",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor:
                                    !onBuyExpDust || gold < 10
                                        ? "not-allowed"
                                        : "pointer",
                            }}
                        >
                            Exp Dust 1개 구매
                        </button>
                    </div>
                </div>
            </div>
        </div>
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
