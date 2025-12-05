// src/games/quizmon/RaidResultPanel.tsx
import type { CSSProperties } from "react";

export type RaidResultSummary = {
    correct: number;
    total: number;

    // 골드 / Dust
    rewardedGold: number;
    rewardedExpDust: number;

    // 트레이너 경험치/레벨/젬
    gainedTrainerExp: number;
    trainerLevelBefore: number;
    trainerLevelAfter: number;
    gainedTrainerLevels: number;
    gainedTrainerGems: number;
};

type RaidResultPanelProps = {
    open: boolean;
    onClose: () => void;
    summary: RaidResultSummary | null;
};

export function RaidResultPanel({ open, onClose, summary }: RaidResultPanelProps) {
    if (!open || !summary) return null;

    const {
        correct,
        total,
        rewardedGold,
        rewardedExpDust,
        gainedTrainerExp,
        trainerLevelBefore,
        trainerLevelAfter,
        gainedTrainerLevels,
        gainedTrainerGems,
    } = summary;

    const didLevelUp = gainedTrainerLevels > 0;

    const overlayStyle: CSSProperties = {
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
    };

    const panelStyle: CSSProperties = {
        width: "min(480px, 90vw)",
        backgroundColor: "#111827",
        color: "white",
        borderRadius: 16,
        padding: 24,
        boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
    };

    const headerStyle: CSSProperties = {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    };

    const titleStyle: CSSProperties = {
        fontSize: 20,
        fontWeight: 700,
    };

    const closeButtonStyle: CSSProperties = {
        border: "none",
        background: "transparent",
        color: "rgba(249,250,251,0.8)",
        fontSize: 20,
        cursor: "pointer",
    };

    const sectionTitleStyle: CSSProperties = {
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        color: "rgba(209,213,219,0.9)",
    };

    const statRowStyle: CSSProperties = {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 14,
        padding: "6px 0",
    };

    const labelStyle: CSSProperties = {
        color: "rgba(209,213,219,0.9)",
    };

    const valueStyle: CSSProperties = {
        fontWeight: 600,
    };

    const highlightValueStyle: CSSProperties = {
        ...valueStyle,
        color: "#fbbf24",
    };

    const levelUpBoxStyle: CSSProperties = {
        marginTop: 4,
        padding: "8px 10px",
        borderRadius: 10,
        background:
            "linear-gradient(90deg, rgba(251,191,36,0.2), rgba(34,197,94,0.05))",
        border: "1px solid rgba(251,191,36,0.5)",
        fontSize: 13,
    };

    const footerStyle: CSSProperties = {
        display: "flex",
        justifyContent: "flex-end",
        marginTop: 8,
    };

    const okButtonStyle: CSSProperties = {
        minWidth: 96,
        padding: "8px 16px",
        borderRadius: 999,
        border: "none",
        background:
            "linear-gradient(135deg, #10b981, #22c55e)",
        color: "white",
        fontWeight: 600,
        fontSize: 14,
        cursor: "pointer",
        boxShadow: "0 8px 18px rgba(16,185,129,0.35)",
    };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div
                style={panelStyle}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div style={headerStyle}>
                    <div style={titleStyle}>레이드 결과</div>
                    <button style={closeButtonStyle} onClick={onClose}>
                        ✕
                    </button>
                </div>

                {/* 정답 요약 */}
                <div>
                    <div style={sectionTitleStyle}>퀴즈 요약</div>
                    <div style={statRowStyle}>
                        <span style={labelStyle}>정답 수</span>
                        <span style={valueStyle}>
                            {correct} / {total}
                        </span>
                    </div>
                </div>

                {/* 보상 요약 */}
                <div>
                    <div style={sectionTitleStyle}>보상</div>

                    <div style={statRowStyle}>
                        <span style={labelStyle}>골드</span>
                        <span style={highlightValueStyle}>+{rewardedGold}</span>
                    </div>
                    <div style={statRowStyle}>
                        <span style={labelStyle}>Exp Dust</span>
                        <span style={highlightValueStyle}>+{rewardedExpDust}</span>
                    </div>
                    <div style={statRowStyle}>
                        <span style={labelStyle}>트레이너 EXP</span>
                        <span style={highlightValueStyle}>+{gainedTrainerExp}</span>
                    </div>

                    {/* 트레이너 레벨 / 젬 보상 */}
                    <div style={{ marginTop: 8 }}>
                        <div style={statRowStyle}>
                            <span style={labelStyle}>트레이너 레벨</span>
                            <span style={valueStyle}>
                                Lv. {trainerLevelBefore} →{" "}
                                <span
                                    style={{
                                        ...valueStyle,
                                        color: didLevelUp ? "#a5b4fc" : "white",
                                    }}
                                >
                                    Lv. {trainerLevelAfter}
                                </span>
                            </span>
                        </div>

                        {didLevelUp && (
                            <div style={levelUpBoxStyle}>
                                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                                    🎉 레벨 업!
                                </div>
                                <div>
                                    <strong>{gainedTrainerLevels}</strong>레벨 상승 &nbsp;/&nbsp;
                                    <strong>+{gainedTrainerGems}</strong> 젬 획득
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 확인 버튼 */}
                <div style={footerStyle}>
                    <button style={okButtonStyle} onClick={onClose}>
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
}
