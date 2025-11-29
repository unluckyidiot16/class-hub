// src/games/quizmon/PartyAndDexPanel.tsx

import { useEffect, useMemo, useState } from "react";
import type {
    QuizmonProfileRow,
    QuizmonOwnedMonsterRow,
} from "./types";
import { getMonsterIcon } from "./assets";
import {
    levelUpMonsterSingleService,
    levelUpMonsterMaxService,
    loadPowerItemCounts,
} from "./quizmonService";
import { MOVE_DB, getMovesForSpeciesAndLevel } from "./moveData";

/** quizmon_owned_monsters 1마리를 UI용으로 가공 */
type EnhancedOwnedMonster = QuizmonOwnedMonsterRow & {
    displayName: string;
    statusText: string;
    currentHpText: string;
};

function enhanceOwned(mon: QuizmonOwnedMonsterRow): EnhancedOwnedMonster {
    const anyMon = mon as any;

    const rawSpeciesId = (anyMon.species_id as string | null) ?? "";
    const displayId = rawSpeciesId.startsWith("poke-")
        ? rawSpeciesId
        : `0000${rawSpeciesId}`.slice(-4); // poke-0001 / 0001 둘 다 커버

    const displayName = `포켓몬 #${displayId}`;

    const hp = anyMon.current_hp as number | null;
    const isFainted = Boolean(anyMon.is_fainted);

    let statusText: string;
    let currentHpText: string;

    if (isFainted) {
        statusText = "기절";
        currentHpText = "0";
    } else if (hp == null) {
        statusText = "HP 풀피";
        currentHpText = "풀피";
    } else {
        statusText = `HP ${hp}`;
        currentHpText = String(hp);
    }

    return {
        ...mon,
        displayName,
        statusText,
        currentHpText,
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
    onPullFreeGacha?: () => void | Promise<void>; // 지금은 사용 안 하지만 타입 유지
    onHealAll?: () => void;
    onSaveParty?: (partyIds: (string | null)[]) => void | Promise<void>;
};

export function PartyAndDexPanel(props: PartyAndDexPanelProps) {
    const { profile, onHealAll } = props;

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

    // 파티 슬롯 (3칸)
    const [partyIds, setPartyIds] = useState<(string | null)[]>(() =>
        buildInitialPartyIds(props.monsters),
    );

    // partyIds 변경 시 DB에 저장 (자동 저장)
    useEffect(() => {
        if (!props.onSaveParty) return;
        void props.onSaveParty(partyIds);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [partyIds]);

    function getMonsterInSlot(
        slotIndex: number,
    ): EnhancedOwnedMonster | null {
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

    /** 도감에서 몬스터 선택 */
    function handleDexClick(id: string) {
        setSelectedId(id);
    }

    const selectedSlotIndex =
        selected ? partyIds.findIndex((id) => id === selected.id) : -1;

    const ownedCount = enhancedMonsters.length;

    // ---------------- 인벤토리 / 레벨업 관련 상태 ----------------
    const [expDustCount, setExpDustCount] = useState(0);
    const [rareCandyCount, setRareCandyCount] = useState(0);
    const [inventoryLoading, setInventoryLoading] = useState(false);
    const [inventoryError, setInventoryError] = useState<string | null>(
        null,
    );

    const totalPowerItems = expDustCount + rareCandyCount;

    // 레벨업 전 기술 목록 (species + level 기준 코드 계산)
    const [baseLearnedMoves, setBaseLearnedMoves] = useState<string[]>(
        [],
    );
    const [newlyLearnedMoves, setNewlyLearnedMoves] = useState<string[]>(
        [],
    );
    const [lastLevelUpResult, setLastLevelUpResult] = useState<any | null>(
        null,
    );

    // 인벤토리 로딩
    useEffect(() => {
        if (!profile) return;

        let cancelled = false;
        (async () => {
            try {
                setInventoryLoading(true);
                setInventoryError(null);
                const res = await loadPowerItemCounts(profile.id);
                if (cancelled) return;
                setExpDustCount(res.expDustCount ?? 0);
                setRareCandyCount(res.rareCandyCount ?? 0);
            } catch (e: any) {
                if (cancelled) return;
                console.error(
                    "[PartyAndDexPanel] loadPowerItemCounts error",
                    e,
                );
                setInventoryError(
                    e?.message ??
                    "인벤토리 정보를 불러오는 중 오류가 발생했습니다.",
                );
            } finally {
                if (!cancelled) {
                    setInventoryLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [profile]);

    // 레벨업 모달
    const [levelModalOpen, setLevelModalOpen] = useState(false);

    const handleOpenLevelModal = () => {
        if (!selected) return;
        if (totalPowerItems <= 0) return;

        // 현재 종+레벨 기준으로 배운 기술 목록 계산
        const baseMoveObjs = getMovesForSpeciesAndLevel(
            selected.species_id,
            selected.level,
        );
        const base = baseMoveObjs.map((m) => m.id);

        setBaseLearnedMoves(base);
        setNewlyLearnedMoves([]);
        setLastLevelUpResult(null);
        setLevelModalOpen(true);
    };

    // 모달 내 레벨업 진행 상태
    const [levelBusy, setLevelBusy] = useState(false);
    const [levelUseCount, setLevelUseCount] = useState(1);

    // 모달이 열릴 때마다 슬라이더 기본값 초기화
    useEffect(() => {
        if (!levelModalOpen) return;
        setLevelUseCount(totalPowerItems > 0 ? 1 : 0);
    }, [levelModalOpen, totalPowerItems]);

    // 슬라이더 기반 레벨업 처리
    const handleConfirmLevelUp = async () => {
        if (!profile || !selected || levelBusy) return;
        if (totalPowerItems <= 0 || levelUseCount <= 0) return;

        const times = Math.min(levelUseCount, totalPowerItems);

        try {
            setLevelBusy(true);
            let lastResult: any = null;

            // 슬라이더를 최대까지 밀면 Max 서비스 사용 (최적화)
            if (times === totalPowerItems) {
                lastResult = await levelUpMonsterMaxService({
                    profileId: profile.id,
                    monsterId: selected.id,
                });
            } else {
                for (let i = 0; i < times; i += 1) {
                    const r = await levelUpMonsterSingleService({
                        profileId: profile.id,
                        monsterId: selected.id,
                    });
                    lastResult = r;

                    const remain =
                        (r?.remainingExpDust ?? 0) +
                        (r?.remainingRareCandy ?? 0);
                    if (remain <= 0) {
                        break;
                    }
                }
            }

            if (lastResult) {
                if (typeof lastResult.remainingExpDust === "number") {
                    setExpDustCount(lastResult.remainingExpDust);
                }
                if (typeof lastResult.remainingRareCandy === "number") {
                    setRareCandyCount(lastResult.remainingRareCandy);
                }

                // 레벨업 이후: 종+레벨 기준 배운 기술 목록 재계산
                const afterMoveObjs = getMovesForSpeciesAndLevel(
                    lastResult.monster.species_id,
                    lastResult.monster.level,
                );
                const afterMoves = afterMoveObjs.map((m) => m.id);

                const baseMoves = Array.isArray(baseLearnedMoves)
                    ? baseLearnedMoves
                    : [];

                const newly = afterMoves.filter(
                    (id) => !baseMoves.includes(id),
                );

                setLastLevelUpResult(lastResult);
                setNewlyLearnedMoves(newly);
            }

            // 모달은 자동으로 닫지 않고 안에서 결과를 보여줌
        } catch (e: any) {
            console.error("[PartyAndDexPanel] handleConfirmLevelUp error", e);
            setInventoryError(
                e?.message ?? "레벨 업 중 오류가 발생했습니다.",
            );
        } finally {
            setLevelBusy(false);
        }
    };

    // 도감 정렬 (레벨 높은 순)
    const dexList = useMemo(
        () =>
            [...enhancedMonsters].sort(
                (a, b) => (b.level ?? 1) - (a.level ?? 1),
            ),
        [enhancedMonsters],
    );

    return (
        <>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    height: "100%",
                }}
            >
                {/* 상단: 파티 / 선택 파트너 / 인벤토리 */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "row",
                        gap: "0.75rem",
                        minHeight: 180,
                    }}
                >
                    {/* 왼쪽: 파티 슬롯 3칸 */}
                    <div
                        style={{
                            width: 220,
                            borderRadius: 12,
                            border: "1px solid rgba(148,163,184,0.6)",
                            padding: "0.75rem",
                            background:
                                "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,64,175,0.85))",
                            color: "#e5e7eb",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                fontSize: "0.85rem",
                            }}
                        >
                            <div>내 파티 (최대 3마리)</div>
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    color: "#cbd5f5",
                                }}
                            >
                                편성{" "}
                                {
                                    partyIds.filter((id) => id !== null)
                                        .length
                                }
                                /3
                            </div>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.35rem",
                            }}
                        >
                            {[0, 1, 2].map((index) => {
                                const slotMon = getMonsterInSlot(index);
                                const isSelected =
                                    selected &&
                                    slotMon &&
                                    selected.id === slotMon.id;

                                let iconUrl: string | null = null;
                                if (slotMon) {
                                    iconUrl = getMonsterIcon(
                                        slotMon.species_id,
                                    );
                                }

                                return (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() =>
                                            handlePartySlotClick(index)
                                        }
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.5rem",
                                            padding:
                                                "0.35rem 0.55rem",
                                            borderRadius: 999,
                                            border: isSelected
                                                ? "1px solid rgba(248,250,252,0.9)"
                                                : "1px solid rgba(148,163,184,0.8)",
                                            backgroundColor: slotMon
                                                ? "rgba(15,23,42,0.9)"
                                                : "rgba(15,23,42,0.6)",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 999,
                                                backgroundColor:
                                                    "rgba(15,23,42,0.9)",
                                                border: "1px solid rgba(148,163,184,0.9)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent:
                                                    "center",
                                                overflow: "hidden",
                                            }}
                                        >
                                            {slotMon && iconUrl && (
                                                <img
                                                    src={iconUrl}
                                                    alt={
                                                        slotMon.displayName
                                                    }
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit:
                                                            "contain",
                                                        imageRendering:
                                                            "pixelated",
                                                    }}
                                                />
                                            )}
                                        </div>
                                        {slotMon ? (
                                            <>
                                                <div
                                                    style={{
                                                        flex: 1,
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            fontSize:
                                                                "0.78rem",
                                                            fontWeight: 600,
                                                            whiteSpace:
                                                                "nowrap",
                                                            textOverflow:
                                                                "ellipsis",
                                                            overflow:
                                                                "hidden",
                                                        }}
                                                    >
                                                        {
                                                            slotMon.displayName
                                                        }
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize:
                                                                "0.7rem",
                                                            color: slotMon.is_fainted
                                                                ? "#fecaca"
                                                                : "#bbf7d0",
                                                        }}
                                                    >
                                                        {slotMon.is_fainted
                                                            ? "기절"
                                                            : `HP ${slotMon.currentHpText}`}
                                                    </div>
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize:
                                                            "0.7rem",
                                                        color:
                                                            "#9ca3af",
                                                    }}
                                                >
                                                    #{index + 1}
                                                </div>
                                            </>
                                        ) : (
                                            <div
                                                style={{
                                                    fontSize:
                                                        "0.7rem",
                                                    color: "#64748b",
                                                    paddingTop: 4,
                                                    paddingBottom: 4,
                                                }}
                                            >
                                                비어 있음
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div
                            style={{
                                marginTop: "0.25rem",
                                fontSize: "0.75rem",
                                color: "#9ca3af",
                            }}
                        >
                            파티 슬롯을 클릭한 뒤 아래 도감에서
                            교체할 몬스터를 선택하면 자리가
                            바뀝니다. 파티 변경 사항은 자동으로
                            저장됩니다.
                        </div>
                    </div>

                    {/* 가운데: 선택 파트너 요약 */}
                    <div
                        style={{
                            flex: 1,
                            borderRadius: 12,
                            border: "1px solid rgba(148,163,184,0.6)",
                            padding: "0.75rem",
                            background:
                                "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,64,175,0.85))",
                            color: "#e5e7eb",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                fontSize: "0.85rem",
                            }}
                        >
                            <div>선택한 파트너</div>
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    color: "#cbd5f5",
                                }}
                            >
                                보유 {ownedCount}마리
                            </div>
                        </div>

                        {selected ? (
                            <div>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.75rem",
                                        marginTop: 4,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 56,
                                            height: 56,
                                            borderRadius: 12,
                                            background:
                                                "rgba(15,23,42,0.9)",
                                            border: "1px solid rgba(148,163,184,0.9)",
                                            overflow: "hidden",
                                            boxShadow:
                                                "0 0 0 1px rgba(59,130,246,0.5)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        {(() => {
                                            const iconUrl =
                                                getMonsterIcon(
                                                    selected.species_id,
                                                );
                                            if (!iconUrl) return null;
                                            return (
                                                <img
                                                    src={iconUrl}
                                                    alt={
                                                        selected.displayName
                                                    }
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit:
                                                            "contain",
                                                        imageRendering:
                                                            "pixelated",
                                                    }}
                                                />
                                            );
                                        })()}
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 2,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: "0.9rem",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {selected.displayName}
                                        </div>

                                        {/* 레벨 + 상태 + 레벨업 버튼 */}
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                flexWrap: "wrap",
                                                gap: 6,
                                                marginTop: 2,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: "0.8rem",
                                                    opacity: 0.9,
                                                }}
                                            >
                                                Lv.{selected.level} ·{" "}
                                                {selected.statusText}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={
                                                    handleOpenLevelModal
                                                }
                                                disabled={
                                                    totalPowerItems ===
                                                    0 ||
                                                    inventoryLoading
                                                }
                                                style={{
                                                    padding:
                                                        "0.3rem 0.6rem",
                                                    borderRadius: 999,
                                                    border: "none",
                                                    fontSize: "0.75rem",
                                                    fontWeight: 600,
                                                    cursor:
                                                        totalPowerItems ===
                                                        0 ||
                                                        inventoryLoading
                                                            ? "not-allowed"
                                                            : "pointer",
                                                    background:
                                                        totalPowerItems ===
                                                        0 ||
                                                        inventoryLoading
                                                            ? "rgba(75,85,99,0.9)"
                                                            : "linear-gradient(90deg, #22c55e, #16a34a)",
                                                    color: "#f9fafb",
                                                    opacity:
                                                        totalPowerItems ===
                                                        0 ||
                                                        inventoryLoading
                                                            ? 0.6
                                                            : 1,
                                                }}
                                            >
                                                레벨 업
                                            </button>
                                        </div>

                                        {/* HP / 파티슬롯 정보 */}
                                        <div
                                            style={{
                                                fontSize: "0.75rem",
                                                marginTop: 4,
                                                color: "#cbd5f5",
                                            }}
                                        >
                                            HP {selected.currentHpText}
                                            {" · "}
                                            파티 슬롯{" "}
                                            {selectedSlotIndex >= 0
                                                ? selectedSlotIndex +
                                                1
                                                : "편성 안 됨"}
                                        </div>
                                    </div>
                                </div>

                                {/* 회복 버튼 */}
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "flex-start",
                                        gap: "0.5rem",
                                        marginTop: 8,
                                    }}
                                >
                                    {onHealAll && (
                                        <button
                                            type="button"
                                            onClick={onHealAll}
                                            style={{
                                                padding:
                                                    "0.35rem 0.7rem",
                                                borderRadius: 999,
                                                border: "1px solid rgba(148,163,184,0.9)",
                                                backgroundColor:
                                                    "rgba(15,23,42,0.9)",
                                                color: "#e5e7eb",
                                                fontSize: "0.75rem",
                                                cursor: "pointer",
                                            }}
                                        >
                                            전체 회복
                                        </button>
                                    )}
                                </div>

                                {/* 선택 파트너 상세 설명 (추후 확장 자리) */}
                                <div
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "#cbd5f5",
                                        marginTop: 6,
                                    }}
                                >
                                    앞으로는 여기에서 개체 값, 성장,
                                    레이드 기록, 배운 기술과 능력치를
                                    자세히 보여 줄 예정입니다.
                                </div>
                            </div>
                        ) : (
                            <div
                                style={{
                                    marginTop: 12,
                                    fontSize: "0.8rem",
                                    color: "#9ca3af",
                                }}
                            >
                                아래 도감에서 몬스터를 선택하면 이
                                영역에 상세 정보가 표시됩니다.
                            </div>
                        )}
                    </div>

                    {/* 오른쪽: 인벤토리 패널 (강화 아이템) */}
                    <div
                        style={{
                            width: 220,
                            borderRadius: 12,
                            border: "1px solid rgba(148,163,184,0.5)",
                            padding: "0.75rem",
                            background:
                                "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,64,175,0.85))",
                            color: "#e5e7eb",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.45rem",
                            fontSize: "0.8rem",
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
                                인벤토리 (강화 아이템)
                            </div>
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    color: "#cbd5f5",
                                }}
                            >
                                전체 {totalPowerItems}개
                            </div>
                        </div>

                        <div
                            style={{
                                borderRadius: 10,
                                background: "rgba(15,23,42,0.9)",
                                padding: "0.55rem 0.7rem",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.3rem",
                            }}
                        >
                            <div>
                                <span
                                    style={{
                                        color: "#e5e7eb",
                                        fontWeight: 600,
                                    }}
                                >
                                    Exp Dust
                                </span>{" "}
                                × {expDustCount}
                            </div>
                            <div>
                                <span
                                    style={{
                                        color: "#e5e7eb",
                                        fontWeight: 600,
                                    }}
                                >
                                    레어 캔디
                                </span>{" "}
                                × {rareCandyCount}
                            </div>
                            {inventoryLoading && (
                                <div
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "#9ca3af",
                                    }}
                                >
                                    인벤토리를 불러오는 중.
                                </div>
                            )}
                            {inventoryError && (
                                <div
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "#fecaca",
                                    }}
                                >
                                    {inventoryError}
                                </div>
                            )}
                        </div>

                        <div
                            style={{
                                fontSize: "0.75rem",
                                color: "#cbd5f5",
                            }}
                        >
                            Exp Dust와 레어 캔디를 사용해 선택한
                            포켓몬의 레벨을 올릴 수 있습니다. 아래
                            버튼을 눌러 레벨업 슬라이더를 열어
                            보세요.
                        </div>

                        <button
                            type="button"
                            onClick={handleOpenLevelModal}
                            disabled={
                                !selected ||
                                totalPowerItems === 0 ||
                                inventoryLoading
                            }
                            style={{
                                marginTop: "0.15rem",
                                padding: "0.4rem 0.7rem",
                                borderRadius: 999,
                                border: "none",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                cursor:
                                    !selected ||
                                    totalPowerItems === 0 ||
                                    inventoryLoading
                                        ? "not-allowed"
                                        : "pointer",
                                background:
                                    !selected ||
                                    totalPowerItems === 0 ||
                                    inventoryLoading
                                        ? "rgba(75,85,99,0.9)"
                                        : "linear-gradient(90deg, #22c55e, #16a34a)",
                                color: "#f9fafb",
                                opacity:
                                    !selected ||
                                    totalPowerItems === 0 ||
                                    inventoryLoading
                                        ? 0.6
                                        : 1,
                            }}
                        >
                            선택 파트너 레벨 업
                        </button>
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
                            marginBottom: 2,
                        }}
                    >
                        <div>도감 / 보유 몬스터</div>
                        <div
                            style={{
                                fontSize: "0.75rem",
                                color: "#cbd5f5",
                            }}
                        >
                            총 {dexList.length}마리
                        </div>
                    </div>

                    <div
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            paddingRight: 4,
                        }}
                    >
                        {dexList.length === 0 ? (
                            <div
                                style={{
                                    fontSize: "0.8rem",
                                    color: "#9ca3af",
                                }}
                            >
                                아직 보유한 몬스터가 없습니다. 가챠나
                                레이드 보상으로 몬스터를 모아보세요.
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                        "repeat(auto-fill, minmax(150px, 1fr))",
                                    gap: "0.5rem",
                                }}
                            >
                                {dexList.map((mon) => {
                                    const isSelected =
                                        selected &&
                                        selected.id === mon.id;

                                    const iconUrl = getMonsterIcon(
                                        mon.species_id,
                                    );

                                    return (
                                        <button
                                            key={mon.id}
                                            type="button"
                                            onClick={() =>
                                                handleDexClick(mon.id)
                                            }
                                            style={{
                                                textAlign: "left",
                                                borderRadius: 10,
                                                border: isSelected
                                                    ? "1px solid rgba(248,250,252,0.95)"
                                                    : "1px solid rgba(148,163,184,0.7)",
                                                backgroundColor:
                                                    "rgba(15,23,42,0.9)",
                                                padding: "0.4rem 0.45rem",
                                                display: "flex",
                                                gap: "0.4rem",
                                                cursor: "pointer",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 8,
                                                    backgroundColor:
                                                        "rgba(15,23,42,0.95)",
                                                    border: "1px solid rgba(148,163,184,0.9)",
                                                    display: "flex",
                                                    alignItems:
                                                        "center",
                                                    justifyContent:
                                                        "center",
                                                    overflow: "hidden",
                                                }}
                                            >
                                                {iconUrl && (
                                                    <img
                                                        src={iconUrl}
                                                        alt={
                                                            mon.displayName
                                                        }
                                                        style={{
                                                            width:
                                                                "100%",
                                                            height:
                                                                "100%",
                                                            objectFit:
                                                                "contain",
                                                            imageRendering:
                                                                "pixelated",
                                                        }}
                                                    />
                                                )}
                                            </div>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    flexDirection:
                                                        "column",
                                                    gap: 2,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize:
                                                            "0.8rem",
                                                        fontWeight: 600,
                                                        whiteSpace:
                                                            "nowrap",
                                                        textOverflow:
                                                            "ellipsis",
                                                        overflow:
                                                            "hidden",
                                                    }}
                                                >
                                                    {mon.displayName}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize:
                                                            "0.75rem",
                                                        color: "#cbd5f5",
                                                    }}
                                                >
                                                    Lv.{mon.level} ·{" "}
                                                    {mon.statusText}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 레벨업 모달 */}
            {levelModalOpen && selected && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(15,23,42,0.85)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                    }}
                >
                    <div
                        style={{
                            width: "min(480px, 100% - 2rem)",
                            maxWidth: 480,
                            borderRadius: 16,
                            border: "1px solid rgba(148,163,184,0.9)",
                            background:
                                "linear-gradient(145deg, #020617, #0f172a, #1d4ed8)",
                            color: "#e5e7eb",
                            padding: "1rem 1.1rem 0.95rem",
                            boxShadow:
                                "0 20px 60px rgba(15,23,42,0.9)",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 8,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "0.9rem",
                                    fontWeight: 600,
                                }}
                            >
                                {selected.displayName} 레벨 업
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    !levelBusy &&
                                    setLevelModalOpen(false)
                                }
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    color: "#9ca3af",
                                    cursor: levelBusy
                                        ? "default"
                                        : "pointer",
                                    fontSize: "1rem",
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div
                            style={{
                                fontSize: "0.8rem",
                                color: "#cbd5f5",
                                marginBottom: 10,
                            }}
                        >
                            Exp Dust / 레어 캔디를 사용해 선택한
                            포켓몬의 레벨을 올립니다. 슬라이더로
                            이번에 사용할 아이템 개수를 조절할 수
                            있습니다.
                        </div>

                        <div
                            style={{
                                borderRadius: 10,
                                background: "rgba(15,23,42,0.95)",
                                padding: "0.65rem 0.75rem",
                                marginBottom: 10,
                                display: "grid",
                                gridTemplateColumns:
                                    "repeat(2, minmax(0, 1fr))",
                                gap: "0.75rem",
                                fontSize: "0.8rem",
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "#9ca3af",
                                        marginBottom: 4,
                                    }}
                                >
                                    현재 레벨
                                </div>
                                <div
                                    style={{
                                        fontSize: "1.1rem",
                                        fontWeight: 700,
                                    }}
                                >
                                    Lv.{selected.level}
                                </div>
                                <div
                                    style={{
                                        marginTop: 4,
                                        fontSize: "0.75rem",
                                        color: "#cbd5f5",
                                    }}
                                >
                                    경험치 {selected.exp}
                                </div>
                            </div>
                            <div
                                style={{
                                    borderLeft:
                                        "1px dashed rgba(55,65,81,0.9)",
                                    paddingLeft: "0.75rem",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "#9ca3af",
                                        marginBottom: 4,
                                    }}
                                >
                                    사용 가능 아이템
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 4,
                                    }}
                                >
                                    <div>
                                        <span
                                            style={{
                                                color: "#e5e7eb",
                                                fontWeight: 600,
                                            }}
                                        >
                                            Exp Dust
                                        </span>{" "}
                                        × {expDustCount}
                                    </div>
                                    <div>
                                        <span
                                            style={{
                                                color: "#e5e7eb",
                                                fontWeight: 600,
                                            }}
                                        >
                                            레어 캔디
                                        </span>{" "}
                                        × {rareCandyCount}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 슬라이더 영역 */}
                        <div
                            style={{
                                marginBottom: 10,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    fontSize: "0.75rem",
                                    marginBottom: 4,
                                }}
                            >
                                <span>이번에 사용할 아이템 개수</span>
                                <span>
                                    {levelUseCount} / {totalPowerItems}
                                </span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={totalPowerItems}
                                value={levelUseCount}
                                onChange={(e) =>
                                    setLevelUseCount(
                                        Number(e.target.value),
                                    )
                                }
                                disabled={
                                    totalPowerItems === 0 || levelBusy
                                }
                                style={{
                                    width: "100%",
                                }}
                            />
                        </div>

                        {/* 결과 영역 (새로 배운 기술) */}
                        {lastLevelUpResult && (
                            <div
                                style={{
                                    marginTop: 8,
                                    marginBottom: 10,
                                    borderRadius: 10,
                                    background:
                                        "rgba(15,23,42,0.95)",
                                    padding: "0.6rem 0.75rem",
                                    fontSize: "0.8rem",
                                }}
                            >
                                <div
                                    style={{
                                        fontWeight: 600,
                                        marginBottom: 4,
                                    }}
                                >
                                    레벨업 결과
                                </div>
                                <div
                                    style={{
                                        fontSize: "0.78rem",
                                        color: "#cbd5f5",
                                        marginBottom: 4,
                                    }}
                                >
                                    최종 레벨: Lv.
                                    {lastLevelUpResult.monster?.level}
                                </div>
                                {newlyLearnedMoves.length > 0 ? (
                                    <div>
                                        <div
                                            style={{
                                                fontSize: "0.78rem",
                                                color: "#cbd5f5",
                                                marginBottom: 2,
                                            }}
                                        >
                                            새로 배운 기술:
                                        </div>
                                        <ul
                                            style={{
                                                paddingLeft: "1.1rem",
                                                margin: 0,
                                            }}
                                        >
                                            {newlyLearnedMoves.map(
                                                (id) => {
                                                    const move =
                                                        MOVE_DB[id];
                                                    return (
                                                        <li
                                                            key={id}
                                                            style={{
                                                                fontSize:
                                                                    "0.78rem",
                                                            }}
                                                        >
                                                            {move
                                                                ? `${move.name ?? id} (${id})`
                                                                : id}
                                                        </li>
                                                    );
                                                },
                                            )}
                                        </ul>
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            fontSize: "0.78rem",
                                            color: "#9ca3af",
                                        }}
                                    >
                                        새로 배운 기술은 없습니다.
                                    </div>
                                )}
                            </div>
                        )}

                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: "0.5rem",
                                marginTop: 4,
                            }}
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    !levelBusy &&
                                    setLevelModalOpen(false)
                                }
                                disabled={levelBusy}
                                style={{
                                    padding:
                                        "0.4rem 0.75rem",
                                    borderRadius: 999,
                                    border: "1px solid rgba(148,163,184,0.9)",
                                    backgroundColor:
                                        "rgba(15,23,42,0.95)",
                                    color: "#e5e7eb",
                                    fontSize: "0.8rem",
                                    cursor: levelBusy
                                        ? "not-allowed"
                                        : "pointer",
                                }}
                            >
                                닫기
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmLevelUp}
                                disabled={
                                    levelBusy ||
                                    totalPowerItems === 0 ||
                                    levelUseCount === 0
                                }
                                style={{
                                    padding:
                                        "0.4rem 0.85rem",
                                    borderRadius: 999,
                                    border: "none",
                                    background:
                                        "linear-gradient(90deg, #22c55e, #16a34a)",
                                    color: "#f9fafb",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                    cursor:
                                        levelBusy ||
                                        totalPowerItems === 0 ||
                                        levelUseCount === 0
                                            ? "not-allowed"
                                            : "pointer",
                                    opacity:
                                        levelBusy ||
                                        totalPowerItems === 0 ||
                                        levelUseCount === 0
                                            ? 0.6
                                            : 1,
                                }}
                            >
                                {levelBusy ? "레벨 업 중..." : "레벨 업 진행"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
