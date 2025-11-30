// src/games/quizmon/QuizMonLobbyOverlay.tsx
import type {
    QuizmonProfileRow,
    QuizmonOwnedMonsterRow,
} from "./types";
import { PartyAndDexPanel } from "./PartyAndDexPanel";
import { ProfileTab } from "./ProfileTab";
import {InventoryTab} from "./InventoryTab.tsx";
import { useEffect, useState } from "react";
import { loadPowerItemCounts } from "./quizmonService";


type MainTabKey = "menu" | "monsters" | "dex" | "inventory" | "profile";

export type QuizMonLobbyOverlayProps = {
    menuTab: MainTabKey;
    onMenuTabChange: (tab: MainTabKey) => void;

    localProfile: QuizmonProfileRow | null;
    profile: QuizmonProfileRow | null;

    monsters?: QuizmonOwnedMonsterRow[];
    collectionLoading?: boolean;
    collectionError?: string | null;
    onHealAll?: () => void | Promise<void>;
    onSaveParty?: (partyIds: (string | null)[]) => void | Promise<void>;

    canContinue: boolean;
    onContinue: () => void;

    // 🔹 던전 / 레이드 둘 다 수업용
    onSelectDungeon: () => void;
    onSelectRaid: () => void;
    onSelectGacha: () => void;

    lastRaidResult?: { correct: number; total: number } | null;
    onBuyExpDust?: (quantity?: number) => Promise<void> | void;
};


export function QuizMonLobbyOverlay(props: QuizMonLobbyOverlayProps) {
    const {
        menuTab,
        onMenuTabChange,
        localProfile,
        profile,
        monsters,
        collectionLoading,
        collectionError,
        onHealAll,
        onSaveParty,
        canContinue,
        onContinue,
        onSelectDungeon,
        onSelectRaid,     // 🔹 추가
        onSelectGacha,
        lastRaidResult,
        onBuyExpDust,
    } = props;


    // 🔹 우선순위: localProfile(가챠/상점 등으로 갱신된 최신 프로필) → fallback profile
    const effectiveProfile = localProfile ?? profile;

    const trainerName =
        effectiveProfile?.trainer_name ?? "미지의 트레이너";

    /** 🔹 인벤토리 수량: Exp Dust / 레어 캔디 */
    const [xpDustCount, setXpDustCount] = useState(0);
    const [rareCandyCount, setRareCandyCount] = useState(0);

    useEffect(() => {
        if (!effectiveProfile?.id) {
            setXpDustCount(0);
            setRareCandyCount(0);
            return;
        }

        let cancelled = false;

        const loadInventory = async () => {
            try {
                const { expDustCount, rareCandyCount } =
                    await loadPowerItemCounts(effectiveProfile.id);
                if (cancelled) return;
                setXpDustCount(expDustCount);
                setRareCandyCount(rareCandyCount);
            } catch (err) {
                if (cancelled) return;
                console.error(
                    "[QuizMonLobbyOverlay] loadPowerItemCounts error",
                    err,
                );
                setXpDustCount(0);
                setRareCandyCount(0);
            }
        };

        void loadInventory();
        return () => {
            cancelled = true;
        };
    }, [effectiveProfile?.id]);

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
                    width: "min(1040px, 100%)",
                    maxHeight: "90vh",
                    padding: "1.1rem 1.3rem",
                    borderRadius: 24,
                    background: "rgba(15,23,42,0.98)",
                    border: "1px solid #1f2937",
                    boxShadow: "0 22px 60px rgba(0,0,0,0.8)",
                    overflowY: "auto",
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
                        overflowY: "auto",
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
                                    ▼ 여기부터 수업 시간용 던전 / 레이드 메뉴입니다.
                                </div>

                                {/* 던전: 던전 선택 오버레이로 이동 */}
                                <button
                                    type="button"
                                    onClick={onSelectDungeon}
                                    style={{
                                        width: "100%",
                                        textAlign: "left",
                                        borderRadius: 8,
                                        border: "1px solid #1d4ed8",
                                        background:
                                            "linear-gradient(90deg,#1d4ed8,#3b82f6)",
                                        color: "#e5f2ff",
                                        padding: "0.65rem 0.9rem",
                                        fontSize: 13,
                                        fontWeight: 600,
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
                                        borderRadius: 8,
                                        border: "1px solid #7f1d1d",
                                        background:
                                            "linear-gradient(90deg,#991b1b,#b91c1c)",
                                        color: "#fee2e2",
                                        padding: "0.65rem 0.9rem",
                                        fontSize: 13,
                                        fontWeight: 600,
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
                                        borderRadius: 8,
                                        border: "1px solid #374151",
                                        backgroundColor: "#020617",
                                        color: "#e5e7eb",
                                        padding: "0.65rem 0.9rem",
                                        fontSize: 13,
                                        cursor: "pointer",
                                    }}
                                >
                                    가챠 (보상 뽑기)
                                </button>

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
                        />
                    )}

                    {/* 프로필 탭 */}
                    {menuTab === "profile" && (
                        <ProfileTab
                            profile={effectiveProfile}
                            lastRaidResult={lastRaidResult}
                            onBuyExpDust={handleBuyExpDust}
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
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
