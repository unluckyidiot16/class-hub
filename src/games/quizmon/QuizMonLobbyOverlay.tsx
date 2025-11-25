// src/games/quizmon/QuizMonLobbyOverlay.tsx
import type {
    QuizmonProfileRow,
    QuizmonOwnedMonsterRow,
} from "./types";
import { PartyAndDexPanel } from "./PartyAndDexPanel";
import { ProfileTab } from "./ProfileTab";

type MenuTabKey = "menu" | "monsters" | "dex" | "profile";

export type QuizMonLobbyOverlayProps = {
    menuTab: MenuTabKey;
    onMenuTabChange: (tab: MenuTabKey) => void;

    localProfile: QuizmonProfileRow | null;
    profile: QuizmonProfileRow | null;

    monsters?: QuizmonOwnedMonsterRow[];
    collectionLoading?: boolean;
    collectionError?: string | null;
    onPullFreeGacha?: () => void | Promise<void>;
    onHealAll?: () => void | Promise<void>;
    onSaveParty?: (partyIds: (string | null)[]) => void | Promise<void>;

    canContinue: boolean;
    onContinue: () => void;
    onSelectDungeon: () => void;
    onSelectGacha: () => void;

    lastRaidResult?: { correct: number; total: number } | null;
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
        onPullFreeGacha,
        onHealAll,
        onSaveParty,
        canContinue,
        onContinue,
        onSelectDungeon,
        onSelectGacha,
        lastRaidResult,
    } = props;

    const trainerName =
        localProfile?.trainer_name ?? profile?.trainer_name ?? "미지의 트레이너";

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
                                { key: "profile", label: "프로필" },
                            ].map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() =>
                                        onMenuTabChange(tab.key as MenuTabKey)
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

                            <div
                                style={{
                                    marginTop: 8,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                }}
                            >
                                {/* 진행 중인 배틀 있을 때만 노출 */}
                                {canContinue && (
                                    <button
                                        type="button"
                                        onClick={onContinue}
                                        style={{
                                            width: "100%",
                                            padding: "0.5rem 0.75rem",
                                            borderRadius: 6,
                                            border: "1px solid #4b5563",
                                            backgroundColor: "#e5e7eb0d",
                                            color: "#e5e7eb",
                                            fontSize: 13,
                                            textAlign: "left",
                                            cursor: "pointer",
                                        }}
                                    >
                                        ▶ 계속하기
                                    </button>
                                )}

                                {/* 새 레이드 (던전) */}
                                <button
                                    type="button"
                                    onClick={onSelectDungeon}
                                    style={{
                                        width: "100%",
                                        padding: "0.5rem 0.75rem",
                                        borderRadius: 6,
                                        border: "1px solid #4b5563",
                                        backgroundColor: "#e5e7eb0d",
                                        color: "#e5e7eb",
                                        fontSize: 13,
                                        textAlign: "left",
                                        cursor: "pointer",
                                    }}
                                >
                                    새 레이드 시작 (던전)
                                </button>

                                {/* 가챠 씬 열기 */}
                                <button
                                    type="button"
                                    onClick={onSelectGacha}
                                    style={{
                                        width: "100%",
                                        padding: "0.5rem 0.75rem",
                                        borderRadius: 6,
                                        border: "1px solid #4b5563",
                                        backgroundColor: "#e5e7eb0d",
                                        color: "#e5e7eb",
                                        fontSize: 13,
                                        textAlign: "left",
                                        cursor: "pointer",
                                    }}
                                >
                                    가챠 (보상 뽑기)
                                </button>
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
                            onPullFreeGacha={onPullFreeGacha}
                            onHealAll={onHealAll}
                            onSaveParty={onSaveParty}
                        />
                    )}

                    {/* 프로필 탭 */}
                    {menuTab === "profile" && (
                        <ProfileTab
                            profile={profile}
                            lastRaidResult={lastRaidResult ?? null}
                        />
                    )}

                    {/* 도감 탭(menuTab === "dex")은 아직 별도 내용 없음 */}
                </div>
            </div>
        </div>
    );
}
