// src/games/quizmon/PartyAndDexPanel.tsx
import { useEffect, useMemo, useState } from "react";
import type {
    QuizmonProfileRow,
    QuizmonOwnedMonsterRow,
} from "./types";
import { getMonsterIcon } from "./assets";

type EnhancedOwnedMonster = QuizmonOwnedMonsterRow & {
    displayName: string;
    statusText: string;
};

/** quizmon_owned_monsters 1마리를 UI용으로 가공 */
function enhanceOwned(mon: QuizmonOwnedMonsterRow): EnhancedOwnedMonster {
    const anyMon = mon as any;

    const rawSpeciesId = (anyMon.species_id as string | null) ?? "";
    const displayId = rawSpeciesId.startsWith("poke-")
        ? rawSpeciesId
        : `0000${rawSpeciesId}`.slice(-4); // poke-0001 / 0001 둘 다 커버용

    const displayName = `포켓몬 #${displayId}`;

    const hp = anyMon.current_hp as number | null;
    const isFainted = Boolean(anyMon.is_fainted);

    let statusText: string;
    if (isFainted) {
        statusText = "기절";
    } else if (hp == null) {
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

/** monsters.party_slot 기준으로 초기 파티 슬롯 구성 */
function buildInitialPartyIds(
    monsters?: QuizmonOwnedMonsterRow[],
): (string | null)[] {
    const base: (string | null)[] = [null, null, null];
    if (!monsters) return base;

    for (const m of monsters) {
        const anyMon = m as any;
        const slot = (anyMon.party_slot as number | null) ?? null;
        if (slot && slot >= 1 && slot <= 3) {
            base[slot - 1] = m.id;
        }
    }
    return base;
}

export type PartyAndDexPanelProps = {
    profile: QuizmonProfileRow | null;
    monsters?: QuizmonOwnedMonsterRow[];
    collectionLoading?: boolean;
    collectionError?: string | null;
    onPullFreeGacha?: () => void | Promise<void>;
    onHealAll?: () => void;
    onSaveParty?: (partyIds: (string | null)[]) => void | Promise<void>;
};

export function PartyAndDexPanel(props: PartyAndDexPanelProps) {
    const { profile } = props;

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

    const selected =
        enhancedMonsters.find((m) => m.id === selectedId) ?? null;

    // 파티 슬롯 (PokéRogue 스타일 3칸)
    const [partyIds, setPartyIds] = useState<(string | null)[]>(() =>
        buildInitialPartyIds(props.monsters),
    );

    // partyIds 변경 시 DB에 저장
    useEffect(() => {
        if (!props.onSaveParty) return;
        void props.onSaveParty(partyIds);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [partyIds]);

    function getMonsterInSlot(slotIndex: number): EnhancedOwnedMonster | null {
        const id = partyIds[slotIndex];
        if (!id) return null;
        return enhancedMonsters.find((m) => m.id === id) ?? null;
    }

    /** 슬롯 클릭: 선택된 몬스터 배치 / 제거 */
    function handlePartySlotClick(index: number) {
        const current = partyIds[index];
        if (!selected) return;

        // 이미 같은 몬스터 ⇒ 제거
        if (current === selected.id) {
            setPartyIds((prev) => {
                const next = [...prev];
                next[index] = null;
                return next;
            });
            return;
        }

        // 다른 슬롯에 있으면 먼저 제거 후 이 슬롯에 배치
        setPartyIds((prev) => {
            const next = [...prev];
            const existingIndex = next.findIndex(
                (id) => id === selected.id,
            );
            if (existingIndex !== -1) {
                next[existingIndex] = null;
            }
            next[index] = selected.id;
            return next;
        });
    }

    /** 지정 슬롯 비우기 */
    function handleRemoveFromParty(index: number) {
        setPartyIds((prev) => {
            const next = [...prev];
            next[index] = null;
            return next;
        });
    }

    /** 도감 카드 클릭 → 선택만 변경 */
    function handleDexClick(mon: EnhancedOwnedMonster) {
        setSelectedId(mon.id);
    }

    /** 선택된 몬스터가 몇 번 슬롯에 있는지 */
    function findSelectedSlotIndex(): number | null {
        if (!selected) return null;
        const idx = partyIds.findIndex((id) => id === selected.id);
        return idx === -1 ? null : idx;
    }

    const dexEntries = enhancedMonsters;
    const trainerName =
        profile?.trainer_name ?? "미지의 트레이너";
    const ownedCount = dexEntries.length;

    const selectedSlotIndex = findSelectedSlotIndex();

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                height: "100%",
            }}
        >
            {/* 상단: 파티(좌) + 선택한 파트너(우) */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr",
                    gap: "0.75rem",
                    minHeight: 220,
                }}
            >
                {/* 왼쪽: PokéRogue 스타일 파티 리스트 */}
                <div
                    style={{
                        borderRadius: 12,
                        border: "1px solid rgba(148,163,184,0.5)",
                        padding: "0.75rem 0.75rem 0.5rem",
                        background:
                            "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,64,175,0.75))",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                    }}
                >
                    <div
                        style={{
                            fontSize: "0.85rem",
                            color: "#e5e7eb",
                        }}
                    >
                        내 파트너 / 파티
                    </div>
                    <div
                        style={{
                            fontSize: "0.75rem",
                            color: "#9ca3af",
                            marginBottom: 4,
                        }}
                    >
                        트레이너: {trainerName}
                    </div>

                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.4rem",
                        }}
                    >
                        {[0, 1, 2].map((slotIndex) => {
                            const mon =
                                getMonsterInSlot(slotIndex);
                            const label = mon
                                ? mon.displayName
                                : "빈 슬롯";
                            const subtitle = mon
                                ? `Lv.${mon.level} · ${mon.statusText}`
                                : "도감에서 몬스터를 선택하면 자동으로 배치됩니다.";
                            const iconUrl = mon
                                ? getMonsterIcon(mon.species_id)
                                : null;

                            const isSelected =
                                mon && mon.id === selectedId;

                            return (
                                <button
                                    key={slotIndex}
                                    type="button"
                                    onClick={() =>
                                        handlePartySlotClick(
                                            slotIndex,
                                        )
                                    }
                                    style={{
                                        width: "100%",
                                        borderRadius: 999,
                                        padding:
                                            "0.4rem 0.75rem",
                                        border: mon
                                            ? isSelected
                                                ? "2px solid rgba(252,211,77,0.95)"
                                                : "1px solid rgba(55,65,81,0.9)"
                                            : "1px dashed rgba(75,85,99,0.9)",
                                        background: mon
                                            ? "linear-gradient(90deg, rgba(30,64,175,0.95), rgba(17,24,39,0.95))"
                                            : "rgba(15,23,42,0.9)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent:
                                            "space-between",
                                        gap: "0.75rem",
                                        color: "#e5e7eb",
                                    }}
                                >
                                    {/* 왼쪽: 아이콘 + 이름/HP */}
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.5rem",
                                        }}
                                    >
                                        {iconUrl && (
                                            <img
                                                src={iconUrl}
                                                alt={label}
                                                style={{
                                                    width: 36,
                                                    height: 36,
                                                    imageRendering:
                                                        "pixelated",
                                                }}
                                            />
                                        )}
                                        {!iconUrl && (
                                            <div
                                                style={{
                                                    width: 30,
                                                    height: 30,
                                                    borderRadius:
                                                        999,
                                                    border:
                                                        "1px dashed rgba(75,85,99,0.9)",
                                                    display:
                                                        "flex",
                                                    alignItems:
                                                        "center",
                                                    justifyContent:
                                                        "center",
                                                    fontSize:
                                                        "0.9rem",
                                                    color: "#9ca3af",
                                                }}
                                            >
                                                +
                                            </div>
                                        )}
                                        <div
                                            style={{
                                                textAlign: "left",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize:
                                                        "0.85rem",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {label}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize:
                                                        "0.75rem",
                                                    opacity: 0.9,
                                                }}
                                            >
                                                {subtitle}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 오른쪽: 파티 n번 텍스트 */}
                                    <div
                                        style={{
                                            fontSize:
                                                "0.7rem",
                                            color: "#cbd5f5",
                                            whiteSpace:
                                                "nowrap",
                                        }}
                                    >
                                        파티 {slotIndex + 1}
                                        번
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 오른쪽: 선택한 파트너 상세 + 전체 회복/빼기 */}
                <div
                    style={{
                        borderRadius: 12,
                        border: "1px solid rgba(148,163,184,0.5)",
                        padding: "0.75rem",
                        background:
                            "radial-gradient(circle at top, rgba(55,65,81,0.9), rgba(15,23,42,0.96))",
                        color: "#e5e7eb",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.45rem",
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
                                fontSize: "0.85rem",
                            }}
                        >
                            선택한 파트너
                        </div>
                        {selectedSlotIndex !== null && (
                            <button
                                type="button"
                                onClick={() =>
                                    handleRemoveFromParty(
                                        selectedSlotIndex,
                                    )
                                }
                                style={{
                                    padding:
                                        "0.25rem 0.9rem",
                                    borderRadius: 999,
                                    border: "none",
                                    fontSize: "0.7rem",
                                    background:
                                        "rgba(156,163,175,0.25)",
                                    color: "#e5e7eb",
                                }}
                            >
                                파티 {selectedSlotIndex + 1}
                                번에서 빼기
                            </button>
                        )}
                    </div>

                    {!selected && (
                        <div
                            style={{
                                fontSize: "0.8rem",
                                opacity: 0.75,
                            }}
                        >
                            아래 도감에서 몬스터를 선택하면
                            상세 정보를 볼 수 있습니다.
                        </div>
                    )}

                    {selected && (
                        <>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.75rem",
                                    marginTop: 4,
                                }}
                            >
                                {(() => {
                                    const iconUrl =
                                        getMonsterIcon(
                                            selected.species_id,
                                        );
                                    return (
                                        iconUrl && (
                                            <img
                                                src={iconUrl}
                                                alt={
                                                    selected.displayName
                                                }
                                                style={{
                                                    width: 56,
                                                    height: 56,
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
                                            fontSize: "0.95rem",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {selected.displayName}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "0.8rem",
                                            opacity: 0.9,
                                        }}
                                    >
                                        Lv.{selected.level} ·{" "}
                                        {selected.statusText}
                                    </div>
                                </div>
                            </div>

                            <div
                                style={{
                                    display: "flex",
                                    justifyContent:
                                        "flex-start",
                                    gap: "0.5rem",
                                    marginTop: 8,
                                }}
                            >
                                {props.onHealAll && (
                                    <button
                                        type="button"
                                        onClick={
                                            props.onHealAll
                                        }
                                        style={{
                                            padding:
                                                "0.35rem 0.95rem",
                                            borderRadius: 999,
                                            border: "none",
                                            fontSize: "0.75rem",
                                            background:
                                                "linear-gradient(90deg, #22c55e, #16a34a)",
                                            color: "white",
                                        }}
                                    >
                                        전체 회복
                                    </button>
                                )}
                            </div>

                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    opacity: 0.9,
                                    marginTop: 6,
                                }}
                            >
                                앞으로는 여기에서 개체 값,
                                성장, 레이드 기록 등을 자세히
                                보여 줄 예정입니다.
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* 하단: 도감 / 보유 몬스터 */}
            <div
                style={{
                    flex: 1,
                    borderRadius: 12,
                    border: "1px solid rgba(148,163,184,0.6)",
                    padding: "0.75rem",
                    background:
                        "linear-gradient(180deg, rgba(15,23,42,0.97), rgba(30,64,175,0.8))",
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
                    <div
                        style={{
                            fontSize: "0.75rem",
                            color: "#9ca3af",
                        }}
                    >
                        소유 {ownedCount}종
                    </div>
                </div>

                <div
                    style={{
                        flex: 1,
                        borderRadius: 8,
                        background: "rgba(15,23,42,0.9)",
                        padding: "0.35rem",
                        overflow: "auto",
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
                        !props.collectionError &&
                        dexEntries.length > 0 && (
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                        "repeat(auto-fill, minmax(110px, 1fr))",
                                    gap: "0.5rem",
                                }}
                            >
                                {dexEntries.map((entry) => {
                                    const iconUrl =
                                        getMonsterIcon(
                                            entry.species_id,
                                        );
                                    const label =
                                        entry.displayName;

                                    const isSelected =
                                        entry.id === selectedId;

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
                                                border: isSelected
                                                    ? "1px solid rgba(252,211,77,0.95)"
                                                    : "1px solid rgba(55,65,81,0.9)",
                                                padding: "0.35rem",
                                                background:
                                                    "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,64,175,0.85))",
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
                                                        width: 44,
                                                        height: 44,
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
                                                        opacity: 0.9,
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

                    {!props.collectionLoading &&
                        !props.collectionError &&
                        dexEntries.length === 0 && (
                            <div
                                style={{
                                    fontSize: "0.8rem",
                                    opacity: 0.7,
                                }}
                            >
                                아직 도감에 등록된 몬스터가
                                없습니다.
                            </div>
                        )}
                </div>
            </div>
        </div>
    );
}
