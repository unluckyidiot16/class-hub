// src/games/quizmon/ArenaTab.tsx
import type {
    QuizmonProfileRow,
    QuizmonOwnedMonsterRow,
} from "./types";
import { getMonsterIcon } from "./assets";

export type ArenaOpponentMonster = {
    speciesId: string;
    level?: number | null;
    hidden?: boolean; // 랭크 높을수록 true로 해서 가리기
};

export type ArenaOpponent = {
    id: string;
    name: string;
    rating: number;
    isGhost?: boolean;
    monsters: ArenaOpponentMonster[]; // 최대 3칸
};

export type ArenaTabProps = {
    profile: QuizmonProfileRow | null;

    // 현재 시즌/랭크 정보
    rating?: number | null;       // ELO
    tierLabel?: string | null;    // "브론즈", "실버" 등 (없으면 내부에서 계산)

    // 파티 정보
    attackParty: QuizmonOwnedMonsterRow[];
    defenseParty: QuizmonOwnedMonsterRow[];

    // 매칭 대상들
    opponents: ArenaOpponent[];
    onSelectOpponent?: (opponent: ArenaOpponent) => void;
};

function getTierFromRating(rating?: number | null): string {
    const r = rating ?? 1000;
    if (r >= 1800) return "마스터";
    if (r >= 1600) return "다이아";
    if (r >= 1400) return "플래티넘";
    if (r >= 1200) return "골드";
    if (r >= 1000) return "실버";
    return "브론즈";
}

function PartyRow(props: {
    label: string;
    monsters: QuizmonOwnedMonsterRow[];
}) {
    const slots: (QuizmonOwnedMonsterRow | null)[] = [null, null, null];
    for (const mon of props.monsters) {
        if (!mon.party_slot) continue;
        const idx = mon.party_slot - 1;
        if (idx >= 0 && idx < 3) {
            slots[idx] = mon;
        }
    }

    return (
        <div
            style={{
                background:
                    "linear-gradient(135deg, rgba(15,118,110,0.4), rgba(8,47,73,0.8))",
                borderRadius: 16,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
            }}
        >
            <div
                style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#a5f3fc",
                }}
            >
                {props.label}
            </div>
            <div
                style={{
                    display: "flex",
                    gap: 8,
                }}
            >
                {slots.map((mon, i) => {
                    const icon = mon
                        ? getMonsterIcon(mon.species_id)
                        : null;
                    return (
                        <div
                            key={i}
                            style={{
                                flex: 1,
                                minHeight: 64,
                                borderRadius: 12,
                                backgroundColor: "rgba(15,23,42,0.9)",
                                border: "1px solid rgba(148,163,184,0.4)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                position: "relative",
                                overflow: "hidden",
                            }}
                        >
                            {mon && icon ? (
                                <>
                                    <img
                                        src={icon}
                                        alt={String(mon.species_id)}
                                        style={{
                                            width: 56,
                                            height: 56,
                                            imageRendering: "pixelated",
                                        }}
                                    />
                                    <div
                                        style={{
                                            position: "absolute",
                                            bottom: 4,
                                            right: 6,
                                            fontSize: "0.7rem",
                                            fontWeight: 700,
                                            color: "#e5e7eb",
                                            textShadow:
                                                "0 1px 2px rgba(0,0,0,0.8)",
                                        }}
                                    >
                                        Lv.{mon.level ?? 1}
                                    </div>
                                </>
                            ) : (
                                <div
                                    style={{
                                        fontSize: "0.9rem",
                                        color: "#4b5563",
                                    }}
                                >
                                    비어 있음
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function OpponentCard(props: {
    opponent: ArenaOpponent;
    onClick?: () => void;
}) {
    const { opponent } = props;
    const monsters = opponent.monsters.slice(0, 3);

    return (
        <button
            type="button"
            onClick={props.onClick}
            style={{
                width: "100%",
                borderRadius: 16,
                padding: "10px 14px",
                border: "1px solid rgba(148,163,184,0.5)",
                background:
                    "linear-gradient(90deg, rgba(30,64,175,0.7), rgba(76,29,149,0.9))",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                cursor: "pointer",
            }}
        >
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    alignItems: "flex-start",
                }}
            >
                <div
                    style={{
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "#c7d2fe",
                    }}
                >
                    {opponent.isGhost ? "고스트 대전" : "플레이어"}
                </div>
                <div
                    style={{
                        fontSize: "0.95rem",
                        fontWeight: 700,
                        color: "#e5e7eb",
                    }}
                >
                    {opponent.name}
                </div>
                <div
                    style={{
                        fontSize: "0.75rem",
                        color: "#e5e7eb",
                        opacity: 0.8,
                    }}
                >
                    ELO {opponent.rating}
                </div>
            </div>

            <div
                style={{
                    display: "flex",
                    gap: 8,
                }}
            >
                {monsters.map((m, idx) => {
                    if (!m || m.hidden) {
                        return (
                            <div
                                key={idx}
                                style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 12,
                                    backgroundColor: "rgba(15,23,42,0.9)",
                                    border:
                                        "1px dashed rgba(148,163,184,0.7)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "1.2rem",
                                    color: "#9ca3af",
                                }}
                            >
                                ?
                            </div>
                        );
                    }

                    const icon = getMonsterIcon(m.speciesId);
                    return (
                        <div
                            key={idx}
                            style={{
                                width: 52,
                                height: 52,
                                borderRadius: 12,
                                backgroundColor: "rgba(15,23,42,0.9)",
                                border:
                                    "1px solid rgba(248,250,252,0.85)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                position: "relative",
                                overflow: "hidden",
                            }}
                        >
                            {icon && (
                                <img
                                    src={icon}
                                    alt={m.speciesId}
                                    style={{
                                        width: 48,
                                        height: 48,
                                        imageRendering: "pixelated",
                                    }}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </button>
    );
}

export function ArenaTab({
                             profile,
                             rating,
                             tierLabel,
                             attackParty,
                             defenseParty,
                             opponents,
                             onSelectOpponent,
                         }: ArenaTabProps) {
    const effectiveRating = rating ?? 1000;
    const tier = tierLabel ?? getTierFromRating(effectiveRating);

    return (
        <div
            style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                gap: 16,
            }}
        >
            {/* 왼쪽: 티어 / 공격덱 / 방어덱 */}
            <div
                style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                }}
            >
                {/* 티어 + ELO */}
                <div
                    style={{
                        borderRadius: 16,
                        padding: "12px 14px",
                        background:
                            "linear-gradient(135deg, rgba(30,64,175,0.9), rgba(6,78,59,0.9))",
                        border: "1px solid rgba(191,219,254,0.8)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                        }}
                    >
                        <div
                            style={{
                                fontSize: "0.8rem",
                                color: "#d1fae5",
                            }}
                        >
                            현재 티어
                        </div>
                        <div
                            style={{
                                fontSize: "1.3rem",
                                fontWeight: 800,
                                letterSpacing: "0.04em",
                                color: "#f9fafb",
                            }}
                        >
                            {tier}
                        </div>
                    </div>
                    <div
                        style={{
                            textAlign: "right",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "0.75rem",
                                color: "#bfdbfe",
                            }}
                        >
                            ELO
                        </div>
                        <div
                            style={{
                                fontSize: "1.2rem",
                                fontWeight: 700,
                                color: "#e5e7eb",
                            }}
                        >
                            {effectiveRating}
                        </div>
                        {profile && (
                            <div
                                style={{
                                    fontSize: "0.7rem",
                                    color: "#9ca3af",
                                    marginTop: 2,
                                }}
                            >
                                {profile.trainer_name ?? "무명 트레이너"}
                            </div>
                        )}
                    </div>
                </div>

                <PartyRow label="공격 덱" monsters={attackParty} />
                <PartyRow label="방어 덱" monsters={defenseParty} />
            </div>

            {/* 오른쪽: 매칭 상대 리스트 (5칸) */}
            <div
                style={{
                    flex: 1.2,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                }}
            >
                <div
                    style={{
                        fontSize: "0.85rem",
                        color: "#e5e7eb",
                        marginBottom: 4,
                        display: "flex",
                        justifyContent: "space-between",
                    }}
                >
                    <span>추천 상대</span>
                    <span
                        style={{
                            fontSize: "0.75rem",
                            color: "#9ca3af",
                        }}
                    >
                        랭크가 올라갈수록 포켓몬이 가려집니다
                    </span>
                </div>

                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                    }}
                >
                    {opponents.map((op) => (
                        <OpponentCard
                            key={op.id}
                            opponent={op}
                            onClick={
                                onSelectOpponent
                                    ? () => onSelectOpponent(op)
                                    : undefined
                            }
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
