// src/games/quizmon/PartyAndDexPanel.tsx
import { useEffect, useMemo, useState } from "react";
import type { QuizmonProfileRow, QuizmonOwnedMonsterRow } from "./types";
import { getMonsterIcon } from "./assets";

type EnhancedOwnedMonster = QuizmonOwnedMonsterRow & {
    /** 리스트/파티에 표시할 이름 */
    displayName: string;
    /** HP 상태 등 간단 상태 텍스트 */
    statusText: string;
};

/**
 * DB에서 가져온 quizmon_owned_monsters 1마리를
 * UI에서 쓰기 좋은 형태로 가공
 */
function enhanceOwned(mon: QuizmonOwnedMonsterRow): EnhancedOwnedMonster {
    const anyMon = mon as any;

    const rawSpeciesId = (anyMon.species_id as string | null) ?? "";
    const displayId =
        (anyMon.display_id as string | null) ??
        (rawSpeciesId.startsWith("poke-")
            ? rawSpeciesId.slice("poke-".length)
            : rawSpeciesId.padStart(4, "0") || "????");

    const displayName = `포켓몬 #${displayId}`;

    const hp = anyMon.current_hp as number | null;
    const isFainted = Boolean(anyMon.is_fainted);

    let statusText: string;

    if (isFainted) {
        statusText = "기절";
    } else if (hp == null) {
        // null = 풀피 가정
        statusText = "HP 풀피";
    } else {
        statusText = `HP ${hp}`;
    }

    return {
        ...mon,
        displayName,
        statusText,
    };
}

export type PartyAndDexPanelProps = {
    /** 학생의 퀴즈몬 프로필 (트레이너 이름 표시에 사용) */
    profile: QuizmonProfileRow | null;
    /** 보유 몬스터 목록 (Supabase에서 그대로 내려온 값) */
    monsters?: QuizmonOwnedMonsterRow[];
    /** 로딩/에러 표시용 */
    collectionLoading?: boolean;
    collectionError?: string | null;
    /** 무료 소환 버튼 핸들러(있으면 상단에 표시) */
    onPullFreeGacha?: () => void | Promise<void>;
    onHealAll?: () => void;
    /** 파티 슬롯 변경 시 DB에 저장하고 싶을 때 사용 */
    onSaveParty?: (
        partyIds: (string | null)[],
    ) => void | Promise<void>;
};

export function PartyAndDexPanel(props: PartyAndDexPanelProps) {
    const { profile, onHealAll } = props;

    // 원본 → 표시용으로 가공
    const enhancedMonsters = useMemo(
        () => (props.monsters ?? []).map((m) => enhanceOwned(m)),
        [props.monsters],
    );

    // 선택된 파트너
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        if (!enhancedMonsters.length) {
            setSelectedId(null);
            return;
        }

        if (
            selectedId &&
            enhancedMonsters.some((m) => m.id === selectedId)
        ) {
            return;
        }

        setSelectedId(enhancedMonsters[0].id);
    }, [enhancedMonsters, selectedId]);

    const selected = enhancedMonsters.find((m) => m.id === selectedId) ?? null;

    // 파티 슬롯(3인 고정)
    const [partyIds, setPartyIds] = useState<(string | null)[]>(() => {
        const anyProfile = profile as any;
        const slot1 = (anyProfile.party_slot_1 as string | null) ?? null;
        const slot2 = (anyProfile.party_slot_2 as string | null) ?? null;
        const slot3 = (anyProfile.party_slot_3 as string | null) ?? null;
        return [slot1, slot2, slot3];
    });

    // partyIds 변경 시 onSaveParty 콜백 호출
    useEffect(() => {
        if (!props.onSaveParty) return;
        void props.onSaveParty(partyIds);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [partyIds]);

    // 파티 슬롯 클릭 시: 선택된 몬스터 배치 / 제거
    function handlePartySlotClick(index: number) {
        const current = partyIds[index];

        // 선택된 몬스터가 없으면 아무 것도 하지 않음
        if (!selected) return;

        // 이미 해당 슬롯에 같은 몬스터가 있으면 제거
        if (current === selected.id) {
            setPartyIds((prev) => {
                const next = [...prev];
                next[index] = null;
                return next;
            });
            return;
        }

        // 다른 슬롯에 들어 있는지 확인 후 제거
        setPartyIds((prev) => {
            const next = [...prev];
            const existingIndex = next.findIndex((id) => id === selected.id);
            if (existingIndex !== -1) {
                next[existingIndex] = null;
            }
            next[index] = selected.id;
            return next;
        });
    }

    // 파티에서 제거 버튼 (슬롯 비우기)
    function handleRemoveFromParty(index: number) {
        setPartyIds((prev) => {
            const next = [...prev];
            next[index] = null;
            return next;
        });
    }

    // 하단 도감 리스트에서 특정 몬스터 클릭 시 선택
    function handleDexClick(mon: EnhancedOwnedMonster) {
        setSelectedId(mon.id);
    }

    // 파티 슬롯에 배치된 몬스터 찾기
    function getMonsterInSlot(slotIndex: number): EnhancedOwnedMonster | null {
        const id = partyIds[slotIndex];
        if (!id) return null;
        return enhancedMonsters.find((m) => m.id === id) ?? null;
    }

    const dexEntries = enhancedMonsters;

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                height: "100%",
            }}
        >
            {/* 상단: 파티 3인 + 파트너 상세 */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1.1fr 1fr",
                    gap: "0.75rem",
                    minHeight: 220,
                }}
            >
                {/* 왼쪽: 파티 슬롯 3개 */}
                <div
                    style={{
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.2)",
                        padding: "0.75rem",
                        background:
                            "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,64,175,0.6))",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                    }}
                >
                    <div
                        style={{
                            fontSize: "0.85rem",
                            color: "#e5e7eb",
                            marginBottom: 4,
                        }}
                    >
                        내 파트너 / 파티
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: "0.5rem",
                        }}
                    >
                        {partyIds.map((_, idx) => {
                            const mon = getMonsterInSlot(idx);
                            const label = `슬롯 ${idx + 1}`;
                            const iconUrl = mon
                                ? getMonsterIcon(mon.species_id)
                                : null;
                            const isEmpty = !mon;

                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() =>
                                        handlePartySlotClick(idx)
                                    }
                                    style={{
                                        borderRadius: 10,
                                        border: isEmpty
                                            ? "1px dashed rgba(148,163,184,0.6)"
                                            : "1px solid rgba(252,211,77,0.9)",
                                        padding: "0.5rem",
                                        background: isEmpty
                                            ? "rgba(15,23,42,0.8)"
                                            : "linear-gradient(145deg, rgba(30,64,175,0.9), rgba(129,140,248,0.8))",
                                        color: isEmpty
                                            ? "#9ca3af"
                                            : "#fefce8",
                                        fontSize: "0.8rem",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "0.25rem",
                                    }}
                                >
                                    <div>{label}</div>
                                    {iconUrl && (
                                        <img
                                            src={iconUrl}
                                            alt={mon?.displayName}
                                            style={{
                                                width: 40,
                                                height: 40,
                                                imageRendering: "pixelated",
                                            }}
                                        />
                                    )}
                                    <div
                                        style={{
                                            fontSize: "0.7rem",
                                            opacity: 0.9,
                                        }}
                                    >
                                        {mon
                                            ? mon.displayName
                                            : "비어 있음"}
                                    </div>
                                    {mon && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveFromParty(idx);
                                            }}
                                            style={{
                                                marginTop: 4,
                                                padding:
                                                    "2px 6px",
                                                borderRadius: 999,
                                                border: "none",
                                                fontSize: "0.7rem",
                                                background:
                                                    "rgba(15,23,42,0.8)",
                                                color: "#e5e7eb",
                                            }}
                                        >
                                            파티에서 빼기
                                        </button>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {onHealAll && (
                        <button
                            type="button"
                            onClick={onHealAll}
                            style={{
                                marginTop: "0.5rem",
                                alignSelf: "flex-end",
                                padding:
                                    "0.35rem 0.75rem",
                                fontSize: "0.75rem",
                                borderRadius: 999,
                                border: "none",
                                background:
                                    "linear-gradient(90deg, #22c55e, #16a34a)",
                                color: "white",
                            }}
                        >
                            파티 전체 회복
                        </button>
                    )}
                </div>

                {/* 오른쪽: 선택된 파트너 상세 */}
                <div
                    style={{
                        borderRadius: 12,
                        border: "1px solid rgba(148,163,184,0.5)",
                        padding: "0.75rem",
                        background:
                            "radial-gradient(circle at top, rgba(55,65,81,0.9), rgba(15,23,42,0.95))",
                        color: "#e5e7eb",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.3rem",
                    }}
                >
                    <div
                        style={{
                            fontSize: "0.85rem",
                            marginBottom: 4,
                        }}
                    >
                        선택된 파트너
                    </div>
                    {!selected && (
                        <div
                            style={{
                                fontSize: "0.8rem",
                                opacity: 0.7,
                            }}
                        >
                            아래 도감에서 몬스터를 선택해 주세요.
                        </div>
                    )}
                    {selected && (
                        <>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                }}
                            >
                                {(() => {
                                    const iconUrl = getMonsterIcon(
                                        selected.species_id,
                                    );
                                    return (
                                        iconUrl && (
                                            <img
                                                src={iconUrl}
                                                alt={selected.displayName}
                                                style={{
                                                    width: 48,
                                                    height: 48,
                                                    imageRendering:
                                                        "pixelated",
                                                }}
                                            />
                                        )
                                    );
                                })()}
                                <div>
                                    <div
                                        style={{
                                            fontSize: "0.9rem",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {selected.displayName}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "0.75rem",
                                            opacity: 0.85,
                                        }}
                                    >
                                        Lv.{selected.level} ·{" "}
                                        {selected.statusText}
                                    </div>
                                </div>
                            </div>
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    opacity: 0.9,
                                    marginTop: 4,
                                }}
                            >
                                앞으로는 여기에서 개체 값, 성장,
                                레이드 기록 등을 자세히 보여 줄
                                예정입니다.
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* 하단: 도감 리스트 */}
            <div
                style={{
                    flex: 1,
                    borderRadius: 12,
                    border: "1px solid rgba(148,163,184,0.6)",
                    padding: "0.75rem",
                    background:
                        "linear-gradient(180deg, rgba(15,23,42,0.95), rgba(30,64,175,0.75))",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    minHeight: 160,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.85rem",
                        color: "#e5e7eb",
                    }}
                >
                    <div>도감 / 보유 몬스터</div>
                    {props.onPullFreeGacha && (
                        <button
                            type="button"
                            onClick={() =>
                                props.onPullFreeGacha?.()
                            }
                            style={{
                                padding:
                                    "0.3rem 0.7rem",
                                borderRadius: 999,
                                border: "none",
                                fontSize: "0.75rem",
                                background:
                                    "linear-gradient(90deg, #facc15, #f97316)",
                                color: "#171717",
                            }}
                        >
                            무료 소환 1회
                        </button>
                    )}
                </div>
                <div
                    style={{
                        flex: 1,
                        overflow: "auto",
                        padding: "0.25rem",
                        borderRadius: 8,
                        background:
                            "rgba(15,23,42,0.85)",
                    }}
                >
                    {props.collectionLoading && (
                        <div
                            style={{
                                fontSize: "0.8rem",
                                opacity: 0.8,
                            }}
                        >
                            보유 몬스터를 불러오는 중...
                        </div>
                    )}
                    {props.collectionError && (
                        <div
                            style={{
                                fontSize: "0.8rem",
                                color: "#fecaca",
                            }}
                        >
                            {props.collectionError}
                        </div>
                    )}
                    {!props.collectionLoading &&
                        !props.collectionError && (
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                        "repeat(auto-fill, minmax(96px, 1fr))",
                                    gap: "0.5rem",
                                }}
                            >
                                {dexEntries.map((entry) => {
                                    const iconUrl = getMonsterIcon(
                                        entry.species_id,
                                    );
                                    const label =
                                        entry.displayName;

                                    return (
                                        <button
                                            key={entry.id}
                                            type="button"
                                            onClick={() =>
                                                handleDexClick(
                                                    entry,
                                                )
                                            }
                                            style={{
                                                borderRadius: 10,
                                                border:
                                                    selectedId ===
                                                    entry.id
                                                        ? "1px solid rgba(252,211,77,0.9)"
                                                        : "1px solid rgba(55,65,81,0.9)",
                                                padding: "0.35rem",
                                                background:
                                                    "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,64,175,0.8))",
                                                color: "#e5e7eb",
                                                display: "flex",
                                                flexDirection:
                                                    "column",
                                                alignItems:
                                                    "center",
                                                gap: "0.25rem",
                                                fontSize: "0.7rem",
                                            }}
                                        >
                                            {iconUrl && (
                                                <img
                                                    src={iconUrl}
                                                    alt={label}
                                                    style={{
                                                        width: 40,
                                                        height: 40,
                                                        imageRendering:
                                                            "pixelated",
                                                    }}
                                                />
                                            )}
                                            <div
                                                style={{
                                                    textAlign:
                                                        "center",
                                                }}
                                            >
                                                <div>{label}</div>
                                                <div
                                                    style={{
                                                        opacity: 0.85,
                                                    }}
                                                >
                                                    Lv.
                                                    {entry.level} ·{" "}
                                                    {
                                                        entry.statusText
                                                    }
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    {dexEntries.length === 0 && (
                        <div
                            style={{
                                fontSize: "0.8rem",
                                opacity: 0.7,
                            }}
                        >
                            아직 도감에 등록된 몬스터가 없습니다.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
