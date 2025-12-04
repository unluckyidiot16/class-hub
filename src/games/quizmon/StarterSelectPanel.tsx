// src/games/quizmon/StarterSelectPanel.tsx
import { useState } from "react";
import { getMonsterSprite } from "./assets";

type StarterSelectPanelProps = {
    onChooseStarter: (payload: {
        speciesId: string;
        trainerName: string;
    }) => Promise<void> | void;
    disabled?: boolean;
};

type StarterOption = {
    id: string;
    name: string;
    elementLabel: string;
    description: string;
};

// 화면에 보여줄 메타 정보 (DB에는 같은 id로 들어가 있음)
const STARTER_OPTIONS: StarterOption[] = [
    {
        id: "poke-0001", // 이상해씨 (#001)
        name: "이상해씨",
        elementLabel: "풀",
        description: "균형 잡힌 풀 타입 스타터",
    },
    {
        id: "poke-0004", // 파이리 (#004)
        name: "파이리",
        elementLabel: "불꽃",
        description: "공격적인 불 타입 스타터",
    },
    {
        id: "poke-0007", // 꼬부기 (#007)
        name: "꼬부기",
        elementLabel: "물",
        description: "방어적인 물 타입 스타터",
    },
];

export function StarterSelectPanel(props: StarterSelectPanelProps) {
    const { onChooseStarter, disabled } = props;
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [trainerName, setTrainerName] = useState("");

    const handleChoose = async (id: string) => {
        if (disabled || submittingId) return;

        if (!trainerName.trim()) {
            setErrorMsg("트레이너 이름을 먼저 입력해 주세요.");
            return;
        }

        setErrorMsg(null);
        setSubmittingId(id);
        try {
            await onChooseStarter({
                speciesId: id,
                trainerName: trainerName.trim(),
            });
            // 성공하면 상위에서 프로필 갱신 → 이 패널은 자연스럽게 사라짐
        } catch (err) {
            console.error("[StarterSelectPanel] choose starter error", err);
            setErrorMsg(
                "스타터를 선택하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
            );
            setSubmittingId(null);
        }
    };

    const isNameInvalid = !trainerName.trim();

    return (
        <section className="card">
            <h2 style={{ marginTop: 0 }}>첫 파트너 선택</h2>

            {/* 🔹 트레이너 이름 입력 */}
            <div style={{ marginBottom: "1rem" }}>
                <label
                    style={{
                        display: "block",
                        fontSize: 14,
                        fontWeight: 500,
                        marginBottom: 4,
                    }}
                >
                    트레이너 이름
                </label>
                <input
                    type="text"
                    maxLength={20}
                    value={trainerName}
                    onChange={(e) => setTrainerName(e.target.value)}
                    disabled={disabled || !!submittingId}
                    placeholder="예: 안쌤, 퀴즈마스터 등"
                    style={{
                        width: "100%",
                        padding: "0.45rem 0.6rem",
                        borderRadius: 8,
                        border: "1px solid #4b5563",
                        background: "#020617",
                        color: "#e5e7eb",
                        fontSize: 14,
                    }}
                />
                <p className="form-message help" style={{ marginTop: 4 }}>
                    배틀 화면에서 표시될 이름이에요.
                </p>
            </div>

            <p className="form-message help" style={{ marginBottom: "1rem" }}>
                이번 학기 동안 함께 싸울 첫 파트너를 선택해 주세요.
            </p>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "1rem",
                }}
            >
                {STARTER_OPTIONS.map((opt) => {
                    const spriteUrl = getMonsterSprite(opt.id);
                    const isSubmitting = submittingId === opt.id;

                    return (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => void handleChoose(opt.id)}
                            disabled={
                                disabled || !!submittingId || isNameInvalid
                            }
                            style={{
                                textAlign: "left",
                                borderRadius: 16,
                                padding: "0.75rem 0.9rem",
                                border: "1px solid #1f2937",
                                background: "#020617",
                                cursor:
                                    disabled ||
                                    submittingId ||
                                    isNameInvalid
                                        ? "default"
                                        : "pointer",
                                opacity:
                                    disabled ||
                                    (!!submittingId && !isSubmitting) ||
                                    isNameInvalid
                                        ? 0.5
                                        : 1,
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.5rem",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.75rem",
                                }}
                            >
                                <div
                                    style={{
                                        width: 80,
                                        height: 80,
                                        borderRadius: 16,
                                        background: "#000",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        overflow: "hidden",
                                        flexShrink: 0,
                                    }}
                                >
                                    {spriteUrl && (
                                        <img
                                            src={spriteUrl}
                                            alt={opt.name}
                                            style={{
                                                width: 72,
                                                height: 72,
                                                imageRendering: "pixelated",
                                            }}
                                        />
                                    )}
                                </div>

                                <div>
                                    <div
                                        style={{
                                            fontSize: 16,
                                            fontWeight: 600,
                                            color: "#e5e7eb",
                                        }}
                                    >
                                        {opt.name}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 13,
                                            color: "#a5b4fc",
                                            marginTop: 2,
                                        }}
                                    >
                                        {opt.elementLabel} 타입
                                    </div>
                                </div>
                            </div>

                            <p
                                style={{
                                    fontSize: 13,
                                    color: "#9ca3af",
                                    margin: 0,
                                    marginTop: 4,
                                }}
                            >
                                {opt.description}
                            </p>

                            <div style={{ marginTop: "0.5rem" }}>
                                <span
                                    className="secondary-btn"
                                    style={{
                                        display: "inline-block",
                                        fontSize: 13,
                                        paddingInline: "0.85rem",
                                        paddingBlock: "0.3rem",
                                    }}
                                >
                                    {isSubmitting ? "선택 중..." : "이 파트너로 선택"}
                                </span>
                            </div>
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
