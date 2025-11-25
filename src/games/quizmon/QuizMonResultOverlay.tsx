// src/games/quizmon/QuizMonResultOverlay.tsx
import { HpBar } from "./HpBar";
import type { Monster } from "./types";

export type BattleStats = {
    correct: number;
    total: number;
};

export type QuizMonResultOverlayProps = {
    resultMessage: string;
    stats: BattleStats;
    accuracyPercent: number;
    playerMon: Monster;
    enemyMon: Monster;
    onBackToMenu: () => void;
    onRetry: () => void;
};

export function QuizMonResultOverlay(props: QuizMonResultOverlayProps) {
    const {
        resultMessage,
        stats,
        accuracyPercent,
        playerMon,
        enemyMon,
        onBackToMenu,
        onRetry,
    } = props;

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
                    배틀 결과
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
                        marginBottom: 8,
                    }}
                >
                    정답 {stats.correct} / {stats.total} ({accuracyPercent}
                    %)
                </div>

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
                        <HpBar
                            current={playerMon.hp}
                            max={playerMon.maxHp}
                        />
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
                        <HpBar
                            current={enemyMon.hp}
                            max={enemyMon.maxHp}
                        />
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
                        메뉴로
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
                        다시 도전
                    </button>
                </div>
            </div>
        </div>
    );
}
