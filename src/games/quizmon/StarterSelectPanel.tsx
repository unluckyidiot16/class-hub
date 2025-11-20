// src/games/quizmon/StarterSelectPanel.tsx
import { useState } from "react";

type StarterSelectPanelProps = {
    onChooseStarter: (speciesId: string) => Promise<void> | void;
    disabled?: boolean;
};

// 화면에 보여줄 메타 정보 (DB에는 같은 id로 들어가 있음)
const STARTER_OPTIONS = [
    {
        id: "starter-001",
        name: "이상해씨",
        elementLabel: "풀",
        description: "균형 잡힌 풀 타입 스타터",
    },
    {
        id: "starter-002",
        name: "파이리",
        elementLabel: "불꽃",
        description: "공격적인 불꽃 타입 스타터",
    },
    {
        id: "starter-003",
        name: "꼬부기",
        elementLabel: "물",
        description: "방어적인 물 타입 스타터",
    },
] as const;

export function StarterSelectPanel(props: StarterSelectPanelProps) {
    const { onChooseStarter, disabled } = props;
    const [selectingId, setSelectingId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleClick = async (speciesId: string) => {
        if (disabled || selectingId) return;

        setErrorMsg(null);
        setSelectingId(speciesId);
        try {
            await onChooseStarter(speciesId);
        } catch (err) {
            console.error("[StarterSelectPanel] choose error", err);
            setErrorMsg("스타터를 선택하는 중 오류가 발생했습니다.");
            setSelectingId(null);
        }
    };

    return (
        <section className="card" style={{ marginTop: "1rem" }}>
            <h2>첫 파트너를 선택하세요!</h2>
            <p className="page-desc">
                한 번 선택한 스타터는 변경할 수 없어요. 마음에 드는 친구를 골라주세요.
            </p>

            <div
                style={{
                    display: "flex",
                    gap: "1rem",
                    flexWrap: "wrap",
                    marginTop: "0.75rem",
                }}
            >
                {STARTER_OPTIONS.map((starter) => {
                    const isBusy = selectingId === starter.id;
                    return (
                        <button
                            key={starter.id}
                            type="button"
                            className="secondary-btn"
                            disabled={disabled || !!selectingId}
                            onClick={() => handleClick(starter.id)}
                            style={{
                                flex: "1 1 160px",
                                textAlign: "left",
                                padding: "0.75rem",
                                borderRadius: 8,
                                border: "1px solid #444",
                                background:
                                    selectingId === starter.id ? "#1e293b" : "#020617",
                                cursor:
                                    disabled || !!selectingId ? "not-allowed" : "pointer",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <div>
                                    <div
                                        style={{
                                            fontWeight: 600,
                                            marginBottom: 4,
                                        }}
                                    >
                                        {starter.name}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: "#9ca3af",
                                        }}
                                    >
                                        {starter.elementLabel} 타입
                                    </div>
                                </div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "#e5e7eb",
                                    }}
                                >
                                    {starter.description}
                                </div>
                            </div>

                            {isBusy && (
                                <p
                                    style={{
                                        marginTop: 6,
                                        fontSize: 12,
                                        color: "#22c55e",
                                    }}
                                >
                                    선택 중...
                                </p>
                            )}
                        </button>
                    );
                })}
            </div>

            {errorMsg && (
                <p className="form-message error" style={{ marginTop: "0.5rem" }}>
                    {errorMsg}
                </p>
            )}

            <p className="form-message help" style={{ marginTop: "0.5rem" }}>
                ※ 스타터는 계정당 한 번만 선택됩니다.
            </p>
        </section>
    );
}
