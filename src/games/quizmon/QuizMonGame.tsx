// src/games/quizmon/QuizMonGame.tsx
import { useEffect, useRef, useState } from "react";
import type {
    BattleState,
    Move,
    QuizAnswerResult,
    Monster,
    QuizmonOwnedMonsterRow,
    QuizmonSpeciesRow,
    QuizmonProfileRow,
} from "./types";
import { useQuizmonBattle } from "./useQuizmonBattle";
import { createInitialBattleState } from "./mockData";
import { supabase } from "../../lib/supabaseClient";
import { buildBattleMonsterFromSpecies } from "./battleFactory";
import type { QuizPackJsonV1 } from "../../types/quizPackJson";
import { getArenaSprite, getMonsterAnimJson, getMonsterSprite, getMonsterIcon, } from "./assets";
import { SpriteAnimation } from "./SpriteAnimation";
import { useGachaDraw } from "./useGachaDraw";
import { QuizMonLobbyOverlay } from "./QuizMonLobbyOverlay";
import {
    healAllMonstersService,
    healSingleMonsterService,
    } from "./quizmonService";
import { QuizMonBattleView } from "./QuizMonBattleView";
import { QuizMonResultOverlay } from "./QuizMonResultOverlay";
import { useQuizmonContext } from "./QuizmonProvider";
import { MOVE_DB, getMovesForSpeciesAndLevel } from "./moveData";
import {
    DUNGEON_CONFIGS,
    ENEMY_SETS,
    type EnemySlot,
    evaluateDungeonForFocusStat,
    FOCUS_STAT_LABEL,
} from "./dungeonEnemySets";
import type { QuizmonRaidSessionRow } from "./quizmonRaidSessions";
import { getActiveRaidSession } from "./quizmonRaidSessions";
import type { MainTabKey } from "./QuizMonLobbyOverlay";
import type { ArenaOpponent } from "./ArenaTab";
import type { TowerFloor, TowerFloorMonster } from "./BattleTowerTab";


function getDefaultAbilityForSpecies(species: QuizmonSpeciesRow) {
    // HP 1/3 이하일 때 풀 기술 1.5배
    if (species.element === "grass") {
        return "overgrow" as const;
    }

    // 물 기술 받는 피해 0.8배
    if (species.element === "water") {
        return "water_guard" as const;
    }

    // 그 외는 아직 특성 없음
    return null;
}

// 🔹 배틀 타워에서 층 카드에 보여줄 "예상 적 몬스터" 미리보기
function getTowerPreviewMonsters(dungeonId: string): TowerFloorMonster[] {
    const dungeon = DUNGEON_CONFIGS.find((d) => d.id === dungeonId);
    if (!dungeon?.enemySetId) {
        return [];
    }
    
    const baseKey = dungeon.enemySetId;
    const allKeys = Object.keys(ENEMY_SETS);
    
    // ENEMY_SETS에서 baseKey 또는 `${baseKey}-A` 같은 변형 키가 있으면 우선 사용
    const candidateKey =
        allKeys.find(
            (key) => key === baseKey || key.startsWith(`${baseKey}-`),
        ) ?? baseKey;
    
    const slots = ENEMY_SETS[candidateKey] ?? [];
    
    return slots.map((slot) => ({
        speciesId: slot.speciesId,
        level: slot.level ?? null,
    }));
}


// 🔢 종 스탯 + 레벨로 대략적인 "파워" 점수 계산
// (절대값은 의미 없고, 서로 비교할 때만 사용)
    function calcSpeciesPower(species: QuizmonSpeciesRow, level: number): number {
          const baseHp = species.base_hp ?? 1;
          const baseAtk = species.base_atk ?? 1;
          const baseDef = species.base_def ?? 1;
          const baseSpd = species.base_spd ?? 1;
          const statTotal = baseHp + baseAtk + baseDef + baseSpd;
          return statTotal * Math.max(1, level);
}


// viewState 는 던전 단위 상태(DungeonState) 역할
// - "lobby": 메인 메뉴 오버레이
// - "battle": 실제 전투 진행 화면
// - "result": 배틀 결산 오버레이
// viewState 는 던전 단위 상태(DungeonState) 역할
type ViewState = "title" | "lobby" | "battle" | "result" | "gacha" | "dungeon";

// 배열 셔플 유틸 (Fisher–Yates)
function shuffleArray<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

const MOCK_TOWER_FLOORS: TowerFloor[] = [
    {
        id: "tower-test-1",
        floor: 1,
        name: "입문자 코스",
        recommendedRating: 800,
        cleared: false,
        locked: false,
        monsters: [
            { speciesId: "bulbasaur", level: 3 },
            { speciesId: "charmander", level: 3 },
            { speciesId: "squirtle", level: 3 },
        ],
    },
    {
        id: "tower-test-2",
        floor: 2,
        name: "중급 도전자",
        recommendedRating: 1000,
        cleared: false,
        locked: false,
        monsters: [
            { speciesId: "pikachu", level: 5 },
            { speciesId: "pidgey", level: 5 },
        ],
    },
];

// =========================
// 🌆 배틀 BG / 하단 패널용 헬퍼
// =========================

const PLAYER_SPECIES_ID = "poke-0001" as const;


// =========================
// 🎮 Game 컴포넌트
// =========================

type QuizMonGameProps = {
    quizpack: QuizPackJsonV1;
    roomId?: string | null;
    gameSessionId?: string | null;
    studentId?: string | null;

    /** quizmon_profile.id - 있으면 이 프로필의 파티(1~3번)로 전투 시작 */
    profileId?: string | null;

    onQuizAnswer?: (result: QuizAnswerResult) => void;
    onBattleEnd?: (summary: {
        correct: number;
        total: number;
    }) => void;

    // 🔹 메인 메뉴 탭(몬스터 / 도감 / 프로필)에서 쓰는 데이터
    profile?: QuizmonProfileRow | null;
    monsters?: QuizmonOwnedMonsterRow[];
    collectionLoading?: boolean;
    collectionError?: string | null;
    lastRaidResult?: { correct: number; total: number } | null;
    onHealAll?: () => void | Promise<void>;

    /** 배틀 종료 후 HP를 저장한 뒤 컬렉션을 다시 불러오는 콜백 */
    onRefreshCollection?: () => void | Promise<void>;
};



export function QuizMonGame(props: QuizMonGameProps) {
    const {
        quizpack,
        roomId,
        gameSessionId,
        studentId,
        profileId,
        onQuizAnswer,
        onBattleEnd,
    } = props;

    const isClassRaid = !!roomId && !!gameSessionId && !!studentId;
    
    const [activeRaidSession, setActiveRaidSession] =
        useState<QuizmonRaidSessionRow | null>(null);
    const [raidSessionLoading, setRaidSessionLoading] = useState(false);

    // 🩹 파티 전체 회복 – quizmonService.ts를 통해 일괄 처리
    const handleHealAll = async () => {
        if (!localProfile) return;
        
        try {
            await healAllMonstersService(localProfile.id);
        } catch (error) {
            console.error("[QuizMonGame] handleHealAll error", error);
            alert("파티 전체 회복 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
        }
    };
    
    // 🩹 개별 몬스터 회복 – 선택된 owned_monster_id 기준
    const handleHealSelected = async (ownedMonsterId: string) => {
        if (!localProfile) return;
                   try {
                       await healSingleMonsterService(localProfile.id, ownedMonsterId);
            
                       // TODO: 여기서도 마찬가지로 컬렉션/프로필 리로드 가능
                   } catch (error) {
                       console.error("[QuizMonGame] handleHealSelected error", error);
                       alert("몬스터 회복 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
                   }
           };

    // 🔹 가챠/재화용 프로필 로컬 상태 (부모 profile과 동기화)
    const [localProfile, setLocalProfile] = useState<QuizmonProfileRow | null>(
        props.profile ?? null,
    );

    // 🔹 화면 너비에 따라 배틀 연출 스케일 조정용
    const [viewportWidth, setViewportWidth] = useState(
        typeof window !== "undefined" ? window.innerWidth : 1024,
    );

    const rootRef = useRef<HTMLDivElement | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [fullscreenSupported, setFullscreenSupported] = useState(false);

    // 🔹 배틀 포기(도망가기) 핸들러
    const handleRunAway = () => {
        // 진행 중인 배틀/던전 전부 리셋 + 계속하기 비활성화
        setState(createInitialBattleState());
        setBattleStats({ correct: 0, total: 0 });
        setHasReportedEnd(false);
        setQuestionIndex(0);
        setCurrentTowerFloorInfo(null);
        setHasReportedTowerClear(false);
        setHasBattleInitialized(false);
        setViewState("lobby");
    };

    useEffect(() => {
        if (typeof document === "undefined") return;
        // 전체화면 지원 여부 체크
        setFullscreenSupported(!!document.fullscreenEnabled);
        
        const handleFsChange = () => {
            if (!rootRef.current) {
                setIsFullscreen(false);
                return;
            }
            setIsFullscreen(document.fullscreenElement === rootRef.current);
        };
            
        document.addEventListener("fullscreenchange", handleFsChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFsChange);
        };
        }, []);
    
    const enterFullscreen = () => {
        if (typeof document === "undefined") return;
        const el = rootRef.current;
        if (!el || !document.fullscreenEnabled) return;
        el.requestFullscreen().catch((err) => {
            console.error("[QuizMonGame] requestFullscreen failed", err);
        });
    };

    // 플레이어 파티 기준으로, 던전의 focusStat 값(평균)을 계산
    const getPartyFocusStatValueForDungeon = (dungeonId: string): number | null => {
        const dungeon = DUNGEON_CONFIGS.find((d) => d.id === dungeonId);
        if (!dungeon) return null;

        const focusStat = dungeon.focusStat;

        // 1) 레벨 기반 던전이면, 아직 배틀 전이라도 props.monsters 에서 바로 계산
        if (focusStat === "level") {
            const mons = props.monsters ?? [];
            if (!mons.length) return null;

            const sum = mons.reduce((acc, m) => acc + (m.level ?? 1), 0);
            return sum / mons.length;
        }

        // 2) 그 외 능력치는 실제 BattleState의 Monster 에서 계산
        const battleMons = state.player.monsters;
        if (!battleMons.length) return null;

        const sum = battleMons.reduce((acc, m) => {
            switch (focusStat) {
                case "maxHp":
                    return acc + (m.maxHp ?? 0);
                case "atk":
                    return acc + (m.atk ?? 0);
                case "def":
                    return acc + (m.def ?? 0);
                case "spd":
                    return acc + (m.spd ?? 0);
                default:
                    return acc + (m.level ?? 1);
            }
        }, 0);

        return sum / battleMons.length;
    };


    const exitFullscreen = () => {
        if (typeof document === "undefined") return;
        if (!document.fullscreenElement) return;
        document.exitFullscreen().catch((err) => {
            console.error("[QuizMonGame] exitFullscreen failed", err);
        });
    };
    
    const { buyExpDust } = useQuizmonContext();

    useEffect(() => {
        setLocalProfile(props.profile ?? null);
    }, [props.profile]);


    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleResize = () => {
            setViewportWidth(window.innerWidth);
        };
        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    const {
        loading: gachaDrawing,  // ✅ useGachaDraw가 반환하는 loading을 gachaDrawing 이라는 이름으로 사용
        error: gachaError,
        pullGacha,
        lastResult: gachaLastResult,   // ✅ 최근 결과
    } = useGachaDraw({
        profile: localProfile,
        onProfileUpdated: setLocalProfile,
    });


    // 1) 전투 상태 + 퀴즈 로직은 useQuizmonBattle 훅으로 분리
    const {
        state,
        setState,
        questions,
        setQuestionIndex,
        setQuestionOrder,
        battleStats,
        setBattleStats,
        setHasReportedEnd,
        playerMon,
        enemyMon,
        canSelectMove,
        accuracyPercent,
        battleFinished,
        handleSelectMove,
        handleAnswer,
        handleSwitch,
        damagePopups,
        canCapture,
        onRequestCapture,
        captureUi,
        captureHandlers,
    } = useQuizmonBattle({
        quizpack,
        roomId,
        gameSessionId,
        studentId,
        profileId,
        onQuizAnswer,
        onBattleEnd,
    });


    type LobbyMenuTab = MainTabKey; // ✅ 그냥 alias로 재사용

    const [menuTab, setMenuTab] = useState<LobbyMenuTab>("menu");

    // 상위 던전 상태 (메인 메뉴 / 배틀 / 결산)
    const [viewState, setViewState] = useState<ViewState>("lobby");

    // 🔹 이번 전투가 어떤 모드인지(레이드 / 던전)
    const [battleMode, setBattleMode] = useState<"raid" | "dungeon">(
        isClassRaid ? "raid" : "dungeon",
    );

    // 🔹 현재 배틀이 배틀 타워에서 시작된 경우 층 정보 추적
    const [currentTowerFloorInfo, setCurrentTowerFloorInfo] = useState<{
        id: string;
        floor: number;
    } | null>(null);
    const [hasReportedTowerClear, setHasReportedTowerClear] =
        useState(false);

    // 🔹 가장 첫 번째 던전을 기본값으로 사용 (이때부터 9개든 3개든 상관 없음)
    const [selectedDungeonId, setSelectedDungeonId] = useState<string>(() => {
        return DUNGEON_CONFIGS[0]?.id ?? "";
    });

    // 🔹 배틀 타워 층 목록
    const [towerFloors, setTowerFloors] = useState<TowerFloor[]>([]);

    const towerFloorsForUi =
        towerFloors.length > 0 ? towerFloors : MOCK_TOWER_FLOORS;
    
    const canPaidGacha =
        !!localProfile && (localProfile.gems ?? 0) > 0 && !gachaDrawing;

    const handleBuyExpDust = async () => {
        if (!buyExpDust) return;
        try {
            await buyExpDust(1); // Dust 1개 구매 (서비스 쪽에서 Gold 차감)
        } catch (e) {
            console.error("[QuizMonGame] buyExpDust error", e);
            let message = "Exp Dust를 구매하는 중 오류가 발생했습니다.";
            if (e instanceof Error && e.message) {
                message = e.message;
            }
            window.alert(message);
        }
    };

    // 🔹 배틀 타워 층 로딩
    const loadTowerFloors = async (profileId: string) => {
        try {
            // 1) 기본 층 정보 로딩
            const { data: floorRows, error: floorError } = await supabase
                .from("quizmon_battle_tower_floors")
                .select(
                    [
                        "id",
                        "floor",
                        "name",
                        "recommended_rating",
                    ].join(", "),
                )
                .order("floor", { ascending: true });
             
            if (floorError) {
                console.error(
                    "[BattleTower] load floors error",
                    floorError,
                );
                setTowerFloors([]);
                return;
            }
            
            type FloorRow = {
                id: string;
                floor: number;
                name: string | null;
                recommended_rating: number | null;
            };
            
            const rows = (floorRows ?? []) as unknown as FloorRow[];
            
            // 2) 진행도 (몇 층까지 깼는지) 로딩
            const { data: progressRow, error: progressError } = await supabase
                .from("quizmon_battle_tower_progress")
                .select("max_cleared_floor")
                .eq("profile_id", profileId)
                .maybeSingle();
                                
            if (progressError) {
                // 진행도는 없을 수도 있으니 warning 정도로만
                console.warn(
                    "[BattleTower] load progress error (fallback to 0)",
                    progressError,
                );
            }
            
            const maxClearedFloor =
                (progressRow as { max_cleared_floor: number } | null)
                    ?.max_cleared_floor ?? 0;

            // 3) UI용 TowerFloor 구조로 변환
            const floors: TowerFloor[] = rows.map((row) => {
                const dungeonId = row.id; // DUNGEON_CONFIGS.id 와 1:1 매핑

                const cleared = row.floor <= maxClearedFloor;
                const locked = row.floor > maxClearedFloor + 1;
                
                return {
                    id: dungeonId,
                    floor: row.floor,
                    name: row.name ?? undefined,
                    recommendedRating: row.recommended_rating ?? undefined,
                    cleared,
                    locked,
                    monsters: getTowerPreviewMonsters(dungeonId),
                };
            });
            
            setTowerFloors(floors);
        } catch (err) {
            console.error(
                "[BattleTower] unexpected error in loadTowerFloors",
                err,
            );
            setTowerFloors([]);
        }
    };

    // 🔹 배틀 타워: 전투 종료 시 클리어 층 진행도 갱신
    useEffect(() => {
                if (!profileId) return;
                if (!currentTowerFloorInfo) return;
                if (!battleFinished) return;
                if (hasReportedTowerClear) return;
        
                    const playerAllDead = state.player.monsters.every(
                        (m) => m.hp <= 0,
                    );
                const enemyAllDead = state.enemy.monsters.every(
                        (m) => m.hp <= 0,
                    );
        
                    // 플레이어는 살아 있고, 적 몬스터는 모두 쓰러진 경우만 "클리어"
                        if (playerAllDead || !enemyAllDead) {
                        return;
                    }
        
                    setHasReportedTowerClear(true);
                void updateTowerProgress(profileId, currentTowerFloorInfo.floor);
            }, [
                battleFinished,
                profileId,
                currentTowerFloorInfo,
                hasReportedTowerClear,
                state.player.monsters,
                state.enemy.monsters,
            ]);
    
    const [hpSynced, setHpSynced] = useState(false);

    const [, setLastDungeonScaledLevel] = useState<number | null>(null);

    
    // ✅ 현재 출전 중인 우리 편 / 적 포켓몬
    const activePlayerMon = state.player.monsters[state.player.activeIndex];
    const activeEnemyMon = state.enemy.monsters[state.enemy.activeIndex];

    // ✅ 각각의 종 ID (Monster에 speciesId 또는 species_id 가 있을 수 있으니 둘 다 대응)
    const playerSpeciesId =
        (activePlayerMon as any)?.speciesId ??
        (activePlayerMon as any)?.species_id ??
        PLAYER_SPECIES_ID;

    const enemySpeciesId =
        (activeEnemyMon as any)?.speciesId ??
        (activeEnemyMon as any)?.species_id ??
        PLAYER_SPECIES_ID;

    // 선택된 종 ID 기준으로 전투 스프라이트 경로 계산
    const playerBackJson = getMonsterAnimJson(playerSpeciesId, "back");
    const playerBackPng = getMonsterSprite(playerSpeciesId, "back");

    const enemyFrontJson = getMonsterAnimJson(enemySpeciesId, "front");
    const enemyFrontPng = getMonsterSprite(enemySpeciesId, "front");

    const [hasBattleInitialized, setHasBattleInitialized] = useState(false);
    const handleContinue = () => {
        // 이미 배틀 화면이면 아무 것도 안 함
        if (viewState === "battle") return;

        if (!hasBattleInitialized) {
            // 아직 한 번도 배틀을 시작한 적이 없으면
            // ⇒ 처음 한 번은 항상 "새 레이드 시작"처럼 동작
            handleReset();
        } else {
            // 이미 한 번이라도 배틀을 만든 상태면
            // ⇒ 단순히 배틀 화면으로 복귀
            setViewState("battle");
        }
    };

    // 상태 선언 근처에 한 줄 추가 (선택 사항, 가독성용)
    const canContinue = hasBattleInitialized;

    // 🔹 화면 너비에 따라 포켓몬 크기를 살짝 조정
    const baseWidth = 1280; // 기준 해상도
    const scaleFactorRaw = viewportWidth / baseWidth;
    const globalScale = Math.min(1.5, Math.max(0.8, scaleFactorRaw));
    
    const PLAYER_SCALE = 5.0 * globalScale; // 적보다 크게
    const ENEMY_SCALE = 2.5 * globalScale;
    
    // ✅ 플레이어: 백 스프라이트 애니메이션 (왼쪽 아래, 우리 편)
    const renderPlayerSprite = () =>
        playerBackJson && playerBackPng ? (
            <SpriteAnimation
                jsonUrl={playerBackJson}
                imageUrlOverride={playerBackPng}
                fps={12}
                frameFilter={(frame) => {
                    const n = parseInt(frame.filename.replace(".png", ""), 10);
                    return !Number.isNaN(n) && n >= 1 && n <= 20;
                }}
                style={{
                    transform: `scale(${PLAYER_SCALE})`,
                    transformOrigin: "bottom left",
                }}
            />
        ) : null;

    const renderEnemySprite = () =>
        enemyFrontJson && enemyFrontPng ? (
            <SpriteAnimation
                jsonUrl={enemyFrontJson}
                imageUrlOverride={enemyFrontPng}
                fps={12}
                frameFilter={(frame) => {
                    const n = parseInt(frame.filename.replace(".png", ""), 10);
                    return !Number.isNaN(n) && n >= 1 && n <= 20;
                }}
                style={{
                    transform: `scale(${ENEMY_SCALE})`,
                    transformOrigin: "bottom right",
                }}
            />
        ) : null;


    /**
     * profileId 기준으로 quizmon_owned_monsters(파티 1~3번)를 불러와
     * 실제 전투용 Monster 배열을 만들고, 그걸로 배틀 상태를 리셋한다.
     */
    const resetBattleWithProfileParty = async (
        profileId: string,
        modeOverride?: "raid" | "dungeon",
    ) => {
        try {
            // 이전 던전 스케일 정보는 초기화
            setLastDungeonScaledLevel(null);
            const effectiveMode = modeOverride ?? battleMode;  // ⭐ 이번 리셋에서 사용할 모드
            // 1) 파티 슬롯 1~3인 owned 몬스터 로딩
            const { data: ownedData, error: ownedError } = await supabase
                .from("quizmon_owned_monsters")
                .select(
                    [
                        "id",
                        "profile_id",
                        "species_id",
                        "level",
                        "exp",
                        "party_slot",
                        "current_hp",
                        "is_fainted",
                        "learned_moves",
                        "equipped_moves",      // ✅ 추가
                        "created_at",
                        "updated_at",
                    ].join(", "),
                )
                .eq("profile_id", profileId)
                .in("party_slot", [1, 2, 3])
                .order("party_slot", { ascending: true });

            if (ownedError) {
                console.error(
                    "[QuizMonGame] load owned_monsters error",
                    ownedError,
                );
                // 파티가 없을 때도 mock 상태
                setState(createInitialBattleState());
                setBattleStats({ correct: 0, total: 0 });
                setHasReportedEnd(false);
                setQuestionIndex(0);
                setViewState("battle");
                setHasBattleInitialized(true);
                return;
            }
            
            setHasReportedTowerClear(false);

            const ownedRows = (ownedData ?? []) as unknown as QuizmonOwnedMonsterRow[];

            if (!ownedRows.length) {
                console.warn(
                    "[QuizMonGame] no party monsters (slot 1~3) for profile",
                    profileId,
                );
                // 파티가 없으면 mock 상태로
                setState(createInitialBattleState());
                setBattleStats({ correct: 0, total: 0 });
                setHasReportedEnd(false);
                setQuestionIndex(0);
                setViewState("battle");
                setHasBattleInitialized(true);
                return;
            }

            // 🔹 1차 필터: 기절하지 않은 몬스터만 전투에 사용
            const aliveOwnedRows = ownedRows.filter((o) => !o.is_fainted);

            if (!aliveOwnedRows.length) {
                console.warn(
                    "[QuizMonGame] all party monsters are fainted for profile",
                    profileId,
                );
                // MVP에선 간단히 alert + 로비 복귀로 처리
                window.alert(
                    "모든 몬스터가 기절해서 레이드에 참가할 수 없습니다.\n메인 메뉴에서 회복한 뒤 다시 도전해 주세요!",
                );

                // 안전하게 상태 초기화 + 로비로 되돌리기
                setState(createInitialBattleState());
                setBattleStats({ correct: 0, total: 0 });
                setHasReportedEnd(false);
                setQuestionIndex(0);
                setViewState("lobby");
                setHasBattleInitialized(false);
                return;
            }

            // 2) 필요한 종 정보 모아서 quizmon_species 조회
            //    - 플레이어 파티 종
            //    - (던전 모드일 경우) 해당 던전 ENEMY_SETS에 쓰인 종

            // ✅ 이번 전투에서 실제로 사용할 "랜덤 선택된 적 슬롯"
            let chosenEnemySlots: EnemySlot[] = [];


            let raidBossSpeciesId: string | null = null;
            if (
                // 기존: battleMode === "raid"
                effectiveMode === "raid" &&
                activeRaidSession &&
                activeRaidSession.boss_species_id
            ) {
                raidBossSpeciesId = activeRaidSession.boss_species_id;
            }
            
            let enemySetSpeciesIds: string[] = [];

            if (effectiveMode === "dungeon") {
                const currentDungeon =
                    DUNGEON_CONFIGS.find((d) => d.id === selectedDungeonId) ?? null;

                if (currentDungeon?.enemySetId) {
                    const baseKey = currentDungeon.enemySetId;

                    // ENEMY_SETS 안에서 이 던전에 해당하는 후보 키들:
                    // - "forest-easy-1" (기본)
                    // - "forest-easy-1-A", "forest-easy-1-B" ... (있다면)
                    const allKeys = Object.keys(ENEMY_SETS);
                    const candidateKeys = allKeys.filter(
                        (key) => key === baseKey || key.startsWith(`${baseKey}-`),
                    );

                    const chosenKey =
                        candidateKeys.length > 0
                            ? candidateKeys[
                                Math.floor(Math.random() * candidateKeys.length)
                                ]
                            : baseKey;

                    const baseSlots = ENEMY_SETS[chosenKey] ?? [];

                    // 🔹 여기서는 enemyCount 는 "최대 몇 마리까지 쓰나"로만 사용하고,
                    //    species 로딩은 일단 전체 baseSlots 기준으로 해도 괜찮음.
                    chosenEnemySlots = baseSlots;

                    enemySetSpeciesIds = baseSlots.map((slot) => slot.speciesId);
                }
            }


            const speciesIds = Array.from(
                new Set(
                    [
                        ...ownedRows.map((o) => o.species_id),   // 내 파티 종
                        ...enemySetSpeciesIds,                   // 던전 적 종
                        ...(raidBossSpeciesId ? [raidBossSpeciesId] : []), // ✅ 레이드 보스 종
                    ].filter((id): id is string => !!id),
                ),
            );


            if (!speciesIds.length) {
                console.warn(
                    "[QuizMonGame] owned_monsters has no species_id",
                    ownedRows,
                );
                setState(createInitialBattleState());
                setBattleStats({ correct: 0, total: 0 });
                setHasReportedEnd(false);
                setQuestionIndex(0);
                setViewState("battle");
                return;
            }

            const { data: speciesData, error: speciesError } = await supabase
                .from("quizmon_species")
                .select(
                    "id, name, element, rarity, base_hp, base_atk, base_def, base_spd, pokedex_no, sprite_key, description",
                )
                .in("id", speciesIds);

            if (speciesError) {
                console.error(
                    "[QuizMonGame] load species error",
                    speciesError,
                );
                setState(createInitialBattleState());
                setBattleStats({ correct: 0, total: 0 });
                setHasReportedEnd(false);
                setQuestionIndex(0);
                setViewState("battle");
                return;
            }

            const speciesRows = (speciesData ?? []) as QuizmonSpeciesRow[];
            const speciesMap = new Map(
                speciesRows.map((s) => [s.id, s] as const),
            );

            // 3) battleFactory로 Monster 빌드
            const partyMonsters = aliveOwnedRows
                .map((owned): Monster | null => {
                    const species = speciesMap.get(owned.species_id);
                    if (!species) return null;

                    const base = buildBattleMonsterFromSpecies(species, owned);
                    if (!base) return null;

                    const anyOwned = owned as any;

                    // 1) equipped_moves 우선 사용
                    let moveList: Move[] = [];

                    if (Array.isArray(anyOwned.equipped_moves)) {
                        moveList = (anyOwned.equipped_moves as string[])
                            .map((id: string) => (MOVE_DB as any)[id])
                            .filter((m): m is Move => Boolean(m));
                    }

                    // 2) equipped_moves가 비어 있거나,
                    //    구버전 데이터만 있는 경우 → 레벨업 테이블 기반 기본 기술 사용
                    if (!moveList.length) {
                        moveList = getMovesForSpeciesAndLevel(
                            anyOwned.species_id,
                            anyOwned.level ?? 1,
                        );
                    }

                    // ✅ v1 특성: 종족 기반으로 abilityId 주입
                    const abilityId = getDefaultAbilityForSpecies(species);

                    return {
                        ...base,
                        moves: moveList,
                        abilityId,            // 🔹 여기 한 줄 추가
                    };
                })
                .filter((m): m is Monster => m !== null);


            if (!partyMonsters.length) {
                console.warn(
                    "[QuizMonGame] partyMonsters empty after build",
                    ownedRows,
                    speciesRows,
                );
                setState(createInitialBattleState());
                setBattleStats({ correct: 0, total: 0 });
                setHasReportedEnd(false);
                setQuestionIndex(0);
                setViewState("battle");
                return;
            }

            // 4) 기존 mock 기반 상태를 가져와서
            //    player + enemy를 모두 실제 데이터 기반으로 재구성
                
            // 현재 선택된 던전 정보
            const currentDungeon =
                DUNGEON_CONFIGS.find((d) => d.id === selectedDungeonId) ??
                DUNGEON_CONFIGS[0];

            // 🔹 ENEMY_SETS 기반 적 파티 생성 (던전 모드 전용)
            let enemyMonsters: Monster[] = [];

            if (effectiveMode === "dungeon" && currentDungeon?.enemySetId) {
                const baseSlots =
                    chosenEnemySlots.length > 0
                        ? chosenEnemySlots
                        : ENEMY_SETS[currentDungeon.enemySetId] ?? [];
                
                const maxEnemyCountFromConfig =
                    typeof currentDungeon.enemyCount === "number"
                        ? currentDungeon.enemyCount
                        : baseSlots.length;
                
                const levelOffset = currentDungeon.levelOffset ?? 0;
                const hpScale = currentDungeon.hpScale ?? 1;
                
                // 🔹 플레이어 파티 평균 레벨 (기절하지 않은 몬스터 기준)
                const partyAvgLevel =
                    aliveOwnedRows.length > 0
                        ? aliveOwnedRows.reduce(
                            (sum, o) => sum + (o.level ?? 1),
                        0,
                    ) / aliveOwnedRows.length
                        : 1;
                
                // 🔹 플레이어 파티 평균 파워 (종 스탯 + 레벨 기준)
                let partyPowerSum = 0;
                let partyPowerCount = 0;
                for (const owned of aliveOwnedRows) {
                    const sp = speciesMap.get(owned.species_id);
                    if (!sp) continue;
                    const lv = owned.level ?? 1;
                    partyPowerSum += calcSpeciesPower(sp, lv);
                    partyPowerCount += 1;
                }
                const partyPowerAvg =
                    partyPowerCount > 0 
                        ? partyPowerSum / partyPowerCount
                        // 혹시 몰라서 fallback 하나
                        : calcSpeciesPower(
                            speciesRows[0], 
                            partyAvgLevel,
                        );
                
                // 🔹 이 던전이 목표로 하는 "파티 대비 파워 비율"
                //    (DUNGEON_CONFIGS 에 powerRatio?: number 추가 필요)
                const powerRatio = currentDungeon.powerRatio ?? 1.0;
                const targetEnemyPowerPerMon = partyPowerAvg * powerRatio;
                
                // 🔹 이 던전의 권장 최소 레벨
                //    - 값이 있으면 "기본 적 레벨의 기준점"
                //    - 값이 없으면 null 로 두고, 순수히 파티 평균 기준으로만 스케일
                const recommendedMinLevel =
                    typeof currentDungeon.recommendedMinLevel === "number"
                        ? currentDungeon.recommendedMinLevel
                        : null;
                
                // 🔹 이번 던전에서 실제 사용된 적 레벨 평균 계산용
                let scaledLevelSum = 0;
                let scaledLevelCount = 0;
                
                const useCount = Math.max(
                    1,
                    Math.min(maxEnemyCountFromConfig, baseSlots.length),
                );
                const slots = baseSlots.slice(0, useCount);
                
                enemyMonsters = slots
                    .map((slot, index): Monster | null => {
                        const species = speciesMap.get(slot.speciesId);
                        if (!species) {
                            console.warn(
                                "[QuizMonGame] enemy species not found for slot",
                                slot,
                            );
                                                    return null;
                        }
                    
                        // ✅ (중요) 레벨 튜닝:
                        //  - recommendedMinLevel 이 있으면 slot.level 과의 차이만큼 반영
                        //  - 없으면 normalizedFromMin = 0 으로 보고,
                        //    순수히 파티 평균 + levelOffset 만 사용
                        const normalizedFromMin =
                            recommendedMinLevel != null
                                ? slot.level - recommendedMinLevel
                                : 0;
                    
                        // ✅ 파워 기준으로 "이 종이 어느 정도 레벨이면 적절한가?"
                        const statTotal =
                            (species.base_hp ?? 1) +
                            (species.base_atk ?? 1) +
                            (species.base_def ?? 1) +
                            (species.base_spd ?? 1);
                    
                        const levelFromPower =
                            statTotal > 0
                                ? targetEnemyPowerPerMon / statTotal
                                : partyAvgLevel;
                    
                        // 🔹 기존 레벨 스케일 + 파워 스케일을 50:50 로 섞기
                        let scaledLevel =
                            0.5 *
                            (partyAvgLevel +
                                normalizedFromMin +
                                levelOffset) +
                            0.5 * levelFromPower;
                    
                        // ✅ 하드 던전은 항상 "파티 평균 + 1 레벨 이상" 유지
                        if (currentDungeon.difficulty === "hard") {
                            const minHard = partyAvgLevel + 1;
                            if (scaledLevel < minHard) {
                                scaledLevel = minHard;
                            }
                        }
                    
                        const level = Math.max(1, Math.round(scaledLevel));
                    
                        // 이번 던전 적 레벨 평균 계산용 누적
                        scaledLevelSum += level;
                        scaledLevelCount += 1;
                    
                        const tempOwned: QuizmonOwnedMonsterRow = {
                            id: `enemy-${currentDungeon.id}-${index}`,
                            profile_id: "dungeon-enemy",
                            species_id: species.id,
                            level,
                            exp: 0,
                            party_slot: null,
                            current_hp: null,
                            is_fainted: false,
                            learned_moves: [],
                            equipped_moves: [],
                            ability_id: null,
                            created_at: new Date().toISOString() as any,
                            updated_at: new Date().toISOString() as any,
                        };
                    
                        const base = buildBattleMonsterFromSpecies(
                            species,
                            tempOwned,
                        );
                        if (!base) return null;
                    
                        const scaledMaxHp =
                            hpScale !== 1
                                ? Math.max(1, Math.floor(base.maxHp * hpScale))
                                : base.maxHp;
                        return {
                            ...base,
                            id: tempOwned.id,
                            level,
                            hp: scaledMaxHp,
                            maxHp: scaledMaxHp,
                        };
                    })
                    .filter((m): m is Monster => m !== null);
                
                // 🔹 최종적으로 이번 던전에서 사용된 적들의 평균 레벨을 기록
                if (scaledLevelCount > 0) {
                    setLastDungeonScaledLevel(
                        scaledLevelSum / scaledLevelCount,
                    );
                } else {
                    setLastDungeonScaledLevel(null);
                }
            }

            // 🔹 레이드 모드: 현재 열린 레이드 보스를 단일 적 몬스터로 생성
            if (
                effectiveMode === "raid" &&
                activeRaidSession &&
                activeRaidSession.boss_species_id
            ) {
                const bossSpecies = speciesMap.get(activeRaidSession.boss_species_id);
                if (!bossSpecies) {
                    console.warn(
                        "[QuizMonGame] raid boss species not found",
                        activeRaidSession.boss_species_id,
                    );
                } else {
                    const level = activeRaidSession.boss_level ?? 50;

                    const tempOwned: QuizmonOwnedMonsterRow = {
                        id: `raid-boss-${activeRaidSession.id ?? bossSpecies.id}`,
                        profile_id: "raid-boss",
                        species_id: bossSpecies.id,
                        level,
                        exp: 0,
                        party_slot: null,
                        current_hp: null,
                        is_fainted: false,
                        learned_moves: [],
                        equipped_moves: [],
                        ability_id: null,
                        created_at: new Date().toISOString() as any,
                        updated_at: new Date().toISOString() as any,
                    };

                    const base = buildBattleMonsterFromSpecies(bossSpecies, tempOwned);
                    if (base) {
                        // 레벨 기반 기술 / 기본 특성 주입
                        let moveList = getMovesForSpeciesAndLevel(bossSpecies.id, level);
                        const abilityId = getDefaultAbilityForSpecies(bossSpecies);

                        enemyMonsters = [
                            {
                                ...base,
                                id: tempOwned.id,
                                moves: moveList,
                                abilityId,
                            },
                        ];
                    }
                }
            }
            

            // 🔁 ENEMY_SETS에 유효한 적이 하나도 없으면 기존 거울 복사 방식으로 fallback
            if (!enemyMonsters.length) {
                // 난이도별 HP 배수 (대략적인 값, 나중에 조정 가능)
                let hpMultiplier = 1.5;
                if (currentDungeon?.difficulty === "normal")
                    hpMultiplier = 2.0;
                if (currentDungeon?.difficulty === "hard") hpMultiplier = 3.0;
                
                // 플레이어 파티를 기준으로 "테스트용 적 파티" 생성
                enemyMonsters = partyMonsters.map((mon, index) => {
                    const maxHp = Math.max(
                        1,
                        Math.floor(mon.maxHp * hpMultiplier),
                    );
                    
                    return {
                        ...mon,
                        id: `enemy-${index}-${mon.speciesId ?? mon.id}`,
                        name: mon.name,
                        hp: maxHp,
                        maxHp,
                    };
                });
            }

            const base = createInitialBattleState();

            const newState: BattleState = {
                ...base,
                player: {
                    ...base.player,
                    monsters: partyMonsters,
                    activeIndex: 0,
                },
                enemy: {
                    ...base.enemy,
                    monsters: enemyMonsters.length
                        ? enemyMonsters
                        : base.enemy.monsters, // 혹시라도 비어 있으면 기존 mock 유지
                    activeIndex: 0,
                },
                phase: "command",
                turn: 1,
                pendingPlayerMove: null,
                pendingEnemyMove: null,
                currentQuestion: null,
                questionStartedAt: null,
                lastQuizResult: null,
                logs: [],
            };

            setState(newState);
            setBattleStats({ correct: 0, total: 0 });
            setHasReportedEnd(false);
            setQuestionIndex(0);
            setViewState("battle");
            setHasBattleInitialized(true);
        } catch (err) {
            console.error(
                "[QuizMonGame] resetBattleWithProfileParty unexpected error",
                err,
            );
            setState(createInitialBattleState());
            setBattleStats({ correct: 0, total: 0 });
            setHasReportedEnd(false);
            setQuestionIndex(0);
            setViewState("battle");
        }
    };

    type ArenaOpponentRow = {
        profile_id: string;
        defense_slot1_owned_id: string | null;
        defense_slot2_owned_id: string | null;
        defense_slot3_owned_id: string | null;
    };

    const resetBattleWithArenaOpponent = async (
        myProfileId: string,
        arenaRow: ArenaOpponentRow,
    ) => {
        try {
            // 1) 내 파티 기준으로 기본 배틀 상태 초기화 (던전 모드로)
            await resetBattleWithProfileParty(myProfileId, "dungeon");

            // 2) 방어 파티에 등록된 owned_monster.id 목록
            const enemyOwnedIds = [
                arenaRow.defense_slot1_owned_id,
                arenaRow.defense_slot2_owned_id,
                arenaRow.defense_slot3_owned_id,
            ].filter((id): id is string => !!id);

            if (!enemyOwnedIds.length) {
                alert("상대의 아레나 방어 파티가 비어 있습니다.");
                return;
            }

            // 3) 해당 owned_monsters 정보 로드
            const { data: owned, error: ownedError } = await supabase
                .from("quizmon_owned_monsters")
                .select(
                    [
                        "id",
                        "profile_id",
                        "species_id",
                        "level",
                        "exp",
                        "party_slot",
                        "current_hp",
                        "is_fainted",
                        "learned_moves",
                        "equipped_moves",
                        "created_at",
                        "updated_at",
                    ].join(", "),
                )
                .in("id", enemyOwnedIds);

            if (ownedError) {
                console.error("[Arena] load enemy mons error", ownedError);
                alert("상대 아레나 파티 정보를 불러오는 중 오류가 발생했습니다.");
                return;
            }

            // 등록된 id 순서를 유지하기 위해 order 맵 구성
            const idOrder = new Map(
                enemyOwnedIds.map((id, idx) => [id, idx] as const),
            );

            // ✅ Supabase 결과를 명시적으로 캐스팅
            const ownedRows = (owned ?? []) as unknown as QuizmonOwnedMonsterRow[];
            const aliveRows = ownedRows
                .filter((m) => !m.is_fainted)
                .sort(
                    (a, b) =>
                        (idOrder.get(a.id) ?? 99) - (idOrder.get(b.id) ?? 99),
                );

            if (!aliveRows.length) {
                alert("상대 아레나 파티에 사용할 수 있는 몬스터가 없습니다.");
                return;
            }

            // 4) 종 데이터 로드
            const speciesIds = Array.from(
                new Set(aliveRows.map((m) => m.species_id).filter(Boolean)),
            );

            const { data: speciesData, error: speciesError } = await supabase
                .from("quizmon_species")
                .select(
                    "id, name, element, rarity, base_hp, base_atk, base_def, base_spd, pokedex_no, sprite_key, description",
                )
                .in("id", speciesIds);

            if (speciesError) {
                console.error("[Arena] load species error", speciesError);
                alert("상대 몬스터 종 정보를 불러오는 중 오류가 발생했습니다.");
                return;
            }

            const speciesRows = (speciesData ?? []) as QuizmonSpeciesRow[];
            const speciesMap = new Map(
                speciesRows.map((s) => [s.id, s] as const),
            );

            // 5) enemy 몬스터를 배틀용 Monster로 변환
            const enemyMonsters: Monster[] = aliveRows
                .map((owned, index): Monster | null => {
                    const species = speciesMap.get(owned.species_id);
                    if (!species) return null;

                    const base = buildBattleMonsterFromSpecies(species, owned);
                    if (!base) return null;

                    const anyOwned = owned as any;

                    let moveList: Move[] = [];

                    // equipped_moves 우선
                    if (
                        Array.isArray(anyOwned.equipped_moves) &&
                        anyOwned.equipped_moves.length > 0
                    ) {
                        moveList = (anyOwned.equipped_moves as string[])
                            .map((id: string) => (MOVE_DB as any)[id])
                            .filter(
                                (m: Move | undefined): m is Move => Boolean(m),
                            );
                    }

                    // 없으면 레벨업 테이블 기반 기술
                    if (!moveList.length) {
                        moveList = getMovesForSpeciesAndLevel(
                            owned.species_id,
                            owned.level ?? 1,
                        );
                    }

                    const abilityId = getDefaultAbilityForSpecies(species);

                    return {
                        ...base,
                        id: `arena-${owned.id}-${index}`,
                        moves: moveList,
                        abilityId,
                    };
                })
                .filter((m): m is Monster => m !== null);

            if (!enemyMonsters.length) {
                console.warn(
                    "[Arena] enemyMonsters empty for arena opponent",
                    aliveRows,
                );
                alert("상대 아레나 파티를 배틀용으로 구성하지 못했습니다.");
                return;
            }

            // 6) 기존 상태 위에 enemy 파티만 덮어쓰기
            setState((prev) => ({
                ...prev,
                enemy: {
                    ...prev.enemy,
                    monsters: enemyMonsters,
                    activeIndex: 0,
                },
                phase: "command",
                turn: 1,
                logs: [],
                lastQuizResult: null,
            }));
        } catch (err) {
            console.error(
                "[Arena] resetBattleWithArenaOpponent unexpected error",
                err,
            );
            alert("아레나 배틀 준비 중 오류가 발생했습니다.");
        }
    };

    // 🔹 배틀 타워 층 클리어 후 진행도 갱신
    const updateTowerProgress = async (
        profileId: string,
        clearedFloor: number,
    ) => {
        try {
            // 현재 저장된 최고 층수 조회
            const { data, error } = await supabase
                            .from("quizmon_battle_tower_progress")
                            .select("max_cleared_floor")
                            .eq("profile_id", profileId)
                            .maybeSingle();
            
            if (error) {
                console.error(
                    "[QuizMonGame] load tower progress error",
                    error,
                );
                return;
            }
            
            const prevMax = data?.max_cleared_floor ?? 0;
            if (clearedFloor <= prevMax) {
                // 더 낮은 층을 다시 깨도 갱신하지 않음
                return;
            }
            
            const { error: upsertError } = await supabase
                .from("quizmon_battle_tower_progress")
                .upsert(
                    {
                        profile_id: profileId,
                                        max_cleared_floor: clearedFloor,
                                        last_cleared_at: new Date().toISOString(),
                                    },
                                { onConflict: "profile_id" },
                                );
            
                            if (upsertError) {
                                console.error(
                                    "[QuizMonGame] update tower progress upsert error",
                                        upsertError,
                                    );
                            }
                    } catch (err) {
                        console.error(
                                "[QuizMonGame] updateTowerProgress unexpected error",
                                err,
                            );
                    }
            };

    // 파티 3슬롯 구성이 변경되었을 때 DB에 반영 + 컬렉션 refresh
    const handleSaveParty = async (partyIds: (string | null)[]) => {
        if (!props.profileId) {
            console.warn(
                "[QuizMonGame] handleSaveParty called without profileId",
            );
            return;
        }

        try {
            // 1) 기존 파티 슬롯 비우기
            const { error: clearError } = await supabase
                .from("quizmon_owned_monsters")
                .update({ party_slot: null })
                .eq("profile_id", props.profileId);

            if (clearError) {
                console.error(
                    "[QuizMonGame] clear party_slot error",
                    clearError,
                );
                return;
            }

            // 2) 새 파티 구성 반영
            const updates = partyIds
                .map((id, index) => ({ id, slot: index + 1 }))
                .filter((x) => x.id) as { id: string; slot: number }[];

            for (const u of updates) {
                const { error } = await supabase
                    .from("quizmon_owned_monsters")
                    .update({ party_slot: u.slot })
                    .eq("id", u.id);

                if (error) {
                    console.error(
                        "[QuizMonGame] update party_slot error",
                        error,
                        u,
                    );
                }
            }

            // 3) 컬렉션 재로딩
            if (props.onRefreshCollection) {
                await props.onRefreshCollection();
            }

            // 4) ✅ 파티가 바뀌면 진행 중이던 던전/배틀은 무효 처리
            setState(createInitialBattleState());
            setBattleStats({ correct: 0, total: 0 });
            setHasReportedEnd(false);
            setQuestionIndex(0);
            setHasBattleInitialized(false);
            // viewState는 원래대로 lobby 상태일 것이므로 굳이 안 바꿔도 됨
            // setViewState("lobby");
        } catch (err) {
            console.error("[QuizMonGame] handleSaveParty exception", err);
        }
    };

    const startArenaBattleWithRandomOpponent = async () => {
        const myProfileId = props.profileId;
        if (!myProfileId) {
            alert("로그인된 트레이너 프로필이 있어야 아레나 배틀을 할 수 있어요.");
            return;
        }

        // 아레나 배틀은 타워 진행도와 무관하므로 타워 상태 초기화
        setCurrentTowerFloorInfo(null);
        setHasReportedTowerClear(false);

        try {
            // 1) 방어 파티가 등록된 다른 유저들의 아레나 프로필 조회
            const { data, error } = await supabase
                .from("quizmon_arena_profiles")
                .select(
                    [
                        "profile_id",
                        "defense_slot1_owned_id",
                        "defense_slot2_owned_id",
                        "defense_slot3_owned_id",
                        "rating",
                        "updated_at",
                    ].join(", "),
                )
                .neq("profile_id", myProfileId)
                .not("defense_slot1_owned_id", "is", null)
                .order("updated_at", { ascending: false })
                .limit(30);

            if (error) {
                console.error("[Arena] load opponents error", error);
                alert("아레나 상대 정보를 불러오는 중 오류가 발생했습니다.");
                return;
            }

            // ✅ Supabase 결과를 명시적으로 ArenaOpponentRow[] 로 캐스팅
            const rows = (data ?? []) as unknown as ArenaOpponentRow[];
            
            const candidates = rows.filter(
                (row) =>
                    row.defense_slot1_owned_id ||
                    row.defense_slot2_owned_id ||
                    row.defense_slot3_owned_id,
            );

            if (candidates.length === 0) {
                alert("등록된 아레나 방어 파티가 아직 없습니다.\n친구들이 파티를 등록하면 도전할 수 있어요!");
                return;
            }

            // 2) 일단은 단순 랜덤 매칭 (나중에 rating 기반 매칭으로 확장 가능)
            const opponent =
                candidates[Math.floor(Math.random() * candidates.length)];

            await resetBattleWithArenaOpponent(myProfileId, opponent);
            setBattleMode("dungeon");
            setViewState("battle");

            // 필요하면 gameSessions 로그도 남길 수 있음 (기존 고스트 배틀 로그 참고)
        } catch (err) {
            console.error("[Arena] unexpected error", err);
            alert("아레나 배틀 시작 중 예기치 못한 오류가 발생했습니다.");
        }
    };

    // ✅ 특정 아레나 상대와 전투 시작 (추천 상대 카드 클릭용)
    // ✅ 아레나 탭에서 선택한 상대와 전투 시작
    const startArenaBattleWithOpponent = async (opponent: ArenaOpponent) => {
        const myProfileId = props.profileId;
        if (!myProfileId) {
            alert("로그인된 트레이너 프로필이 있어야 아레나 배틀을 할 수 있어요.");
            return;
        }

        setCurrentTowerFloorInfo(null);
        setHasReportedTowerClear(false);

        try {
            // 1) 상대의 아레나 프로필에서 방어 파티 owned_id 들 가져오기
            const { data, error } = await supabase
                .from("quizmon_arena_profiles")
                .select(
                    [
                        "profile_id",
                        "defense_slot1_owned_id",
                        "defense_slot2_owned_id",
                        "defense_slot3_owned_id",
                    ].join(", "),
                )
                .eq("profile_id", opponent.id)
                .maybeSingle();
            
                type ArenaOpponentRowLite = {
                    profile_id: string;
                    defense_slot1_owned_id: string | null;
                    defense_slot2_owned_id: string | null;
                    defense_slot3_owned_id: string | null;
                };
                const row = (data ?? null) as ArenaOpponentRowLite | null;
                
                if (error || !row) {
                    console.error("[Arena] load single opponent error", error, row);            
                    alert("상대의 아레나 파티 정보를 불러오지 못했어요.");
                return;
                }
                

                await resetBattleWithArenaOpponent(myProfileId, {
                    profile_id: row.profile_id,
                    defense_slot1_owned_id: row.defense_slot1_owned_id,
                    defense_slot2_owned_id: row.defense_slot2_owned_id,
                    defense_slot3_owned_id: row.defense_slot3_owned_id,
                });

                setBattleMode("dungeon"); // UI는 던전 스타일 재사용
                setViewState("battle");

            } catch (err) {
                console.error("[Arena] startArenaBattleWithOpponent error", err);
                alert("아레나 배틀 준비 중 오류가 발생했습니다.");
            }
        };

    // ✅ 배틀 타워 층 전투 시작
    const startBattleTowerFloor = async (floor: TowerFloor) => {
        const myProfileId = props.profileId;
        if (!myProfileId) {
            alert(
                "로그인된 트레이너 프로필이 있어야 배틀 타워에 도전할 수 있어요.",
            );
            return;
        }
        
        if (floor.locked) {
            alert(
                "아직 잠금된 층입니다.\n바로 아래 층부터 차례대로 클리어해 주세요!",
            );
            return;
        }
        
        // TowerFloor.id 를 DUNGEON_CONFIGS 의 id 와 1:1로 사용
        const dungeonId = floor.id;
        const dungeon = DUNGEON_CONFIGS.find((d) => d.id === dungeonId);
        if (!dungeon) {
            console.error(
                "[BattleTower] unknown dungeon id for floor",
                floor,
            );
            alert(
                "이 배틀 타워 층의 던전 설정을 찾을 수 없어요.\n선생님께 알려 주세요.",
            );
            return;
        }
        setCurrentTowerFloorInfo({
                id: floor.id,
                floor: floor.floor,
        });
        setHasReportedTowerClear(false);
        
        setSelectedDungeonId(dungeonId);
        setBattleMode("dungeon");
        handleReset("dungeon");
        setViewState("battle");
    };

    // 🔹 프로필 변경 시 배틀 타워 층 정보 동기화
    useEffect(() => {
        if (!profileId) {
            setTowerFloors([]);
            return;
        }
        void loadTowerFloors(profileId);
        }, [profileId]);
    
    // 🔹 현재 세션에 열린 레이드가 있는지 확인
    useEffect(() => {
        if (!props.roomId || !props.gameSessionId) {
            setActiveRaidSession(null);
            return;
        }

        let cancelled = false;

        const syncRaidSession = async () => {
            try {
                setRaidSessionLoading(true);
                const raid = await getActiveRaidSession({
                    roomId: props.roomId!,
                    gameSessionId: props.gameSessionId!,
                });
                if (!cancelled) {
                    setActiveRaidSession(raid);
                }
            } catch (e) {
                console.error(
                    "[QuizMonGame] syncRaidSession error",
                    e,
                );
            } finally {
                if (!cancelled) {
                    setRaidSessionLoading(false);
                }
            }
        };

        void syncRaidSession();

        return () => {
            cancelled = true;
        };
    }, [props.roomId, props.gameSessionId]);

    const hasActiveRaid =
        !!activeRaidSession && activeRaidSession.status === "open";


    // 배틀 종료 시 → viewState 를 result 로 전환 + HP DB 저장 + 컬렉션 refresh
    useEffect(() => {
        // 배틀이 안 끝났으면 플래그만 리셋하고 종료
        if (state.phase !== "finished") {
            if (hpSynced) setHpSynced(false);
            return;
        }

        // ✅ 이미 한 번 결과/HP 처리를 했으면 더 이상 결과 화면을 다시 띄우지 않음
        if (hpSynced) return;

        // ✅ 이 시점에만 결과 오버레이 켜기
        setViewState("result");

        // 프로필 정보 없으면 HP 저장 스킵
        if (!props.profileId) return;

        // 🔹 현재 플레이어 몬스터들의 전투 종료 HP 스냅샷
        const snapshot = state.player.monsters.map((m) => ({
            id: m.id,
            profile_id: props.profileId,
            current_hp: Math.max(0, Math.min(m.maxHp, m.hp)),
            is_fainted: m.hp <= 0,
            updated_at: new Date().toISOString(),
        }));

        void (async () => {
            if (!snapshot.length) return;

            try {
                for (const row of snapshot) {
                    const { error } = await supabase
                        .from("quizmon_owned_monsters")
                        .update({
                            current_hp: row.current_hp,
                            is_fainted: row.is_fainted,
                            updated_at: row.updated_at,
                        })
                        .eq("id", row.id)
                        .eq("profile_id", row.profile_id);

                    if (error) {
                        console.error("[QuizMonGame] HP sync error", error, row);
                    }
                }

                if (props.onRefreshCollection) {
                    try {
                        await props.onRefreshCollection();
                    } catch (refreshError) {
                        console.error(
                            "[QuizMonGame] onRefreshCollection error",
                            refreshError,
                        );
                    }
                }

                setHpSynced(true);
            } catch (e) {
                console.error("[QuizMonGame] HP sync unexpected error", e);
            }
        })();
    }, [
        state.phase,
        state.player.monsters,
        hpSynced,
        props.profileId,
        props.onRefreshCollection,
    ]);

    const handleReset = (modeOverride?: "raid" | "dungeon") => {
        // 🔹 새 레이드마다 문제 순서도 다시 셔플
        if (questions.length > 0) {
            const indices = questions.map((_, idx) => idx);
            setQuestionOrder(shuffleArray(indices));
            setQuestionIndex(0);
        } else {
            setQuestionOrder([]);
            setQuestionIndex(0);
        }

        if (profileId) {
            // 학생 프로필이 있으면 항상 "실제 파티" 기준으로 리셋
            void resetBattleWithProfileParty(profileId, modeOverride);
        } else {
            // fallback: mock 상태로 리셋
            setState(createInitialBattleState());
            setBattleStats({ correct: 0, total: 0 });
            setHasReportedEnd(false);
            setQuestionIndex(0);
            setViewState("battle");
            setHasBattleInitialized(true);
        }
    };

    const showResultOverlay =
        viewState === "result" || (battleFinished && viewState === "battle");

    // 🔹 현재 선택된 던전 객체
    const selectedDungeon =
        DUNGEON_CONFIGS.find((d) => d.id === selectedDungeonId) ??
        DUNGEON_CONFIGS[0];

    const battleBgUrl = getArenaSprite(selectedDungeon.arenaKey ?? "forest_bg");
    
    // 🔹 선택된 던전에 대해서도 focusStat 기반 동적 난이도/보상 계산
    const summaryFocusValue = getPartyFocusStatValueForDungeon(
        selectedDungeon.id,
    );
    const summaryDyn = evaluateDungeonForFocusStat(
        selectedDungeon,
        summaryFocusValue,
    );
    
    let resultMessage = "접전 끝에 무승부!";
    if (playerMon.hp > 0 && enemyMon.hp <= 0) {
        resultMessage = `신난다! ${enemyMon.name}를 잡았다!`;
    } else if (playerMon.hp <= 0 && enemyMon.hp > 0) {
        resultMessage = "아쉽다… 패배했다!";
    }


    return (
        <div
            ref={rootRef}
            style={{
                // 전체 화면에서는 세로 패딩 조금 줄이기
                padding: isFullscreen ? "0.75rem 1.5rem 1rem" : "1.5rem",
                width: "100%",
                maxWidth: "100%",
                margin: "0 auto",
                color: "#e5e7eb",
                // 전체화면일 땐 세로도 꽉 채우되, 아래가 잘리지 않게 스크롤 허용
                ...(isFullscreen
                    ? {
                        height: "100vh",
                        boxSizing: "border-box",
                        overflowX: "hidden",
                        overflowY: "auto",
                    }
                    : {}),
            }}
        >
        <div
                style={{
                            display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: 8,
                            }}
                >
                    <div>
                            <h1 style={{ marginBottom: "0.25rem" }}>
                                QuizMon Class – Battle Core
                            </h1>
                            <p
                                style={{
                                    fontSize: 13,
                                    color: "#9ca3af",
                                    marginTop: 0,
                                }}
                            >
                                quizpackJson 기반 전투 코어 + 포켓로그풍 배틀 UI 테스트
                                버전입니다.
                            </p>
                    </div>
    
                        {fullscreenSupported && (
                            <button
                        type="button"
                            onClick={isFullscreen ? exitFullscreen : enterFullscreen}
                            style={{
                                    padding: "0.25rem 0.7rem",
                                        borderRadius: 999,
                                        border: "1px solid #4b5563",
                                        background: "#020617",
                                        color: "#e5e7eb",
                                        fontSize: 12,
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                    }}
                        >
                            {isFullscreen ? "전체화면 종료" : "전체 화면"}
                        </button>
                    )}
                </div>

            {localProfile && (
                <div
                    style={{
                        marginTop: "0.5rem",
                        display: "flex",
                        gap: 8,
                        fontSize: 12,
                    }}
                >
                    {/* Gold → coins */}
                    <div
                        style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            border: "1px solid #1f2937",
                            background: "rgba(15,23,42,0.9)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                        }}
                    >
                        <span style={{ marginRight: 2 }}>💰</span>
                        <span style={{ color: "#9ca3af", marginRight: 4 }}>Gold</span>
                        <span style={{ color: "#facc15", fontWeight: 600 }}>
                {localProfile.gold ?? 0}
            </span>
                    </div>

                    {/* Gems → gems */}
                    <div
                        style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            border: "1px solid #1f2937",
                            background: "rgba(15,23,42,0.9)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                        }}
                    >
                        <span style={{ marginRight: 2 }}>💎</span>
                        <span style={{ color: "#9ca3af", marginRight: 4 }}>Gems</span>
                        <span style={{ color: "#a5b4fc", fontWeight: 600 }}>
                {localProfile.gems ?? 0}
            </span>
                    </div>

                    {/* Shards → star_shards (이미 맞게 쓰고 있던 부분) */}
                    <div
                        style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            border: "1px solid #1f2937",
                            background: "rgba(15,23,42,0.9)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                        }}
                    >
                        <span style={{ marginRight: 2 }}>⭐</span>
                        <span style={{ color: "#9ca3af", marginRight: 4 }}>Shards</span>
                        <span style={{ color: "#fed7aa", fontWeight: 600 }}>
                {localProfile.star_shards ?? 0}
            </span>
                    </div>
                </div>
            )}


            <div
                style={{
                    marginTop: isFullscreen ? "0.5rem" : "1rem",
                    borderRadius: 12,
                    border: "1px solid #0f172a",
                    background: "#020617",
                    padding: "0.75rem",
                    width: "100%",
                }}
            >


            {/* 🔹 배틀 필드 전체 (BG + 포켓몬 + HUD + 명령창) */}
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        borderRadius: 8,
                        overflow: "hidden",
                        backgroundColor: "#000",
                        // 브라우저 폭에 따라 자동 비율 유지 (16:9 정도)
                        aspectRatio: "16 / 9",
                    }}
                >
                    {/* BG 는 항상 보여주기 */}
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            backgroundImage: `url(${battleBgUrl})`,
                            backgroundRepeat: "no-repeat",
                            backgroundSize: "cover",
                            backgroundPosition: "center bottom",
                            imageRendering: "pixelated",
                        }}
                    />

                    {/* 🐾 배틀 레이어: battle 상태에서만 포켓몬/HP/명령창 표시 */}
                    {viewState === "battle" && (
                        <QuizMonBattleView
                            state={state}
                            questions={questions}
                            playerMon={playerMon}
                            enemyMon={enemyMon}
                            canSelectMove={canSelectMove}
                            onSelectMove={handleSelectMove}
                            onAnswer={handleAnswer}
                            onRequestSwitch={handleSwitch}
                            playerSprite={renderPlayerSprite()}
                            enemySprite={renderEnemySprite()}
                            damagePopups={damagePopups}
                            canCapture={canCapture}
                            onRequestCapture={onRequestCapture}
                            captureUi={captureUi}
                            captureHandlers={captureHandlers}
                        />
                    )}

                    {viewState === "lobby" && (
                        <QuizMonLobbyOverlay
                            menuTab={menuTab}
                            onMenuTabChange={(tab) => setMenuTab(tab)}
                            localProfile={localProfile}
                            profile={props.profile ?? null}
                            monsters={props.monsters}
                            collectionLoading={props.collectionLoading}
                            collectionError={props.collectionError}
                            onHealAll={handleHealAll}
                            onHealSelected={handleHealSelected}
                            onSaveParty={handleSaveParty}
                            canContinue={canContinue}
                            towerFloors={towerFloorsForUi}
                            onContinue={handleContinue}
                            // 🔹 던전: 던전 선택 오버레이 열기
                            onSelectDungeon={() => {
                                // 일반 던전 진입 시에는 타워 층 정보 초기화
                                setCurrentTowerFloorInfo(null);
                                setHasReportedTowerClear(false);
                                setBattleMode("dungeon");
                                setViewState("dungeon");
                            }}
                            // 🔹 레이드: 현재 열린 레이드가 있을 때만 진입
                            onSelectRaid={() => {
                                if (!hasActiveRaid) {
                                    alert(
                                        "현재 진행 중인 레이드가 없습니다.\n선생님이 레이드를 시작하면 참여할 수 있어요.",
                                    );
                                    return;
                                }
                                setBattleMode("raid");
                                // 레이드는 타워 진행도와 무관하므로 타워 상태 초기화
                                setCurrentTowerFloorInfo(null);
                                setHasReportedTowerClear(false);
                                handleReset("raid");   // ⭐ 이번 리셋은 "레이드" 모드
                            }}

                            onSelectGacha={() => setViewState("gacha")}

                            // 🔹 추가: 아레나 / 타워 전투 시작 콜백
                            onStartArenaBattle={(opponent) => {
                                void startArenaBattleWithOpponent(opponent);
                            }}
                            onStartBattleTower={(floor) => {
                                void startBattleTowerFloor(floor);
                            }}
                            onSelectGhostBattle={() => {
                                void startArenaBattleWithRandomOpponent();
                            }}
                            lastRaidResult={props.lastRaidResult ?? null}
                            onBuyExpDust={handleBuyExpDust}
                        />
                    )}

                    {props.roomId && props.gameSessionId && (
                        <p style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                            {raidSessionLoading
                                ? "레이드 상태를 확인하는 중..."
                                : hasActiveRaid
                                    ? "레이드가 열려 있습니다! 레이드 버튼으로 참여해 보세요."
                                    : "현재 레이드는 열려 있지 않습니다."}
                        </p>
                    )}

                    {/* 🏰 던전 선택 오버레이 */}
                    {viewState === "dungeon" && (
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "1rem",
                                background: "rgba(0,0,0,0.6)",
                                pointerEvents: "none",
                            }}
                        >
                            <div
                                style={{
                                    width: 320,
                                    borderRadius: 12,
                                    background: "rgba(15,23,42,0.98)",
                                    border: "2px solid #111827",
                                    padding: "1rem 1.2rem",
                                    boxShadow: "0 24px 40px rgba(0,0,0,0.8)",
                                    pointerEvents: "auto",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "#9ca3af",
                                        marginBottom: 4,
                                    }}
                                >
                                    Raid Dungeon · Beta
                                </div>
                                <div
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 700,
                                        marginBottom: 8,
                                    }}
                                >
                                    던전 선택
                                </div>

                                {/* 🔹 DUNGEON_CONFIGS 기반 던전 리스트 */}
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 8,
                                        marginBottom: 8,
                                    }}
                                >
                                    {DUNGEON_CONFIGS.map((dungeon) => {
                                        const isSelected = dungeon.id === selectedDungeonId;

                                        // 1) 파티 기준 focusStat 값 계산
                                        const focusValue = getPartyFocusStatValueForDungeon(dungeon.id);

                                        // 2) focusStat 비율을 반영해 난이도/보상 계산
                                        const dyn = evaluateDungeonForFocusStat(dungeon, focusValue);

                                        // 3) 라벨 (레벨 / HP / 공격 / 방어 / 스피드)
                                        const focusLabel = FOCUS_STAT_LABEL[dungeon.focusStat];

                                        return (
                                            <button
                                                key={dungeon.id}
                                                type="button"
                                                onClick={() => setSelectedDungeonId(dungeon.id)}
                                                style={{
                                                    width: "100%",
                                                    textAlign: "left",
                                                    borderRadius: 8,
                                                    border: `1px solid ${isSelected ? "#f97316" : "#1f2937"}`,
                                                    background: isSelected
                                                        ? "linear-gradient(135deg, rgba(30,64,175,0.9), rgba(234,88,12,0.9))"
                                                        : "#020617",
                                                    padding: "0.55rem 0.7rem",
                                                    fontSize: 13,
                                                    cursor: "pointer",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "center",
                                                        marginBottom: 2,
                                                    }}
                                                >
                                                    <span style={{ fontWeight: 600 }}>{dungeon.name}</span>
                                                    <span
                                                        style={{
                                                            fontSize: 11,
                                                            padding: "0 0.45rem",
                                                            borderRadius: 999,
                                                            border: "1px solid #4b5563",
                                                            color: "#e5e7eb",
                                                        }}
                                                    >
                    {/* ✅ focusStat 비율을 반영한 난이도 */}
                                                        {dyn.difficultyLabel}
                </span>
                                                </div>

                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        color: "#9ca3af",
                                                    }}
                                                >
                                                    {dungeon.description}
                                                </div>

                                                <div
                                                    style={{
                                                        marginTop: 4,
                                                        fontSize: 11,
                                                        color: "#9ca3af",
                                                    }}
                                                >
                                                    {/* ✅ focusStat 기준 추천 범위 & 보상 배수 */}
                                                    추천 {focusLabel} {dyn.recommendedMin}~{dyn.recommendedMax} · 보상 ×
                                                    {dyn.rewardMultiplier.toFixed(1)}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* 현재 선택된 던전 요약 */}
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "#9ca3af",
                                        marginBottom: 8,
                                    }}
                                >
                                    선택된 던전:{" "}
                                    <span
                                        style={{
                                            color: "#e5e7eb",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {selectedDungeon.name}
                                    </span>{" "}
                                    (난이도 {summaryDyn.difficultyLabel} · 보상 ×
                                    {summaryDyn.rewardMultiplier.toFixed(1)})
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "flex-end",
                                        gap: 8,
                                        marginTop: 6,
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setViewState("lobby")}
                                        style={{
                                            padding: "0.35rem 0.9rem",
                                            borderRadius: 999,
                                            border: "1px solid #4b5563",
                                            background: "#020617",
                                            color: "#e5e7eb",
                                            fontSize: 12,
                                            cursor: "pointer",
                                        }}
                                    >
                                        ◀ 메인 메뉴
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            console.log("[QuizMonGame] Start dungeon:", selectedDungeonId);
                                            setBattleMode("dungeon");
                                            setCurrentTowerFloorInfo(null);
                                            setHasReportedTowerClear(false);
                                            handleReset("dungeon");
                                            setViewState("battle");
                                        }}

                                        style={{
                                            padding: "0.35rem 0.9rem",
                                            borderRadius: 999,
                                            border: "1px solid #b91c1c",
                                            background:
                                                "linear-gradient(90deg,#b91c1c,#f97316)",
                                            color: "#fef2f2",
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: "pointer",
                                        }}
                                    >
                                        ▶ 이 던전으로 레이드 시작
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 🎁 가챠 오버레이 */}
                    {viewState === "gacha" && (
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "1rem",
                                background: "rgba(0,0,0,0.6)",
                                pointerEvents: "none",
                            }}
                        >
                            <div
                                style={{
                                    width: 320,
                                    borderRadius: 12,
                                    background: "rgba(15,23,42,0.98)",
                                    border: "2px solid #111827",
                                    padding: "1rem 1.2rem",
                                    boxShadow: "0 24px 40px rgba(0,0,0,0.8)",
                                    pointerEvents: "auto",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "#9ca3af",
                                        marginBottom: 4,
                                    }}
                                >
                                    Gacha · Preview
                                </div>
                                <div
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 700,
                                        marginBottom: 8,
                                    }}
                                >
                                    가챠 (수업 보상)
                                </div>

                                <p
                                    style={{
                                        fontSize: 13,
                                        color: "#d1d5db",
                                        marginBottom: 10,
                                    }}
                                >
                                    수업에서 모은 코인으로 포켓몬을 뽑는 기능입니다.
                                    지금은 연출/구조만 먼저 준비해 두고,
                                    수업 후 단계에서 본격 연결할 예정입니다.
                                </p>

                                {gachaError && (
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: "#fca5a5",
                                            marginBottom: 6,
                                        }}
                                    >
                                        {gachaError}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={async () => {
                                        await pullGacha();
                                    }}
                                    disabled={!canPaidGacha}
                                    style={{
                                        width: "100%",
                                        padding: "0.45rem 0.7rem",
                                        borderRadius: 6,
                                        border: "1px solid #4b5563",
                                        backgroundColor: canPaidGacha ? "#1d4ed8" : "#02061780",
                                        color: canPaidGacha ? "#e5e7eb" : "#6b7280",
                                        fontSize: 13,
                                        marginBottom: 8,
                                        cursor: canPaidGacha ? "pointer" : "not-allowed",
                                    }}
                                >
                                    {gachaDrawing ? "소환 중..." : "1회 소환 (💎 1)"}
                                </button>
                                {gachaLastResult && (
                                    <div
                                        style={{
                                            marginTop: 4,
                                            padding: "0.6rem 0.75rem",
                                            borderRadius: 8,
                                            border: "1px solid #1f2937",
                                            backgroundColor: "#02061780",
                                            fontSize: 12,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "#9ca3af",
                                                marginBottom: 4,
                                            }}
                                        >
                                            최근 가챠 결과
                                        </div>

                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                            }}
                                        >
                                            {/* 아이콘 박스 */}
                                            <div
                                                style={{
                                                    width: 56,
                                                    height: 56,
                                                    borderRadius: 12,
                                                    background: "#020617",
                                                    border: "1px solid #1f2937",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    overflow: "hidden",
                                                }}
                                            >
                                                {(() => {
                                                    const iconUrl = getMonsterIcon(gachaLastResult.species.id);

                                                    return iconUrl ? (
                                                        <img
                                                            src={iconUrl}
                                                            alt={gachaLastResult.species.name}
                                                            style={{
                                                                width: "100%",
                                                                height: "100%",
                                                                objectFit: "contain",
                                                                imageRendering: "pixelated",
                                                            }}
                                                        />
                                                    ) : (
                                                        <span
                                                            style={{
                                                                fontSize: 20,
                                                                color: "#4b5563",
                                                            }}
                                                        >
                            ?
                        </span>
                                                    );
                                                })()}
                                            </div>

                                            {/* 텍스트 영역 */}
                                            <div style={{ flex: 1 }}>
                                                <div
                                                    style={{
                                                        fontSize: 14,
                                                        fontWeight: 700,
                                                        color: "#e5e7eb",
                                                    }}
                                                >
                                                    {gachaLastResult.species.name}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        color: "#9ca3af",
                                                    }}
                                                >
                                                    레어도 ★{gachaLastResult.species.rarity}
                                                </div>

                                                {gachaLastResult.kind === "duplicate" && (
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            color: "#fbbf24",
                                                            marginTop: 4,
                                                        }}
                                                    >
                                                        중복 보상으로 Shards{" "}
                                                        {gachaLastResult.starShardsGained}개를
                                                        획득했어요.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}



                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "flex-end",
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setViewState("lobby")}
                                        style={{
                                            padding: "0.35rem 0.9rem",
                                            borderRadius: 999,
                                            border: "1px solid #4b5563",
                                            background: "#020617",
                                            color: "#e5e7eb",
                                            fontSize: 12,
                                            cursor: "pointer",
                                        }}
                                    >
                                        ◀ 메인 메뉴
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* 🎉 배틀 결산 오버레이 */}
                    {showResultOverlay && (
                        <QuizMonResultOverlay
                            // ✅ 실제 전투 모드 기준으로 UI 분기
                            variant={battleMode === "raid" ? "raid" : "dungeon"}
                            resultMessage={resultMessage}
                            stats={battleStats}
                            accuracyPercent={accuracyPercent}
                            playerMon={playerMon}
                            enemyMon={enemyMon}
                            onBackToMenu={() => {
                                setViewState("lobby");
                            }}
                            onRetry={() => {
                                handleReset();
                            }}
                        />
                    )}
                </div>
            </div>

            {/* 컨트롤/상태 줄 */}
            <section
                style={{
                    marginTop: "0.75rem",
                    fontSize: 12,
                }}
            >
                {/* 🔁 메인 메뉴 → 도망가기 */}
                <button
                    type="button"
                    onClick={handleRunAway}
                    style={{
                        padding: "0.35rem 0.9rem",
                        borderRadius: 999,
                        border: "1px solid #4b5563",
                        background: "#020617",
                        color: "#e5e7eb",
                        cursor: "pointer",
                    }}
                >
                    도망가기
                </button>
                <span
                    style={{
                        marginLeft: "0.75rem",
                        color: "#9ca3af",
                    }}
                >
                    턴: {state.turn} · 단계: {state.phase} · 모드:{" "}
                    {viewState}
                </span>
            </section>
        </div>
    );
}


