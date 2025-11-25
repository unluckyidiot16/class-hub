// src/games/quizmon/QuizMonGame.tsx
import { useEffect, useMemo, useState } from "react";
import type {
    BattleState,
    Move,
    QuizAnswerResult,
    QuizQuestionLite,
    Monster,
    QuizmonOwnedMonsterRow,
    QuizmonSpeciesRow,
    QuizmonProfileRow,
} from "./types";
import { quizPackToLiteQuestions } from "./quizSource";
import { logGameEvent } from "../../api/gameSessions";
import {
    applyDamageToMonster,
    calcDamage,
    calcHitChance,
    calcQuizMod,
    pushLog,
    rollHit,
} from "./logic";
import { createInitialBattleState } from "./mockData";
import { supabase } from "../../lib/supabaseClient";
import { buildBattleMonsterFromSpecies } from "./battleFactory";
import type { QuizPackJsonV1 } from "../../types/quizPackJson";
import { getArenaSprite, getMonsterAnimJson, getMonsterSprite, getMonsterIcon, } from "./assets";
import { SpriteAnimation } from "./SpriteAnimation";
import { useGachaDraw } from "./useGachaDraw";
import { QuizMonLobbyOverlay } from "./QuizMonLobbyOverlay"; // ⬅️ 새로 추가;
import { QuizMonBattleView } from "./QuizMonBattleView";
import { QuizMonResultOverlay } from "./QuizMonResultOverlay";


// =========================
// 🌆 배틀 BG / 하단 패널용 헬퍼
// =========================
const BATTLE_BG_URL = getArenaSprite("forest_bg");
const PLAYER_SPECIES_ID = "0001";

// viewState 는 던전 단위 상태(DungeonState) 역할
// - "lobby": 메인 메뉴 오버레이
// - "battle": 실제 전투 진행 화면
// - "result": 배틀 결산 오버레이
type ViewState = "lobby" | "dungeon" | "gacha" | "battle" | "result";

// 배열 셔플 유틸 (Fisher–Yates)
function shuffleArray<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}



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
    onPullFreeGacha?: () => void | Promise<void>;
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

    // 🔹 가챠/재화용 프로필 로컬 상태 (부모 profile과 동기화)
    const [localProfile, setLocalProfile] = useState<QuizmonProfileRow | null>(
        props.profile ?? null,
    );

    // 🔹 화면 너비에 따라 배틀 연출 스케일 조정용
    const [viewportWidth, setViewportWidth] = useState(
        typeof window !== "undefined" ? window.innerWidth : 1024,
    );

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
        drawing: gachaDrawing,
        error: gachaError,
        pullGacha,
        lastResult: gachaLastResult,   // ✅ 최근 결과
    } = useGachaDraw({
        profile: localProfile,
        onProfileUpdated: setLocalProfile,
    });

    // 1) 전투 상태
    const [state, setState] = useState<BattleState>(() =>
        createInitialBattleState(),
    );
    const [questionIndex, setQuestionIndex] = useState(0);
    // 🔹 문제 순서를 랜덤으로 돌리기 위한 인덱스 배열
    const [questionOrder, setQuestionOrder] = useState<number[]>([]);

    // 이번 배틀에서 학생이 푼 퀴즈 집계
    const [battleStats, setBattleStats] = useState({ correct: 0, total: 0 });
    const [hasReportedEnd, setHasReportedEnd] = useState(false);

    const [menuTab, setMenuTab] = useState<"menu" | "monsters" | "dex" | "profile">("menu");

    // 상위 던전 상태 (메인 메뉴 / 배틀 / 결산)
    const [viewState, setViewState] = useState<ViewState>("lobby");
    const isBattleActive = viewState === "battle";
    const canPaidGacha = !!localProfile && (localProfile.gacha_gems ?? 0) > 0 && !gachaDrawing;
    
    const [hpSynced, setHpSynced] = useState(false);
    
    // Bulbasaur(0001) 임시 전투 스프라이트 – 이후 파티 기반으로 교체 가능
    const bulbasaurFrontJson = getMonsterAnimJson(PLAYER_SPECIES_ID, "front");
    const bulbasaurFrontPng = getMonsterSprite(PLAYER_SPECIES_ID, "front");
    const bulbasaurBackJson = getMonsterAnimJson(PLAYER_SPECIES_ID, "back");
    const bulbasaurBackPng = getMonsterSprite(PLAYER_SPECIES_ID, "back");

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
        bulbasaurBackJson && bulbasaurBackPng ? (
            <SpriteAnimation
                jsonUrl={bulbasaurBackJson}
                imageUrlOverride={bulbasaurBackPng}
                fps={12}
                frameFilter={(frame) => {
                    const n = parseInt(frame.filename.replace(".png", ""), 10);
                    return !Number.isNaN(n) && n >= 1 && n <= 20;
                }}
                style={{
                    // 🔹 원근감: 플레이어 쪽만 더 크게
                    transform: `scale(${PLAYER_SCALE})`,
                    transformOrigin: "bottom left",
                }}
            />
        ) : null;

    const renderEnemySprite = () =>
        bulbasaurFrontJson && bulbasaurFrontPng ? (
            <SpriteAnimation
                jsonUrl={bulbasaurFrontJson}
                imageUrlOverride={bulbasaurFrontPng}
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
    const resetBattleWithProfileParty = async (profileId: string) => {
        try {
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
                        "created_at",
                        "updated_at",
                    ].join(", ")
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

            // 2) 필요한 종 정보 모아서 quizmon_species 조회
            const speciesIds = Array.from(
                new Set(
                    ownedRows
                        .map((o) => o.species_id)
                        .filter((id): id is string => !!id),
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
            const partyMonsters: Monster[] = ownedRows
                .map((owned) => {
                    const species = speciesMap.get(owned.species_id);
                    if (!species) return null;
                    return buildBattleMonsterFromSpecies(species, owned);
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

            // 4) 기존 mock 기반 상태를 가져와서 player 쪽만 교체
            const base = createInitialBattleState();

            const newState: BattleState = {
                ...base,
                player: {
                    ...base.player,
                    monsters: partyMonsters,
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

    // 파티 3슬롯 구성이 변경되었을 때 DB에 반영 + 컬렉션 refresh
    const handleSaveParty = async (partyIds: (string | null)[]) => {
        if (!props.profileId) {
            console.warn(
                "[QuizMonGame] handleSaveParty called without profileId",
            );
            return;
        }

        try {
            // 1) 이 프로필의 기존 파티 슬롯 전체 비우기
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

            // 3) 🔁 컬렉션 재로딩
            if (props.onRefreshCollection) {
                await props.onRefreshCollection();
            }
        } catch (err) {
            console.error("[QuizMonGame] handleSaveParty exception", err);
        }
    };


    // 2) 퀴즈 소스: quizpackJson → Lite 배열
    const questions: QuizQuestionLite[] = useMemo(
        () => quizPackToLiteQuestions(quizpack),
        [quizpack],
    );

    // 🔹 quizpack이 준비되면 한 번 문제 순서를 섞어 둔다
    useEffect(() => {
        if (!questions.length) {
            setQuestionOrder([]);
            setQuestionIndex(0);
            return;
        }

        const indices = questions.map((_, idx) => idx);
        setQuestionOrder(shuffleArray(indices));
        setQuestionIndex(0);
    }, [questions]);


    const playerMon = useMemo(
        () => state.player.monsters[state.player.activeIndex],
        [state.player],
    );
    const enemyMon = useMemo(
        () => state.enemy.monsters[state.enemy.activeIndex],
        [state.enemy],
    );

    // 적은 일단 영구히 첫 번째 기술만 쓰는 더미 AI
    useEffect(() => {
        if (!state.pendingEnemyMove && state.phase === "command") {
            const enemyMove = enemyMon.moves[0];
            setState((prev) => ({
                ...prev,
                pendingEnemyMove: {
                    side: "enemy",
                    move: enemyMove,
                },
            }));
        }
    }, [state.phase, state.pendingEnemyMove, enemyMon]);

    // 배틀이 끝난 시점에 한 번만 onBattleEnd 호출
    useEffect(() => {
        if (!onBattleEnd) return;
        if (state.phase !== "finished") return;
        if (hasReportedEnd) return;
        if (battleStats.total <= 0) return; // 한 문제도 풀지 않았다면 스킵

        onBattleEnd({ ...battleStats });
        setHasReportedEnd(true);
    }, [state.phase, battleStats, onBattleEnd, hasReportedEnd]);

    // 배틀 종료 시 → viewState 를 result 로 전환 + HP DB 저장 + 컬렉션 refresh
    useEffect(() => {
        // 배틀이 안 끝났으면 플래그만 리셋하고 종료
        if (state.phase !== "finished") {
            if (hpSynced) setHpSynced(false);
            return;
        }

        // 결과 오버레이 켜기
        setViewState("result");

        // 이미 한 번 동기화했으면 재실행 방지
        if (hpSynced) return;

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
                // 개체별로 HP / 기절 상태 업데이트
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

                // 🔁 HP 저장이 끝났으면 컬렉션 다시 불러오기
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





    /** 현재 질문 선택 (없으면 null)
     *  - questions: 원본 질문 배열
     *  - questionOrder: 랜덤으로 섞인 인덱스 배열
     *  - 보기(option)도 매번 섞어서 반환
     */
    const getNextQuestion = (): QuizQuestionLite | null => {
        if (!questions || questions.length === 0) return null;
        if (!questionOrder.length) return null;

        const orderIdx = questionIndex % questionOrder.length;
        const baseIdx = questionOrder[orderIdx];
        const baseQuestion = questions[baseIdx];
        if (!baseQuestion) return null;

        // 보기 인덱스를 셔플해서 옵션/정답 위치 함께 섞기
        const optionIndices = baseQuestion.options.map((_, idx) => idx);
        const shuffledOptionIndices = shuffleArray(optionIndices);

        const shuffledOptions = shuffledOptionIndices.map(
            (optIdx) => baseQuestion.options[optIdx],
        );

        const newAnswerIndex = shuffledOptionIndices.indexOf(
            baseQuestion.answerIndex,
        );

        return {
            ...baseQuestion,
            options: shuffledOptions,
            answerIndex: newAnswerIndex,
        };
    };


    const handleSelectMove = (move: Move) => {
        if (!isBattleActive) return;
        if (state.phase !== "command") return;
        if (playerMon.hp <= 0 || enemyMon.hp <= 0) return;
        if (!questions.length) {
            // 퀴즈가 없으면 실행 불가
            setState((prev) =>
                pushLog(prev, "[시스템] 이 퀴즈팩에는 문제가 없습니다."),
            );
            return;
        }

        const question = getNextQuestion();
        if (!question) {
            // 이론상 거의 안 오지만, 방어 코드
            setState((prev) =>
                pushLog(prev, "[시스템] 문제를 불러오는 중 오류가 발생했습니다."),
            );
            return;
        }

        const now = Date.now();

        // 다음 문제로 진행
        setQuestionIndex((idx) => idx + 1);

        setState((prev) => ({
            ...prev,
            pendingPlayerMove: { side: "player", move },
            currentQuestion: question,
            questionStartedAt: now,
            lastQuizResult: null,
            phase: "quiz",
        }));

    };

    const handleAnswer = (optionIndex: number) => {
        if (state.phase !== "quiz" || !state.currentQuestion) return;
        const now = Date.now();
        const timeMs =
            state.questionStartedAt != null
                ? now - state.questionStartedAt
                : 9999;

        const correct = optionIndex === state.currentQuestion.answerIndex;
        const quizResult: QuizAnswerResult = {
            questionId: state.currentQuestion.id,
            chosenIndex: optionIndex,
            correct,
            timeMs,
        };

        // 🔹 이번 배틀 통계에 반영
        setBattleStats((prev) => ({
            correct: prev.correct + (correct ? 1 : 0),
            total: prev.total + 1,
        }));

        // 밖으로도 한번 전달 (부모에서 별도 처리할 수 있도록)
        onQuizAnswer?.(quizResult);

        // 🎯 Supabase game_events 로깅
        if (roomId && gameSessionId && studentId) {
            logGameEvent({
                roomId,
                gameSessionId,
                studentId,
                eventType: "quizmon-answer",
                payload: {
                    source: "quizmon",
                    questionId: quizResult.questionId,
                    answerIndex: quizResult.chosenIndex,
                    correct: quizResult.correct,
                    timeMs: quizResult.timeMs ?? null,
                },
            }).catch((err) => {
                console.warn(
                    "[QuizMonGame] failed to log game event",
                    err,
                );
            });
        } else {
            console.warn("[QuizMonGame] skip logGameEvent – missing ids", {
                roomId,
                gameSessionId,
                studentId,
            });
        }

        // 한 번에 player → enemy 순으로만 처리 (샌드박스 단순화)
        setState((prev) => {
            if (!prev.pendingPlayerMove) {
                return {
                    ...prev,
                    lastQuizResult: quizResult,
                    phase: "command",
                    currentQuestion: null,
                    questionStartedAt: null,
                };
            }

            let next: BattleState = { ...prev, lastQuizResult: quizResult };

            // 최신 몬스터 상태는 prev에서 다시 뽑자 (클로저 오염 방지)
            const prevPlayerMon =
                prev.player.monsters[prev.player.activeIndex];
            const prevEnemyMon =
                prev.enemy.monsters[prev.enemy.activeIndex];

            // 1) 플레이어 공격
            const quizMod = calcQuizMod(quizResult);
            const hitChance = calcHitChance(
                prevEnemyMon, // defender
                prev.pendingPlayerMove.move,
                quizMod,
            );

            let logText = `[플레이어] ${
                prev.pendingPlayerMove.move.name
            } (명중률 ${hitChance.toFixed(1)}%) → `;

            if (rollHit(hitChance)) {
                const dmg = calcDamage(
                    prevPlayerMon,
                    prevEnemyMon,
                    prev.pendingPlayerMove.move,
                );
                const newEnemyMon = applyDamageToMonster(prevEnemyMon, dmg);
                const newEnemyMons = [...prev.enemy.monsters];
                newEnemyMons[prev.enemy.activeIndex] = newEnemyMon;

                next = {
                    ...next,
                    enemy: { ...prev.enemy, monsters: newEnemyMons },
                };
                logText += `${dmg} 데미지! (HP ${prevEnemyMon.hp} → ${newEnemyMon.hp})`;
            } else {
                logText += "빗나갔다!";
            }

            next = pushLog(next, logText);

            // 2) 적이 살아 있으면 적 공격도 처리 (퀴즈 영향 없이 평균값으로)
            const enemyStillAlive =
                next.enemy.monsters[next.enemy.activeIndex].hp > 0;
            if (enemyStillAlive && prev.pendingEnemyMove) {
                const enemyQuizMod = 1.0; // 적은 항상 평균 정도라고 가정
                const enemyHitChance = calcHitChance(
                    prevPlayerMon, // defender
                    prev.pendingEnemyMove.move,
                    enemyQuizMod,
                );
                let enemyLog = `[적] ${
                    prev.pendingEnemyMove.move.name
                } (명중률 ${enemyHitChance.toFixed(1)}%) → `;

                if (rollHit(enemyHitChance)) {
                    const dmg = calcDamage(
                        prevEnemyMon,
                        prevPlayerMon,
                        prev.pendingEnemyMove.move,
                    );
                    const newPlayerMon = applyDamageToMonster(
                        prevPlayerMon,
                        dmg,
                    );
                    const newPlayerMons = [...prev.player.monsters];
                    newPlayerMons[prev.player.activeIndex] = newPlayerMon;

                    next = {
                        ...next,
                        player: {
                            ...prev.player,
                            monsters: newPlayerMons,
                        },
                    };

                    enemyLog += `${dmg} 데미지! (HP ${prevPlayerMon.hp} → ${newPlayerMon.hp})`;
                } else {
                    enemyLog += "빗나갔다!";
                }

                next = pushLog(next, enemyLog);
            }

            // 3) 승패 체크
            const playerHp =
                next.player.monsters[next.player.activeIndex].hp;
            const enemyHp =
                next.enemy.monsters[next.enemy.activeIndex].hp;
            let phase: typeof next.phase = "command";

            if (playerHp <= 0 || enemyHp <= 0) {
                phase = "finished";
                const resultText =
                    playerHp <= 0 && enemyHp <= 0
                        ? "무승부!"
                        : playerHp <= 0
                            ? "패배…"
                            : "승리!";
                next = pushLog(next, `[시스템] 배틀 종료: ${resultText}`);
            }

            return {
                ...next,
                phase,
                currentQuestion: null,
                questionStartedAt: null,
                pendingPlayerMove: null,
                pendingEnemyMove: null,
                turn: prev.turn + 1,
            };
        });
    };

    const handleReset = () => {
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
            void resetBattleWithProfileParty(profileId);
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

    const canSelectMove =
        isBattleActive &&
        state.phase === "command" &&
        questions.length > 0 &&
        playerMon.hp > 0 &&
        enemyMon.hp > 0;

    const accuracyPercent =
        battleStats.total > 0
            ? Math.round((battleStats.correct / battleStats.total) * 100)
            : 0;

    const battleFinished = state.phase === "finished";
    const showResultOverlay = viewState === "result" && battleFinished;

    let resultMessage = "접전 끝에 무승부!";
    if (playerMon.hp > 0 && enemyMon.hp <= 0) {
        resultMessage = `신난다! ${enemyMon.name}를 잡았다!`;
    } else if (playerMon.hp <= 0 && enemyMon.hp > 0) {
        resultMessage = "아쉽다… 패배했다!";
    }


    return (
        <div
            style={{
                padding: "1.5rem",
                width: "100%",
                maxWidth: "100%",
                margin: "0 auto",
                color: "#e5e7eb",
            }}
        >
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
                quizpackJson 기반 전투 코어 + 포켓로그풍 배틀 UI 테스트 버전입니다.
            </p>

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
                {localProfile.gacha_gems ?? 0}
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
                    marginTop: "1rem",
                    borderRadius: 12,
                    border: "1px solid #0f172a",
                    background: "#020617",
                    padding: "0.75rem",
                    // 🔹 너무 넓어지는 것 방지: 최대 1200px
                    maxWidth: 1200,
                    marginLeft: "auto",
                    marginRight: "auto",
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
                            backgroundImage: `url(${BATTLE_BG_URL})`,
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
                            playerSprite={renderPlayerSprite()}
                            enemySprite={renderEnemySprite()}
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
                            onPullFreeGacha={props.onPullFreeGacha}
                            onHealAll={props.onHealAll}
                            onSaveParty={handleSaveParty}
                            canContinue={canContinue}
                            onContinue={handleContinue}
                            onSelectDungeon={() => setViewState("dungeon")}
                            onSelectGacha={() => setViewState("gacha")}
                            lastRaidResult={props.lastRaidResult ?? null}
                        />
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

                                {/* 지금은 테스트 던전 하나만 – 나중에 리스트로 확장 */}
                                <div
                                    style={{
                                        borderRadius: 8,
                                        border: "1px solid #1f2937",
                                        background: "#020617",
                                        padding: "0.6rem 0.75rem",
                                        fontSize: 13,
                                        marginBottom: 10,
                                    }}
                                >
                                    <div
                                        style={{
                                            fontWeight: 600,
                                            marginBottom: 2,
                                        }}
                                    >
                                        테스트 레이드 던전
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: "#9ca3af",
                                        }}
                                    >
                                        단일 보스 · 난이도: 쉬움 ·
                                        정답 1개당 코인 1개 획득
                                    </div>
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
                                            handleReset();          // 새 배틀 상태로 리셋
                                            setViewState("battle"); // 배틀 화면으로 진입
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
                                        await pullGacha("gems");
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
                                                    const iconUrl = getMonsterIcon(gachaLastResult.speciesId);

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
                            resultMessage={resultMessage}
                            stats={battleStats}
                            accuracyPercent={accuracyPercent}
                            playerMon={playerMon}
                            enemyMon={enemyMon}
                            onBackToMenu={() => {
                                // 메인 메뉴로 돌아가기 (던전 종료)
                                setViewState("lobby");
                            }}
                            onRetry={() => {
                                // 새 배틀 시작
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
                <button
                    type="button"
                    onClick={() => setViewState("lobby")}
                    style={{
                        padding: "0.35rem 0.9rem",
                        borderRadius: 999,
                        border: "1px solid #4b5563",
                        background: "#020617",
                        color: "#e5e7eb",
                        cursor: "pointer",
                    }}
                >
                    메인 메뉴
                </button>
                <button
                    type="button"
                    onClick={handleReset}
                    style={{
                        padding: "0.35rem 0.9rem",
                        borderRadius: 999,
                        border: "1px solid #4b5563",
                        background: "#020617",
                        color: "#e5e7eb",
                        cursor: "pointer",
                        marginLeft: "0.5rem",
                    }}
                >
                    배틀 리셋
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


