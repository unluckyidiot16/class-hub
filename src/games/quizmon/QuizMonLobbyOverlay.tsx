// src/games/quizmon/QuizMonLobbyOverlay.tsx
import {useMemo} from 'react'
import { supabase } from "../../lib/supabaseClient";
import type {
    QuizmonProfileRow,
    QuizmonOwnedMonsterRow,
} from "./types";
import type { TowerFloor } from "./BattleTowerTab";
import { PartyAndDexPanel } from "./PartyAndDexPanel";
import { ProfileTab } from "./ProfileTab";
import {InventoryTab} from "./InventoryTab.tsx";
import { useEffect, useState } from "react";
import { loadPowerItemCounts } from "./quizmonService";
import { DexTab } from "./DexTab";
import { StarShopTab } from "./StarShopTab";
import { BallShopTab } from "./BallShopTab";
import {loadBallItemCounts} from "./quizmonService";
import {ArenaTab} from "./ArenaTab.tsx";
import type { ArenaOpponent } from "./ArenaTab";
import { AchievementsTab } from "./AchievementsTab";
import { BattleTowerTab } from "./BattleTowerTab";




export type MainTabKey =
    | "menu"
    | "monsters"
    | "dex"
    | "inventory"
    | "profile"
    | "achievements"
    | "shop"
    | "arena"
    | "tower";

export type QuizMonLobbyOverlayProps = {
    menuTab: MainTabKey;
    onMenuTabChange: (tab: MainTabKey) => void;

    localProfile: QuizmonProfileRow | null;
    profile: QuizmonProfileRow | null;
    onProfileUpdated?: (profile: QuizmonProfileRow) => void; // ✅ 추가

    monsters?: QuizmonOwnedMonsterRow[];
    collectionLoading?: boolean;
    collectionError?: string | null;
    onHealAll?: () => void | Promise<void>;
    onHealSelected?: (ownedId: string) => void | Promise<void>;
    onSaveParty?: (partyIds: (string | null)[]) => void | Promise<void>;

    canContinue: boolean;
    onContinue: () => void;

    // 🔹 던전 / 레이드 둘 다 수업용
    onSelectDungeon: () => void;
    onSelectRaid: () => void;
    onSelectGacha: () => void;


    onRegisterArenaParty?: () => void;
    onSelectGhostBattle?: () => void;

    // 아레나
    arenaOpponents?: ArenaOpponent[];
    onStartArenaBattle?: (opponent: ArenaOpponent) => void;

    // 배틀 타워
    towerFloors?: TowerFloor[];
    onStartBattleTower?: (floor: TowerFloor) => void;
    
    lastRaidResult?: { correct: number; total: number } | null;
    onBuyExpDust?: (quantity?: number) => Promise<void> | void;

    /** 현재 학생이 가진 수업 코인 */
    classCoins?: number;

    /** 코인 → 젬 교환 로직 (ProfileTab으로 그대로 넘김) */
    onExchangeCoinsToGems?: (coins: number) => Promise<void> | void;
};

type ArenaProfileLite = {
    profile_id: string;
    attack_slot1_owned_id: string | null;
    attack_slot2_owned_id: string | null;
    attack_slot3_owned_id: string | null;
};

export function QuizMonLobbyOverlay(props: QuizMonLobbyOverlayProps) {
    const {
        menuTab,
        onMenuTabChange,
        localProfile,
        profile,
        onProfileUpdated,
        monsters,
        collectionLoading,
        collectionError,
        onHealAll,
        onHealSelected,
        onSaveParty,
        canContinue,
        onContinue,
        onSelectDungeon,
        onSelectRaid,
        onSelectGacha,
        onRegisterArenaParty,
        arenaOpponents,
        onSelectGhostBattle,
        onStartArenaBattle,
        onStartBattleTower,
        lastRaidResult,
        towerFloors,
        onBuyExpDust,
        classCoins,
        onExchangeCoinsToGems,
    } = props;

    const [arenaRating, setArenaRating] = useState<number | null>(null);
    const [opponentList, setOpponentList] = useState<ArenaOpponent[]>([]);

    void arenaRating;
    void opponentList;

    
    // ✅ 도감 탭에서 포커스할 종
    const [dexSelectedSpeciesId, setDexSelectedSpeciesId] =
        useState<string | null>(null);

    // 🔹 우선순위: localProfile(가챠/상점 등으로 갱신된 최신 프로필) → fallback profile
    const effectiveProfile = localProfile ?? profile;

    const trainerName =
        effectiveProfile?.trainer_name ?? "미지의 트레이너";

    const isDexTab = menuTab === "dex";

    /** 🔹 인벤토리 수량: Exp Dust / 레어 캔디 */
    const [xpDustCount, setXpDustCount] = useState(0);
    const [rareCandyCount, setRareCandyCount] = useState(0);

    // QuizMonLobbyOverlay.tsx 예시

    const [pokeBallCount, setPokeBallCount] = useState(0);
    const [greatBallCount, setGreatBallCount] = useState(0);
    const [ultraBallCount, setUltraBallCount] = useState(0);

    useEffect(() => {
        if (!effectiveProfile?.id) {
            setXpDustCount(0);
            setRareCandyCount(0);
            setPokeBallCount(0);
            setGreatBallCount(0);
            setUltraBallCount(0);
            return;
        }

        let cancelled = false;

        const loadInventory = async () => {
            try {
                const { expDustCount, rareCandyCount } =
                    await loadPowerItemCounts(effectiveProfile.id);
                const {
                    pokeBallCount,
                    greatBallCount,
                    ultraBallCount,
                } = await loadBallItemCounts(effectiveProfile.id);

                if (cancelled) return;

                setXpDustCount(expDustCount);
                setRareCandyCount(rareCandyCount);
                setPokeBallCount(pokeBallCount);
                setGreatBallCount(greatBallCount);
                setUltraBallCount(ultraBallCount);
            } catch (err) {
                if (cancelled) return;
                console.error("[QuizMonLobbyOverlay] load inventory error", err);
                // 필요시 0으로 초기화
            }
        };

        void loadInventory();
        return () => {
            cancelled = true;
        };
    }, [effectiveProfile?.id]);

    // QuizMonLobbyOverlay 컴포넌트 내부

    useEffect(() => {
        const profileId = effectiveProfile?.id;
        if (!profileId) {
            setArenaRating(null);
            setOpponentList([]);
            return;
        }

        let cancelled = false;

        const loadArenaOpponents = async () => {
            try {
                // 1) 내 랭크 정보 (가장 최근 시즌 1개)
                const { data: myRankRow, error: myRankError } =
                    await supabase
                        .from("quizmon_ranked_stats")
                        .select("profile_id, rating, season")
                        .eq("profile_id", profileId)
                        .order("season", { ascending: false })
                        .limit(1)
                        .maybeSingle();

                if (myRankError) {
                    console.warn(
                        "[arena] my ranked_stats error",
                        myRankError,
                    );
                }

                const myRating = myRankRow?.rating ?? 1000;
                if (cancelled) return;
                setArenaRating(myRating);

                // 2) 내 주변 레이팅 구간의 다른 플레이어들 조회
                const WINDOW = 300;

                const {
                    data: rankedList,
                    error: rankedListError,
                } = await supabase
                    .from("quizmon_ranked_stats")
                    .select("profile_id, rating")
                    .neq("profile_id", profileId)
                    .gte("rating", myRating - WINDOW)
                    .lte("rating", myRating + WINDOW)
                    .order("rating", { ascending: true })
                    .limit(30);

                if (rankedListError) {
                    console.error(
                        "[arena] ranked_list error",
                        rankedListError,
                    );
                    if (!cancelled) {
                        setOpponentList([]);
                    }
                    return;
                }

                const ranked = rankedList ?? [];

                // 내 레이팅과 가까운 순으로 정렬 후 5명 선택
                const selectedRanked = ranked
                    .sort(
                        (a, b) =>
                            Math.abs(a.rating - myRating) -
                            Math.abs(b.rating - myRating),
                    )
                    .slice(0, 5);
                
                // ✅ 0명이면 고스트 더미 생성으로 fallback
                if (selectedRanked.length === 0) {
                    if (cancelled) return;

                    const speciesIds = attackParty.map((m) => m.species_id);
                    const baseLevel = attackParty.reduce(
                        (max, m) => Math.max(max, m.level ?? 1),
                        1,
                    );

                    const makeGhost = (idx: number, delta: number): ArenaOpponent => {
                        const rating = myRating + delta;
                        let hideCount = 0;
                        if (delta >= 50) hideCount = 1;
                        if (delta >= 150) hideCount = 2;
                        if (delta >= 250) hideCount = 3;

                        const monsters = speciesIds.map((speciesId, i, arr) => ({
                            speciesId,
                            level: baseLevel + Math.max(0, Math.floor(delta / 20)),
                            hidden: i >= arr.length - hideCount,
                        }));

                        return {
                            id: `ghost-${idx}`,
                            name: `고스트 팀 #${idx}`,
                            rating,
                            isGhost: true,
                            monsters,
                        };
                    };

                    const ghosts: ArenaOpponent[] = [
                        makeGhost(1, -120),
                        makeGhost(2, -40),
                        makeGhost(3, +40),
                        makeGhost(4, +120),
                        makeGhost(5, +200),
                    ];

                    setOpponentList(ghosts);
                    return;
                }


                const opponentIds = selectedRanked.map(
                    (r) => r.profile_id,
                );

                if (opponentIds.length === 0) {
                    if (!cancelled) setOpponentList([]);
                    return;
                }

                const {
                    data: arenaRows,
                    error: arenaError,
                } = await supabase
                    .from("quizmon_arena_profiles")
                    .select(
                        "profile_id, attack_slot1_owned_id, attack_slot2_owned_id, attack_slot3_owned_id",
                    );
                
                if (arenaError) {
                    console.error(
                        "[arena] arena_profiles error",
                        arenaError,
                    );
                }
                
                const arenaList = (arenaRows ?? []) as ArenaProfileLite[];

                // 4) 트레이너 이름 (quizmon_profiles)
                const { data: quizmonProfiles, error: qpError } =
                    await supabase
                        .from("quizmon_profiles")
                        .select("id, trainer_name")
                        .in("id", opponentIds);

                if (qpError) {
                    console.error(
                        "[arena] quizmon_profiles error",
                        qpError,
                    );
                }

                const profileMap = new Map(
                    (quizmonProfiles ?? []).map((p) => [
                        p.id,
                        p,
                    ]),
                );

                // 5) 상대 몬스터 정보 (owned_monsters)
                const ownedIds: string[] = [];
                for (const a of arenaList) {
                    if (a.attack_slot1_owned_id)
                        ownedIds.push(a.attack_slot1_owned_id);
                    if (a.attack_slot2_owned_id)
                        ownedIds.push(a.attack_slot2_owned_id);
                    if (a.attack_slot3_owned_id)
                        ownedIds.push(a.attack_slot3_owned_id);
                }

                const uniqueOwnedIds = Array.from(
                    new Set(ownedIds),
                );
                let ownedMap = new Map<string, any>();

                if (uniqueOwnedIds.length > 0) {
                    const {
                        data: ownedRows,
                        error: ownedError,
                    } = await supabase
                        .from("quizmon_owned_monsters")
                        .select(
                            "id, species_id, level",
                        )
                        .in("id", uniqueOwnedIds);

                    if (ownedError) {
                        console.error(
                            "[arena] owned_monsters error",
                            ownedError,
                        );
                    }

                    ownedMap = new Map(
                        (ownedRows ?? []).map((m) => [m.id, m]),
                    );
                }

                // 6) ArenaOpponent 배열 조립
                const opponents: ArenaOpponent[] =
                    selectedRanked.map((rankRow, idx) => {
                        const arena = arenaList.find(
                            (a) =>
                                a.profile_id ===
                                rankRow.profile_id,
                        );
                        const qp = profileMap.get(
                            rankRow.profile_id,
                        );

                        const rating = rankRow.rating;
                        const gap = rating - myRating;

                        // ▷ 랭크 차이 클수록 뒤에서부터 한 칸씩 가리기
                        let hideCount = 0;
                        if (gap >= 50) hideCount = 1;
                        if (gap >= 150) hideCount = 2;
                        if (gap >= 250) hideCount = 3;

                        const slotOwnedIds = [
                            arena?.attack_slot1_owned_id,
                            arena?.attack_slot2_owned_id,
                            arena?.attack_slot3_owned_id,
                        ];

                        const monstersRaw = slotOwnedIds
                            .map((ownedId) => {
                                if (!ownedId) return null;
                                const om =
                                    ownedMap.get(ownedId);
                                if (!om) return null;
                                return {
                                    speciesId:
                                    om.species_id,
                                    level: om.level ?? 1,
                                };
                            })
                            .filter(Boolean) as {
                            speciesId: string;
                            level: number;
                        }[];

                        const monsters =
                            monstersRaw.map(
                                (m, i, arr) => ({
                                    ...m,
                                    hidden:
                                        i >=
                                        arr.length -
                                        hideCount,
                                }),
                            );

                        return {
                            id: rankRow.profile_id,
                            name:
                                qp?.trainer_name ??
                                `상대 트레이너 ${idx + 1}`,
                            rating,
                            isGhost: false,
                            monsters,
                        };
                    });

                if (!cancelled) {
                    setOpponentList(opponents);
                }
            } catch (err) {
                console.error("[arena] load error", err);
                if (!cancelled) {
                    setOpponentList([]);
                }
            }
        };

        void loadArenaOpponents();

        return () => {
            cancelled = true;
        };
    }, [effectiveProfile?.id]);


    // 현재 파티(1~3번 슬롯)만 추려서 공격 덱으로 사용
    const attackParty = useMemo(
        () =>
            (monsters ?? [])
                .filter(
                    (m) =>
                        m.party_slot != null &&
                        m.party_slot >= 1 &&
                        m.party_slot <= 3,
                )
                .sort(
                    (a, b) =>
                        (a.party_slot ?? 0) - (b.party_slot ?? 0),
                ),
        [monsters],
    );

    /** 🔹 인벤토리 탭 / 프로필 탭에서 공용으로 쓸 구매 핸들러 */
    const handleBuyExpDust = async (quantity = 1) => {
        if (!onBuyExpDust) return;
        await onBuyExpDust(quantity);

        if (!effectiveProfile?.id) return;
        try {
            const { expDustCount, rareCandyCount } =
                await loadPowerItemCounts(effectiveProfile.id);
            setXpDustCount(expDustCount);
            setRareCandyCount(rareCandyCount);
        } catch (err) {
            console.error(
                "[QuizMonLobbyOverlay] reload inventory error",
                err,
            );
        }
    };
    
    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.45)",
                zIndex: 30,
            }}
        >
            <div
                style={{
                    // 🔍 전체 카드 사이즈 확대
                    width: "min(1200px, 100%)",
                    height: "min(800px, 95vh)",
                    maxHeight: "95vh",

                    padding: "1.4rem 1.6rem",      // 패딩도 살짝 증가
                    borderRadius: 24,
                    background: "rgba(15,23,42,0.98)",
                    border: "1px solid #1f2937",
                    boxShadow: "0 24px 70px rgba(0,0,0,0.85)",
                    overflowY: "hidden",
                    display: "flex",
                    flexDirection: "column",
                }}
            >

            {/* 헤더 + 탭 */}
                <div style={{ marginBottom: 16, flex: "0 0 auto" }}>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>
                        QuizMon Class · Beta
                    </div>
                    <div
                        style={{
                            fontSize: 18,
                            fontWeight: 600,
                            color: "#e5e7eb",
                        }}
                    >
                        메인 메뉴
                    </div>

                    <div
                        style={{
                            marginTop: 12,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                            }}
                        >
                            {[
                                { key: "menu", label: "메뉴" },
                                { key: "monsters", label: "몬스터" },
                                { key: "dex", label: "도감" },
                                { key: "inventory", label: "인벤토리" },
                                { key: "profile", label: "프로필" },
                                { key: "achievements", label: "업적" },
                                { key: "shop", label: "상점" },
                                { key: "arena", label: "아레나"},
                                { key: "tower", label: "배틀타워"},
                            ].map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() =>
                                        onMenuTabChange(tab.key as MainTabKey)
                                    }
                                    style={{
                                        padding: "4px 10px",
                                        borderRadius: 999,
                                        border: "none",
                                        cursor: "pointer",
                                        background:
                                            menuTab === tab.key
                                                ? "rgba(59,130,246,0.2)"
                                                : "transparent",
                                        color:
                                            menuTab === tab.key
                                                ? "#bfdbfe"
                                                : "#9ca3af",
                                        fontWeight:
                                            menuTab === tab.key
                                                ? 600
                                                : 500,
                                        fontSize: 13,
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 탭별 내용 */}
                <div
                    style={{
                        flex: "1 1 auto",
                        minHeight: 0,
                        overflowY: isDexTab ? "hidden" : "auto",  // ✅ 도감 탭일 땐 스크롤 끔
                    }}
                >
                    {/* 메인 메뉴 탭 */}
                    {menuTab === "menu" && (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 12,
                            }}
                        >
                            {/* 제목/설명 */}
                            <div>
                                <div
                                    style={{
                                        fontSize: 13,
                                        color: "#e5e7eb",
                                        marginBottom: 4,
                                    }}
                                >
                                    {trainerName}의 퀴즈 레이드
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "#9ca3af",
                                    }}
                                >
                                    퀴즈를 풀어 상대 몬스터를 쓰러뜨려 보세요!
                                </div>
                            </div>

                            {/* 계속하기 버튼 */}
                            <button
                                type="button"
                                onClick={canContinue ? onContinue : undefined}
                                disabled={!canContinue}
                                style={{
                                    width: "100%",
                                    padding: "0.5rem 0.75rem",
                                    borderRadius: 6,
                                    border: "1px solid #4b5563",
                                    backgroundColor: canContinue
                                        ? "#e5e7eb0d"
                                        : "rgba(15,23,42,0.6)",
                                    color: canContinue ? "#e5e7eb" : "#4b5563",
                                    fontSize: 13,
                                    textAlign: "left",
                                    cursor: canContinue ? "pointer" : "default",
                                }}
                            >
                                ▶ 계속하기
                            </button>

                            {/* 수업용 던전 / 레이드 / 가챠 섹션 */}
                            <div
                                style={{
                                    marginTop: 4,
                                    paddingTop: 8,
                                    borderTop: "1px dashed #374151",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "#f97316",
                                    }}
                                >
                                </div>

                                {/* 던전: 던전 선택 오버레이로 이동 */}
                                <button
                                    type="button"
                                    onClick={onSelectDungeon}
                                    style={{
                                        width: "100%",
                                        textAlign: "left",
                                        borderRadius: 10,
                                        border: "1px solid #1d4ed8",
                                        background:
                                            "linear-gradient(90deg,#1d4ed8,#3b82f6)",
                                        color: "#e5f2ff",
                                        padding: "0.85rem 1.05rem", // 🔍 패딩↑
                                        fontSize: 15,               // 🔍 글자 크기↑
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    🌲 던전 돌기 (스테이지 선택)
                                </button>


                                {/* 레이드: 바로 클래스 레이드 전투 진입 */}
                                <button
                                    type="button"
                                    onClick={onSelectRaid}
                                    style={{
                                        width: "100%",
                                        textAlign: "left",
                                        borderRadius: 10,
                                        border: "1px solid #7f1d1d",
                                        background:
                                            "linear-gradient(90deg,#991b1b,#b91c1c)",
                                        color: "#fee2e2",
                                        padding: "0.85rem 1.05rem",
                                        fontSize: 15,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    ✖ 클래스 레이드 시작
                                </button>

                                {/* 공통: 가챠 (보상 뽑기) */}
                                <button
                                    type="button"
                                    onClick={onSelectGacha}
                                    style={{
                                        width: "100%",
                                        textAlign: "left",
                                        borderRadius: 10,
                                        border: "1px solid #374151",
                                        backgroundColor: "#020617",
                                        color: "#e5e7eb",
                                        padding: "0.85rem 1.05rem",
                                        fontSize: 15,
                                        cursor: "pointer",
                                    }}
                                >
                                    가챠 (보상 뽑기)
                                </button>
                                {/* 아레나: 현재 파티를 공격/방어 파티로 등록 */}
                                {onRegisterArenaParty && (
                                    <button
                                        type="button"
                                        onClick={onRegisterArenaParty}
                                        style={{
                                            width: "100%",
                                            textAlign: "left",
                                            borderRadius: 10,
                                            border: "1px solid #0f766e",
                                            background: "linear-gradient(90deg,#0f766e,#14b8a6)",
                                            color: "#ecfeff",
                                            padding: "0.85rem 1.05rem",
                                            fontSize: 15,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                        }}
                                    >
                                        🏟 아레나 파티 등록 (현재 파티)
                                    </button>
                                )}

                                {/* 고스트/아레나 배틀 시작 버튼 (라벨만 살짝 변경) */}
                                {onSelectGhostBattle && (
                                    <button
                                        type="button"
                                        onClick={onSelectGhostBattle}
                                        style={{
                                            width: "100%",
                                            textAlign: "left",
                                            borderRadius: 10,
                                            border: "1px solid #6b21a8",
                                            background: "linear-gradient(90deg,#6b21a8,#a855f7)",
                                            color: "#f5ecff",
                                            padding: "0.85rem 1.05rem",
                                            fontSize: 15,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                        }}
                                    >
                                        👻 아레나 배틀 (고스트 대전)
                                    </button>
                                )}
                                
                                {/* 최근 레이드 결과 (있을 때만 표시) */}
                                {lastRaidResult && (
                                    <div
                                        style={{
                                            marginTop: 4,
                                            padding: "0.55rem 0.75rem",
                                            borderRadius: 8,
                                            border: "1px solid #1f2937",
                                            backgroundColor: "rgba(15,23,42,0.9)",
                                            fontSize: 12,
                                            color: "#e5e7eb",
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "#9ca3af",
                                                marginBottom: 2,
                                            }}
                                        >
                                            최근 레이드 결과
                                        </div>
                                        <div>
                                            정답 {lastRaidResult.correct} /{" "}
                                            {lastRaidResult.total} 문제
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                    {/* 몬스터 탭 */}
                    {menuTab === "monsters" && (
                        <PartyAndDexPanel
                            profile={localProfile}
                            monsters={monsters}
                            collectionLoading={collectionLoading}
                            collectionError={collectionError}
                            onHealAll={onHealAll}
                            onSaveParty={onSaveParty}
                            onHealSelected={onHealSelected}
                            // ✅ “도감에서 보기” 버튼 눌렀을 때
                            onNavigateToDex={(speciesId) => {
                                setDexSelectedSpeciesId(speciesId);
                                onMenuTabChange("dex");
                            }}
                        />
                    )}

                    {/* 프로필 탭 */}
                    {menuTab === "profile" && (
                        <ProfileTab
                            profile={effectiveProfile}
                            lastRaidResult={lastRaidResult}
                            onBuyExpDust={handleBuyExpDust}
                            classCoins={classCoins}
                            onExchangeCoinsToGems={onExchangeCoinsToGems}
                        />
                    )}

                    {/* 인벤토리 탭 */}
                    {menuTab === "inventory" && (
                        <div
                            style={{
                                flex: 1,
                                overflow: "auto",
                            }}
                        >
                            <InventoryTab
                                profile={effectiveProfile}
                                xpDustCount={xpDustCount}
                                rareCandyCount={rareCandyCount}
                                onBuyExpDust={handleBuyExpDust}
                                pokeBallCount={pokeBallCount}
                                greatBallCount={greatBallCount}
                                ultraBallCount={ultraBallCount}
                            />
                        </div>
                    )}
                    {/* 업적 탭 */}
                    {menuTab === "achievements" && (
                        <AchievementsTab profile={effectiveProfile} />
                    )}

                    {/* 상점 탭: 포켓볼 상점 + Star Shards 상점 */}
                                        {menuTab === "shop" && (
                                            <div
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns:
                                                        "minmax(0, 1.1fr) minmax(0, 1fr)",
                                                    gap: 12,
                                                    height: "100%",
                                                    minHeight: 0,
                                                }}
                                            >
                                                <BallShopTab
                                                    profile={effectiveProfile}
                                                    onProfileUpdated={onProfileUpdated}
                                                />
                                                <StarShopTab
                                                    profile={effectiveProfile}
                                                    onProfileUpdated={onProfileUpdated}
                                                />
                                            </div>
                                        )}
                    
                    {/* 도감 탭 */}
                    {menuTab === "dex" && (
                        <div
                            style={{
                                flex: 1,
                                minHeight: 0,
                                height: "100%",  // ✅ [수정] 부모 높이를 자식(DexTab)에게 100% 전달
                                display: "flex",
                                flexDirection: "column", // 혹시 모를 레이아웃 깨짐 방지
                            }}
                        >
                            <DexTab
                                monsters={monsters}
                                selectedSpeciesId={dexSelectedSpeciesId}
                                onSelectSpecies={setDexSelectedSpeciesId}
                            />
                        </div>
                    )}
                    {menuTab === "arena" && (
                        <ArenaTab
                            profile={profile ?? localProfile}
                            // 🔹 아직 프로필에 arena_rating 컬럼이 없으므로,
                            //    ELO는 내부 기본값(1000) 사용
                            rating={arenaRating ?? undefined}
                            tierLabel={undefined}
                            // 공격/방어 덱: 일단 파티 슬롯(1~3) 기준 동일하게 사용
                            attackParty={(monsters ?? []).filter(
                                (m) =>
                                    (m.party_slot ?? 0) >= 1 &&
                                    (m.party_slot ?? 0) <= 3,
                            )}
                            defenseParty={(monsters ?? []).filter(
                                (m) =>
                                    (m.party_slot ?? 0) >= 1 &&
                                    (m.party_slot ?? 0) <= 3,
                            )}
                            // 외부에서 내려주면 그걸 우선 사용, 없으면 로컬 opponentList 사용
                            opponents={arenaOpponents ?? opponentList}
                            onSelectOpponent={onStartArenaBattle}
                        /> 
                    )}

                    {/* 배틀 타워 탭 */}
                    {menuTab === "tower" && (
                        <BattleTowerTab
                            profile={effectiveProfile}
                            floors={towerFloors ?? []}
                            onSelectFloor={(floor) => {
                                if (!onStartBattleTower) return;
                                onStartBattleTower(floor);
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
