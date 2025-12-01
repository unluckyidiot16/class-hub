// src/games/quizmon/PartyAndDexPanel.tsx

import { useEffect, useMemo, useState } from "react";
import type {
    QuizmonProfileRow,
    QuizmonOwnedMonsterRow,
    QuizmonSpeciesRow,
    AbilityId,
} from "./types";
import { getMonsterIcon } from "./assets";
import {
    levelUpMonsterSingleService,
    levelUpMonsterMaxService,
    loadPowerItemCounts,
} from "./quizmonService";
import { MOVE_DB, getMovesForSpeciesAndLevel } from "./moveData";
import { supabase } from "../../lib/supabaseClient";

// v1 특성 설명 DB (UI 표시용)
const ABILITY_DB: Record<
    AbilityId,
        { name: string; short: string }
    > = {
            overgrow: {
            name: "풀의 힘",
                short: "HP 1/3 이하일 때 풀 기술 위력 1.5배",
            },
    water_guard: {
            name: "물의 보호",
                short: "받는 물 기술 피해 0.8배",
            },
};

    // 종 데이터 → v1 기본 특성
        function getDefaultAbilityForSpeciesRow(
    species: QuizmonSpeciesRow,
    ): AbilityId | null {
        if (species.element === "grass") return "overgrow";
        if (species.element === "water") return "water_guard";
        return null;
    }

    // 선택 파트너 카드에서 보여 줄 간단 능력치 타입
        type DisplayStats = {
        maxHp: number;
    atk: number;
    def: number;
    spd: number;
};

    // base_* + level 기반 간단 전투 스탯 계산 (UI용)
        function calcDisplayStats(
    owned: QuizmonOwnedMonsterRow,
        species?: QuizmonSpeciesRow,
    ): DisplayStats | null {
        if (!species) return null;
    
            const level = owned.level ?? 1;
        const baseHp = species.base_hp ?? 1;
        const baseAtk = species.base_atk ?? 1;
        const baseDef = species.base_def ?? 1;
        const baseSpd = species.base_spd ?? 1;
    
            // 포켓몬식 공식을 간단히 줄인 버전 (UI 표시 전용)
                const maxHp =
                Math.floor(((2 * baseHp) * level) / 50) + level + 10;
        const atk =
                Math.floor(((2 * baseAtk) * level) / 50) + 5;
        const def =
                Math.floor(((2 * baseDef) * level) / 50) + 5;
        const spd =
                Math.floor(((2 * baseSpd) * level) / 50) + 5;
    
            return { maxHp, atk, def, spd };
    }

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

    const hp = (anyMon.current_hp as number | null) ?? null;
    const isFainted = Boolean(anyMon.is_fainted);

    let statusText: string;
    let currentHpText: string;

    if (isFainted) {
        statusText = "기절";
        currentHpText = "0";
    } else if (hp == null) {
        statusText = "정상";
        currentHpText = "풀피";
    } else {
        statusText = `HP ${hp}`;
        currentHpText = `${hp}`;
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

    // 🔹 레벨업 등으로 즉시 반영하기 위한 로컬 override
    const [monsterOverrides, setMonsterOverrides] = useState<
        Record<string, Partial<QuizmonOwnedMonsterRow>>
    >({});
    
    const enhancedMonsters = useMemo(
        () =>
            (props.monsters ?? []).map((m) => {
                const override = monsterOverrides[m.id];
                const merged = override
                    ? ({ ...m, ...override } as QuizmonOwnedMonsterRow)
                    : m;
                return enhanceOwned(merged);
            }),
        [props.monsters, monsterOverrides],
    );
    
    const selected =
        enhancedMonsters.find((m) => m.id === selectedId) ?? null;
    
    // 🔹 몬스터 종 데이터 (도감/능력치/특성 표시용)
        const [speciesMap, setSpeciesMap] = useState<
            Record<string, QuizmonSpeciesRow>
        >({});
    
            useEffect(() => {
                    const list = props.monsters ?? [];
                    if (!list.length) {
                            setSpeciesMap({});
                            return;
                        }
            
                        const ids = Array.from(
                            new Set(list.map((m) => m.species_id)),
                        );
                    if (!ids.length) {
                            setSpeciesMap({});
                            return;
                        }
            
                        let cancelled = false;
            
                        (async () => {
                                try {
                                        const { data, error } = await supabase
                                            .from("quizmon_species")
                                            .select("*")
                                            .in("id", ids);
                        
                                            if (error) {
                                                console.error(
                                                        "[PartyAndDexPanel] load species error",
                                                        error,
                                                    );
                                                return;
                                            }
                                        if (cancelled || !data) return;
                        
                                            const next: Record<string, QuizmonSpeciesRow> = {};
                                        for (const row of data as QuizmonSpeciesRow[]) {
                                                next[row.id] = row;
                                            }
                                        setSpeciesMap(next);
                                    } catch (e) {
                                        console.error(
                                                "[PartyAndDexPanel] load species error",
                                                e,
                                            );
                                    }
                            })();
            
                        return () => {
                            cancelled = true;
                        };
                }, [props.monsters]);
    
    
    // 선택된 파트너
    const [selectedId, setSelectedId] = useState<string | null>(null);


    const selectedSpecies: QuizmonSpeciesRow | undefined = useMemo(
                () =>
                selected
                    ? speciesMap[(selected as any).species_id]
                        : undefined,
                [selected, speciesMap],
            );
    
            const selectedStats: DisplayStats | null = useMemo(
                () =>
                selected
                    ? calcDisplayStats(
                                  selected as QuizmonOwnedMonsterRow,
                                  selectedSpecies,
                              )
                        : null,
                [selected, selectedSpecies],
            );
    
            const selectedAbility = useMemo(() => {
                if (!selectedSpecies) return null;
                const abilityId = getDefaultAbilityForSpeciesRow(
                        selectedSpecies,
                    );
                if (!abilityId) return null;
                const info = ABILITY_DB[abilityId];
                if (!info) return null;
                return {
                        id: abilityId,
                        name: info.name,
                        short: info.short,
                    };
                }, [selectedSpecies]);
    

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

    // 인벤토리 (Exp Dust / 레어캔디) – 레벨업용으로만 사용
    const [expDustCount, setExpDustCount] = useState(0);
    const [rareCandyCount, setRareCandyCount] = useState(0);
    const [inventoryLoading, setInventoryLoading] = useState(false);
    const [inventoryError, setInventoryError] = useState<string | null>(
        null,
    );

    useEffect(() => {
        if (!profile) {
            setExpDustCount(0);
            setRareCandyCount(0);
            return;
        }

        let cancelled = false;
        setInventoryLoading(true);
        setInventoryError(null);

        (async () => {
            try {
                const result = await loadPowerItemCounts(profile.id);
                if (cancelled) return;
                setExpDustCount(result.expDustCount ?? 0);
                setRareCandyCount(result.rareCandyCount ?? 0);
            } catch (e: any) {
                console.error(
                    "[PartyAndDexPanel] loadPowerItemCounts error",
                    e,
                );
                if (!cancelled) {
                    setInventoryError(
                        e?.message ??
                        "인벤토리를 불러오는 중 오류가 발생했습니다.",
                    );
                }
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

    const totalPowerItems = expDustCount + rareCandyCount;

    // 레벨업 모달 상태
    const [levelModalOpen, setLevelModalOpen] = useState(false);
    const [levelBusy, setLevelBusy] = useState(false);
    const [levelUseCount, setLevelUseCount] = useState(1);
    const [baseLearnedMoves, setBaseLearnedMoves] = useState<string[]>(
        [],
    );
    const [newlyLearnedMoves, setNewlyLearnedMoves] = useState<
        string[]
    >([]);
    const [, setLastLevelUpResult] = useState<any>(null);
    const handleOpenLevelModal = () => {
        if (!selected) return;

        // 레벨업 전 기준으로 "배운 기술" 목록 스냅샷
        const anyMon = selected as any;
        let baseMoves: string[] = [];

        if (Array.isArray(anyMon.learned_moves)) {
            baseMoves = anyMon.learned_moves as string[];
        } else {
            const moveObjs = getMovesForSpeciesAndLevel(
                anyMon.species_id,
                anyMon.level,
            );
            baseMoves = moveObjs.map((m: any) => m.id);
        }

        setBaseLearnedMoves(baseMoves);
        setNewlyLearnedMoves([]);
        setLastLevelUpResult(null);
        setInventoryError(null);
        setLevelModalOpen(true);
    };

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
                if (
                    typeof lastResult.remainingRareCandy === "number"
                ) {
                    setRareCandyCount(lastResult.remainingRareCandy);
                }

                // 🔹 레벨업 후 최신 개체 정보로 로컬 override 갱신
                if (lastResult.monster) {
                    const updated = lastResult.monster as QuizmonOwnedMonsterRow;
                    setMonsterOverrides((prev) => ({
                        ...prev,
                        [updated.id]: {
                            // UI에서 바로 쓰는 핵심 필드들
                            level: updated.level,
                            exp: updated.exp,
                            current_hp: updated.current_hp,
                            is_fainted: updated.is_fainted,
                            learned_moves: updated.learned_moves,
                            species_id: updated.species_id,
                        },
                    }));
                }

                // 레벨업 이후 DB row에 들어있는 learned_moves 기준으로 "새로 배운 기술" 계산
                const afterMoves: string[] = Array.isArray(
                    lastResult.monster?.learned_moves,
                )
                    ? lastResult.monster.learned_moves
                    : [];
                const baseMoves = Array.isArray(baseLearnedMoves)
                    ? baseLearnedMoves
                    : [];

                const newly = afterMoves.filter(
                    (id) => !baseMoves.includes(id),
                );

                setLastLevelUpResult(lastResult);
                setNewlyLearnedMoves(newly);
            }

        } catch (e: any) {
            console.error(
                "[PartyAndDexPanel] handleConfirmLevelUp error",
                e,
            );
            setInventoryError(
                e?.message ?? "레벨 업 중 오류가 발생했습니다.",
            );
        } finally {
            setLevelBusy(false);
        }
    };

    // -------------------------------
    // 기술 장착 패널 상태
    // -------------------------------

    const [equipSlots, setEquipSlots] = useState<(string | null)[]>([
        null,
        null,
        null,
        null,
    ]);
    const [activeEquipIndex, setActiveEquipIndex] = useState<
        number | null
    >(null);
    const [equipSaving, setEquipSaving] = useState(false);
    const [equipError, setEquipError] = useState<string | null>(null);
    const [equipDirty, setEquipDirty] = useState(false);

    // 선택 몬스터가 바뀔 때마다 장착 기술 초기화
// 1순위: equipped_moves에서 MOVE_DB에 있는 id만 사용
// 2순위: learned_moves 중 MOVE_DB에 있는 id
// 3순위: 종+레벨 기반 기본 기술 (getMovesForSpeciesAndLevel)
    useEffect(() => {
        if (!selected) {
            setEquipSlots([null, null, null, null]);
            setActiveEquipIndex(null);
            setEquipDirty(false);
            setEquipError(null);
            return;
        }

        const anyMon = selected as any;

        // ----- 1) equipped_moves 정리 -----
        const equippedRaw: string[] = Array.isArray(anyMon.equipped_moves)
            ? (anyMon.equipped_moves as string[])
            : [];

        const equippedValid = equippedRaw.filter(
            (id) => (MOVE_DB as any)[id],
        );

        const nextSlots: (string | null)[] = [
            null,
            null,
            null,
            null,
        ];

        if (equippedValid.length > 0) {
            for (let i = 0; i < 4; i += 1) {
                nextSlots[i] = equippedValid[i] ?? null;
            }

            setEquipSlots(nextSlots);
            setActiveEquipIndex(null);
            setEquipDirty(false);
            setEquipError(null);
            return;
        }

        // ----- 2) equipped_moves가 비어 있거나 구버전만 있는 경우 → 자동 장착 -----
        const learnedRaw: string[] = Array.isArray(anyMon.learned_moves)
            ? (anyMon.learned_moves as string[])
            : [];

        let learnedValid = learnedRaw.filter(
            (id) => (MOVE_DB as any)[id],
        );

        // learned_moves도 전부 구버전(growl 등)이면 레벨업 테이블에서 새로 생성
        if (learnedValid.length === 0) {
            const list = getMovesForSpeciesAndLevel(
                anyMon.species_id,
                anyMon.level,
            );
            learnedValid = list.map((m: any) => m.id);
        }

        for (let i = 0; i < 4; i += 1) {
            nextSlots[i] = learnedValid[i] ?? null;
        }

        setEquipSlots(nextSlots);
        setActiveEquipIndex(null);
        // 자동 장착된 내용은 DB에 저장되도록 dirty 플래그 on
        setEquipDirty(true);
        setEquipError(null);
    }, [selected?.id]);


    // equipSlots 변경이 있고 dirty일 때 DB 저장
    // equipSlots 변경이 있고 dirty일 때 DB 저장
    useEffect(() => {
        if (!profile || !selected || !equipDirty) return;

        let cancelled = false;

        const save = async () => {
            setEquipSaving(true);
            setEquipError(null);
            try {
                const payload = equipSlots.filter(
                    (id): id is string => Boolean(id),
                );

                const { error } = await supabase
                    .from("quizmon_owned_monsters")
                    .update({ equipped_moves: payload })
                    .eq("id", selected.id)
                    // 🔽 프로필까지 같이 걸어 주기
                    .eq("profile_id", profile.id);

                if (error) throw error;

                if (!cancelled) {
                    setEquipDirty(false);
                }
            } catch (e: any) {
                console.error(
                    "[PartyAndDexPanel] save equipped_moves error",
                    e,
                );
                if (!cancelled) {
                    setEquipError(
                        e?.message ??
                        "기술 장착을 저장하는 중 오류가 발생했습니다.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setEquipSaving(false);
                }
            }
        };

        void save();

        return () => {
            cancelled = true;
        };
    }, [equipDirty, equipSlots, profile, selected]);


    const learnedMoveIds: string[] = useMemo(() => {
        if (!selected) return [];
        const anyMon = selected as any;

        if (Array.isArray(anyMon.learned_moves)) {
            return anyMon.learned_moves as string[];
        }

        const list = getMovesForSpeciesAndLevel(
            anyMon.species_id,
            anyMon.level,
        );
        return list.map((m: any) => m.id);
    }, [selected?.id, selected?.level, selected?.species_id]);

    function getMoveName(moveId: string | null): string {
        if (!moveId) return "비어 있음";
        const move = (MOVE_DB as any)[moveId];
        return (move?.name as string) ?? moveId;
    }

    function handleEquipSlotClick(index: number) {
        setActiveEquipIndex((prev) => (prev === index ? null : index));
    }

    function handleToggleMove(moveId: string) {
        setEquipSlots((prev) => {
            const next = [...prev];

            // 이미 장착되어 있으면 해제
            const currentIndex = next.findIndex((id) => id === moveId);
            if (currentIndex !== -1) {
                next[currentIndex] = null;
                return next;
            }

            // 타겟 슬롯 결정
            let targetIndex =
                activeEquipIndex ??
                next.findIndex((id) => id == null);

            if (targetIndex === -1) {
                // 빈 슬롯이 없으면 1번 슬롯 덮어쓰기
                targetIndex = 0;
            }

            next[targetIndex] = moveId;
            return next;
        });
        setEquipDirty(true);
    }

    const dexList = useMemo(
        () =>
            [...enhancedMonsters].sort(
                (a, b) => (b.level ?? 1) - (a.level ?? 1),
            ),
        [enhancedMonsters],
    );

    const selectedSlotIndex = selected
        ? partyIds.findIndex((id) => id === selected.id)
        : -1;

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
                {/* 상단: 파티 / 선택 파트너 / 스킬 패널 */}
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
                                "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,64,175,0.9))",
                            color: "#e5e7eb",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
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
                                    fontSize: "0.9rem",
                                    fontWeight: 600,
                                }}
                            >
                                내 파티 (최대 3마리)
                            </div>
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    color: "#cbd5f5",
                                }}
                            >
                                편성{" "}
                                {
                                    partyIds.filter(
                                        (id) => id !== null,
                                    ).length
                                }
                                /3
                            </div>
                        </div>

                        {[0, 1, 2].map((index) => {
                            const mon = getMonsterInSlot(index);
                            const isSelected = selected
                                ? selected.id === mon?.id
                                : false;

                            return (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => {
                                        if (mon) {
                                            setSelectedId(mon.id);
                                        }
                                        handlePartySlotClick(index);
                                    }}
                                    style={{
                                        width: "100%",
                                        borderRadius: 999,
                                        border: isSelected
                                            ? "1px solid #38bdf8"
                                            : "1px solid rgba(148,163,184,0.5)",
                                        backgroundColor: mon
                                            ? "rgba(15,23,42,0.9)"
                                            : "rgba(15,23,42,0.6)",
                                        padding:
                                            "0.45rem 0.75rem 0.45rem 0.6rem",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent:
                                            "space-between",
                                        gap: "0.5rem",
                                        cursor: "pointer",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.45rem",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: "50%",
                                                backgroundColor:
                                                    "rgba(15,23,42,0.95)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent:
                                                    "center",
                                                overflow: "hidden",
                                            }}
                                        >
                                            {mon && (() => {
                                                const iconUrl =
                                                    getMonsterIcon(
                                                        mon.species_id,
                                                    );
                                                return (
                                                    iconUrl && (
                                                        <img
                                                            src={
                                                                iconUrl
                                                            }
                                                            alt={
                                                                mon.displayName
                                                            }
                                                            style={{
                                                                width: 24,
                                                                height: 24,
                                                                imageRendering:
                                                                    "pixelated",
                                                            }}
                                                        />
                                                    )
                                                );
                                            })()}
                                        </div>
                                        <div
                                            style={{
                                                textAlign: "left",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize:
                                                        "0.82rem",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {mon
                                                    ? mon.displayName
                                                    : "비어 있음"}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize:
                                                        "0.72rem",
                                                    color: "#cbd5f5",
                                                }}
                                            >
                                                {mon
                                                    ? `Lv.${mon.level} · ${mon.statusText}`
                                                    : "아래 도감에서 몬스터를 선택해 배치"}
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "0.7rem",
                                            color: "#9ca3af",
                                        }}
                                    >
                                        #{index + 1}
                                    </div>
                                </button>
                            );
                        })}

                        <div
                            style={{
                                fontSize: "0.72rem",
                                color: "#9ca3af",
                                marginTop: 2,
                                lineHeight: 1.4,
                            }}
                        >
                            파티 슬롯을 클릭한 뒤 아래 도감에서 교체할
                            몬스터를 선택하면 자리가 바뀝니다. 파티 변경
                            사항은 자동으로 저장됩니다.
                        </div>
                    </div>

                    {/* 가운데: 선택 파트너 상세 + 레벨업/회복 */}
                    <div
                        style={{
                            flex: 1,
                            borderRadius: 12,
                            border: "1px solid rgba(148,163,184,0.6)",
                            padding: "0.75rem 0.9rem",
                            background:
                                "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,64,175,0.85))",
                            color: "#e5e7eb",
                            display: "flex",
                            flexDirection: "column",
                            fontSize: "0.8rem",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 4,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "0.9rem",
                                    fontWeight: 600,
                                }}
                            >
                                선택한 파트너
                            </div>
                            {selected && (
                                <div
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "#cbd5f5",
                                    }}
                                >
                                    보유{" "}
                                    {
                                        enhancedMonsters.length
                                    }
                                    마리 중{" "}
                                    {dexList.findIndex(
                                        (m) => m.id === selected.id,
                                    ) + 1}
                                    번째
                                </div>
                            )}
                        </div>

                        {selected ? (
                            <div
                                style={{
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

                                        {/* 🔹 간단 능력치 */}
                                        {selectedStats && (
                                            <div
                                                style={{
                                                    marginTop: 4,
                                                    fontSize: "0.75rem",
                                                    color: "#cbd5f5",
                                                }}
                                            >
                                                HP {selectedStats.maxHp} · 공격{" "}
                                                {selectedStats.atk} · 방어{" "}
                                                {selectedStats.def} · 스피드{" "}
                                                {selectedStats.spd}
                                            </div>
                                        )}

                                        {/* 🔹 특성 표시 */}
                                        {selectedAbility && (
                                            <div
                                                style={{
                                                    marginTop: 2,
                                                    fontSize: "0.75rem",
                                                    color: "#e5e7eb",
                                                }}
                                            >
                                                특성{" "}
                                                <span
                                                    style={{
                                                        fontWeight: 600,
                                                    }}
                                                >
                {selectedAbility.name}
            </span>
                                                <span
                                                    style={{
                                                        marginLeft: 4,
                                                        opacity: 0.9,
                                                    }}
                                                >
                — {selectedAbility.short}
            </span>
                                            </div>
                                        )}
                                    </div>

                                </div>

                                {/* HP / 파티슬롯 정보 + 레벨업 버튼 */}
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent:
                                            "space-between",
                                        alignItems: "center",
                                        marginTop: 4,
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "0.75rem",
                                            color: "#cbd5f5",
                                        }}
                                    >
                                        HP {selected.currentHpText}
                                        {" · "}
                                        파티 슬롯{" "}
                                        {selectedSlotIndex >= 0
                                            ? selectedSlotIndex + 1
                                            : "편성 안 됨"}
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
                                            padding:
                                                "0.3rem 0.9rem",
                                            borderRadius: 999,
                                            border: "none",
                                            fontSize: "0.78rem",
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

                    {/* 오른쪽: 스킬 장착 패널 */}
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
                                기술 장착
                            </div>
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    color: "#cbd5f5",
                                }}
                            >
                                배운 기술 {learnedMoveIds.length}개
                            </div>
                        </div>

                        {/* 장착 슬롯 */}
                        <div
                            style={{
                                borderRadius: 10,
                                background: "rgba(15,23,42,0.9)",
                                padding: "0.45rem 0.55rem",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.35rem",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    color: "#cbd5f5",
                                    marginBottom: 2,
                                }}
                            >
                                장착된 기술 (최대 4개)
                            </div>
                            {equipSlots.map((moveId, idx) => {
                                const isActive =
                                    activeEquipIndex === idx;
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() =>
                                            handleEquipSlotClick(
                                                idx,
                                            )
                                        }
                                        style={{
                                            width: "100%",
                                            borderRadius: 999,
                                            border: isActive
                                                ? "1px solid #38bdf8"
                                                : "1px solid rgba(148,163,184,0.5)",
                                            backgroundColor:
                                                "rgba(15,23,42,0.95)",
                                            padding:
                                                "0.3rem 0.6rem",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent:
                                                "space-between",
                                            cursor: "pointer",
                                            fontSize: "0.75rem",
                                        }}
                                    >
                                        <span>
                                            {idx + 1}.{" "}
                                            {getMoveName(moveId)}
                                        </span>
                                        {isActive && (
                                            <span
                                                style={{
                                                    fontSize:
                                                        "0.7rem",
                                                    color: "#38bdf8",
                                                }}
                                            >
                                                선택됨
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* 배운 기술 리스트 */}
                        <div
                            style={{
                                borderRadius: 10,
                                background: "rgba(15,23,42,0.9)",
                                padding: "0.45rem 0.55rem",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.3rem",
                                maxHeight: 150,
                                overflowY: "auto",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    color: "#cbd5f5",
                                }}
                            >
                                배운 기술 목록
                            </div>
                            {learnedMoveIds.length === 0 && (
                                <div
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "#9ca3af",
                                        paddingTop: 2,
                                    }}
                                >
                                    아직 배운 기술이 없습니다.
                                </div>
                            )}
                            {learnedMoveIds.map((moveId) => {
                                const move = (MOVE_DB as any)[
                                    moveId
                                    ];
                                const name =
                                    (move?.name as string) ??
                                    moveId;
                                const typeLabel =
                                    (move?.element as string) ??
                                    (move?.type as string) ??
                                    "";
                                const isEquipped =
                                    equipSlots.indexOf(moveId) !==
                                    -1;

                                return (
                                    <button
                                        key={moveId}
                                        type="button"
                                        onClick={() =>
                                            handleToggleMove(
                                                moveId,
                                            )
                                        }
                                        style={{
                                            width: "100%",
                                            borderRadius: 8,
                                            border: isEquipped
                                                ? "1px solid #38bdf8"
                                                : "1px solid rgba(148,163,184,0.5)",
                                            backgroundColor:
                                                isEquipped
                                                    ? "rgba(8,47,73,0.95)"
                                                    : "rgba(15,23,42,0.95)",
                                            padding:
                                                "0.3rem 0.5rem",
                                            display: "flex",
                                            justifyContent:
                                                "space-between",
                                            alignItems: "center",
                                            fontSize: "0.75rem",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <div
                                            style={{
                                                textAlign: "left",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {name}
                                            </div>
                                            {typeLabel && (
                                                <div
                                                    style={{
                                                        fontSize:
                                                            "0.7rem",
                                                        color:
                                                            "#cbd5f5",
                                                    }}
                                                >
                                                    {typeLabel}
                                                </div>
                                            )}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: "0.7rem",
                                                color: isEquipped
                                                    ? "#38bdf8"
                                                    : "#9ca3af",
                                            }}
                                        >
                                            {isEquipped
                                                ? "장착됨"
                                                : "클릭해 장착"}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div
                            style={{
                                fontSize: "0.72rem",
                                color: "#cbd5f5",
                            }}
                        >
                            위 슬롯을 선택한 뒤 아래 기술을 클릭하면
                            해당 슬롯에 장착됩니다. 다시 클릭하면
                            장착이 해제됩니다.
                        </div>

                        {equipSaving && (
                            <div
                                style={{
                                    fontSize: "0.7rem",
                                    color: "#9ca3af",
                                }}
                            >
                                기술 장착 정보를 저장하는 중...
                            </div>
                        )}
                        {equipError && (
                            <div
                                style={{
                                    fontSize: "0.7rem",
                                    color: "#fecaca",
                                }}
                            >
                                {equipError}
                            </div>
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
                            "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,64,175,0.9))",
                        color: "#e5e7eb",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
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
                                fontSize: "0.9rem",
                                fontWeight: 600,
                            }}
                        >
                            도감 / 보유 몬스터
                        </div>
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
                            borderRadius: 10,
                            backgroundColor: "rgba(15,23,42,0.9)",
                            padding: "0.6rem",
                            overflowY: "auto",
                        }}
                    >
                        {props.collectionLoading ? (
                            <div
                                style={{
                                    fontSize: "0.8rem",
                                    color: "#9ca3af",
                                }}
                            >
                                보유 몬스터를 불러오는 중...
                            </div>
                        ) : props.collectionError ? (
                            <div
                                style={{
                                    fontSize: "0.8rem",
                                    color: "#fecaca",
                                }}
                            >
                                {props.collectionError}
                            </div>
                        ) : dexList.length === 0 ? (
                            <div
                                style={{
                                    fontSize: "0.8rem",
                                    color: "#9ca3af",
                                }}
                            >
                                아직 보유한 몬스터가 없습니다. 뽑기나
                                레이드 보상으로 포켓몬을 모아 보세요.
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                        "repeat(auto-fill, minmax(180px, 1fr))",
                                    gap: "0.5rem",
                                }}
                            >
                                {dexList.map((mon) => {
                                    const isSelected =
                                        selected &&
                                        selected.id === mon.id;
                                    return (
                                        <button
                                            key={mon.id}
                                            type="button"
                                            onClick={() =>
                                                setSelectedId(
                                                    mon.id,
                                                )
                                            }
                                            style={{
                                                textAlign: "left",
                                                borderRadius: 10,
                                                border: isSelected
                                                    ? "1px solid #38bdf8"
                                                    : "1px solid rgba(148,163,184,0.6)",
                                                backgroundColor:
                                                    "rgba(15,23,42,0.95)",
                                                padding:
                                                    "0.45rem 0.55rem",
                                                display: "flex",
                                                alignItems:
                                                    "center",
                                                gap: "0.45rem",
                                                cursor: "pointer",
                                            }}
                                        >
                                            {(() => {
                                                const iconUrl =
                                                    getMonsterIcon(
                                                        mon.species_id,
                                                    );
                                                return (
                                                    iconUrl && (
                                                        <img
                                                            src={
                                                                iconUrl
                                                            }
                                                            alt={
                                                                mon.displayName
                                                            }
                                                            style={{
                                                                width: 32,
                                                                height: 32,
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
                                                        fontSize:
                                                            "0.82rem",
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {mon.displayName}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize:
                                                            "0.75rem",
                                                        color:
                                                            "#cbd5f5",
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
            {levelModalOpen && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(15,23,42,0.8)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 50,
                    }}
                >
                    <div
                        style={{
                            width: 420,
                            maxWidth: "90vw",
                            borderRadius: 16,
                            border: "1px solid rgba(148,163,184,0.8)",
                            background:
                                "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,64,175,0.95))",
                            color: "#e5e7eb",
                            padding: "1rem 1.1rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
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
                                    fontSize: "0.95rem",
                                    fontWeight: 600,
                                }}
                            >
                                선택 파트너 레벨 업
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
                                        ? "not-allowed"
                                        : "pointer",
                                    fontSize: "0.9rem",
                                }}
                            >
                                닫기
                            </button>
                        </div>

                        {selected && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.6rem",
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
                                                    width: 40,
                                                    height: 40,
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
                                            fontSize: "0.88rem",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {selected.displayName}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "0.78rem",
                                            color: "#cbd5f5",
                                        }}
                                    >
                                        현재 Lv.{selected.level}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div
                            style={{
                                fontSize: "0.78rem",
                                color: "#cbd5f5",
                            }}
                        >
                            보유 Exp Dust + 레어 캔디: {totalPowerItems}
                            개. 아래 슬라이더로 사용 개수를 정한 뒤 레벨업
                            버튼을 눌러 주세요.
                        </div>

                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.3rem",
                            }}
                        >
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
                            />
                            <div
                                style={{
                                    fontSize: "0.78rem",
                                    color: "#cbd5f5",
                                }}
                            >
                                사용 예정 개수: {levelUseCount}개
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleConfirmLevelUp}
                            disabled={
                                levelBusy ||
                                levelUseCount <= 0 ||
                                totalPowerItems <= 0
                            }
                            style={{
                                marginTop: 4,
                                padding: "0.4rem 0.7rem",
                                borderRadius: 999,
                                border: "none",
                                fontSize: "0.82rem",
                                fontWeight: 600,
                                cursor:
                                    levelBusy ||
                                    levelUseCount <= 0 ||
                                    totalPowerItems <= 0
                                        ? "not-allowed"
                                        : "pointer",
                                background:
                                    levelBusy ||
                                    levelUseCount <= 0 ||
                                    totalPowerItems <= 0
                                        ? "rgba(75,85,99,0.9)"
                                        : "linear-gradient(90deg, #22c55e, #16a34a)",
                                color: "#f9fafb",
                                opacity:
                                    levelBusy ||
                                    levelUseCount <= 0 ||
                                    totalPowerItems <= 0
                                        ? 0.6
                                        : 1,
                            }}
                        >
                            {levelBusy ? "레벨 업 중..." : "레벨 업"}
                        </button>

                        {newlyLearnedMoves.length > 0 && (
                            <div
                                style={{
                                    marginTop: 4,
                                    padding: "0.4rem 0.55rem",
                                    borderRadius: 10,
                                    backgroundColor:
                                        "rgba(22,163,74,0.2)",
                                    border: "1px solid rgba(34,197,94,0.6)",
                                    fontSize: "0.75rem",
                                }}
                            >
                                <div
                                    style={{
                                        fontWeight: 600,
                                        marginBottom: 2,
                                    }}
                                >
                                    새로 배운 기술
                                </div>
                                <ul
                                    style={{
                                        paddingLeft: "1rem",
                                        margin: 0,
                                    }}
                                >
                                    {newlyLearnedMoves.map((id) => {
                                        const move =
                                            (MOVE_DB as any)[id];
                                        const name =
                                            (move?.name as string) ??
                                            id;
                                        return (
                                            <li key={id}>{name}</li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

                        {inventoryError && (
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    color: "#fecaca",
                                    marginTop: 2,
                                }}
                            >
                                {inventoryError}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
