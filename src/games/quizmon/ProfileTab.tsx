// src/games/quizmon/ProfileTab.tsx
import type { QuizmonProfileRow } from "./types";

export type ProfileTabProps = {
    profile: QuizmonProfileRow | null;
    lastRaidResult?: { correct: number; total: number } | null;
};

export function ProfileTab({ profile, lastRaidResult }: ProfileTabProps) {
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

    const accuracy =
        totalQuestions > 0
            ? Math.round((totalCorrect / totalQuestions) * 100)
            : null;

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

                <div
                    style={{
                        borderRadius: 10,
                        background: "rgba(15,23,42,0.8)",
                        padding: "0.6rem 0.75rem",
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: "0.5rem",
                        fontSize: "0.78rem",
                    }}
                >
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
                            accuracy !== null
                                ? `${accuracy}%`
                                : "-%"
                        }
                    />
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
