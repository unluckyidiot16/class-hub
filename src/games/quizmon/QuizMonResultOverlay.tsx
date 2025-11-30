// src/games/quizmon/QuizMonResultOverlay.tsx
import { HpBar } from "./HpBar";
import type { Monster } from "./types";

export type BattleStats = {
    correct: number;
    total: number;
};

export type QuizMonResultOverlayProps = {
    variant?: "dungeon" | "raid";
    resultMessage: string;
    stats: BattleStats;
    accuracyPercent: number | null;
    playerMon: Monster;
    enemyMon: Monster;
    onBackToMenu: () => void;
    onRetry: () => void;
};

export function QuizMonResultOverlay(props: QuizMonResultOverlayProps) {
    const {
        variant = "dungeon",
        resultMessage,
        stats,
        accuracyPercent,
        playerMon,
        enemyMon,
        onBackToMenu,
        onRetry,
    } = props;

    const isRaid = variant === "raid";

    const headerLabel = isRaid ? "레이드 전투 결과" : "배틀 결과";

    const backButtonLabel = isRaid ? "레이드 메뉴로" : "던전 선택으로";
    const retryButtonLabel = isRaid ? "다음 레이드" : "다시 도전";

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.72)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1rem",
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: 480,
                    borderRadius: 8,
                    border: "2px solid #b91c1c",
                    background:
                        "linear-gradient(180deg,#111827 0%,#020617 100%)",
                    padding: "0.9rem 1rem 0.8rem",
                    color: "#f9fafb",
                    boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                }}
            >
                <div
                    style={{
                        fontSize: 12,
                        color: "#fecaca",
                        marginBottom: 4,
                    }}
                >
                    {headerLabel}
                </div>
                <div
                    style={{
                        fontSize: 16,
                        fontWeight: 700,
                        marginBottom: 8,
                    }}
                >
                    {resultMessage}
                </div>

                <div
                    style={{
                        fontSize: 13,
                        marginBottom: 4,
                    }}
                >
                    정답 {stats.correct} / {stats.total}
                    {stats.total > 0 &&
                        typeof accuracyPercent === "number" &&
                        ` (${accuracyPercent}%)`}
                </div>

                {isRaid && (
                    <div
                        style={{
                            fontSize: 11,
                            marginBottom: 8,
                            color: "#e5e7eb",
                        }}
                    >
                        이 전투의 정답 수와 정확도는{" "}
                        <strong>클래스 레이드 누적 데미지</strong>에
                        반영됩니다.
                    </div>
                )}

                {/* 내 파트너 / 상대 포켓몬 요약 */}
                <div
                    style={{
                        display: "flex",
                        gap: 12,
                        fontSize: 12,
                    }}
                >
                    <div
                        style={{
                            flex: 1,
                            padding: "0.4rem 0.5rem",
                            borderRadius: 6,
                            border: "1px solid #1f2937",
                            background: "#020617",
                        }}
                    >
                        <div
                            style={{
                                fontSize: 11,
                                color: "#9ca3af",
                            }}
                        >
                            내 파트너
                        </div>
                        <div
                            style={{
                                fontWeight: 600,
                                marginBottom: 2,
                            }}
                        >
                            {playerMon.name}
                        </div>
                        <div
                            style={{
                                fontSize: 11,
                                marginBottom: 2,
                            }}
                        >
                            HP {playerMon.hp}/{playerMon.maxHp}
                        </div>
                        <HpBar current={playerMon.hp} max={playerMon.maxHp} />
                    </div>

                    <div
                        style={{
                            flex: 1,
                            padding: "0.4rem 0.5rem",
                            borderRadius: 6,
                            border: "1px solid #1f2937",
                            background: "#020617",
                        }}
                    >
                        <div
                            style={{
                                fontSize: 11,
                                color: "#9ca3af",
                            }}
                        >
                            상대 포켓몬
                        </div>
                        <div
                            style={{
                                fontWeight: 600,
                                marginBottom: 2,
                            }}
                        >
                            {enemyMon.name}
                        </div>
                        <div
                            style={{
                                fontSize: 11,
                                marginBottom: 2,
                            }}
                        >
                            HP {enemyMon.hp}/{enemyMon.maxHp}
                        </div>
                        <HpBar current={enemyMon.hp} max={enemyMon.maxHp} />
                    </div>
                </div>

                {/* 버튼들 */}
                <div
                    style={{
                        marginTop: 10,
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 8,
                    }}
                >
                    <button
                        type="button"
                        onClick={onBackToMenu}
                        style={{
                            padding: "0.35rem 0.9rem",
                            borderRadius: 999,
                            border: "1px solid #4b5563",
                            background: "#020617",
                            color: "#e5e7eb",
                            fontSize: 12,
                            cursor: "pointer",
                        }}
                    >
                        {backButtonLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onRetry}
                        style={{
                            padding: "0.35rem 0.9rem",
                            borderRadius: 999,
                            border: "1px solid #b91c1c",
                            background:
                                "linear-gradient(90deg,#b91c1c,#f97316)",
                            color: "#fef2f2",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        {retryButtonLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}