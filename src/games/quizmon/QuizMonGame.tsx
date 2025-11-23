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
import { getArenaSprite, getMonsterAnimJson, getMonsterSprite, getMonsterIcon } from "./assets";
import { SpriteAnimation } from "./SpriteAnimation";
import { useGachaDraw } from "./useGachaDraw";

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

function HpBar({ current, max }: { current: number; max: number }) {
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;

    let color = "#22c55e"; // green
    if (ratio < 0.25) color = "#ef4444"; // red
    else if (ratio < 0.5) color = "#facc15"; // yellow

    return (
        <div
            style={{
                background: "#111827",
                borderRadius: 999,
                overflow: "hidden",
                height: 6,
            }}
        >
            <div
                style={{
                    width: `${ratio * 100}%`,
                    height: "100%",
                    background: color,
                    transition: "width 0.2s ease",
                }}
            />
        </div>
    );
}

type QuizBottomPanelProps = {
    phase: BattleState["phase"];
    currentQuestion: QuizQuestionLite | null;
    playerName: string;
    playerMoves: Move[];
    canSelectMove: boolean;
    hasQuestions: boolean;
    onSelectMove: (move: Move) => void;
    onAnswer: (index: number) => void;
};

function QuizBottomPanel(props: QuizBottomPanelProps) {
    const {
        phase,
        currentQuestion,
        playerName,
        playerMoves,
        canSelectMove,
        hasQuestions,
        onSelectMove,
        onAnswer,
    } = props;

    // 🔹 현재 퀴즈 풀이 단계인지
    const isQuizPhase = phase === "quiz" && !!currentQuestion;
    const isFinished = phase === "finished";

    // 🔹 어떤 스킬 위에 마우스/포커스/터치가 올라가 있는지
    const [hoveredMoveId, setHoveredMoveId] = useState<string | null>(null);

    const hoveredMove =
        !isQuizPhase && hoveredMoveId
            ? playerMoves.find((m) => m.id === hoveredMoveId) ?? null
            : null;

    // 🔹 하단 메인 텍스트
    let mainText: string;
    if (isQuizPhase && currentQuestion) {
        mainText = currentQuestion.prompt;
    } else if (!hasQuestions) {
        mainText = "이 퀴즈팩에는 문제가 없습니다. (질문 0개)";
    } else if (isFinished) {
        mainText =
            "배틀이 종료되었습니다. 위의 결과를 확인한 뒤 리셋 버튼으로 다시 시작할 수 있어요.";
    } else {
        // 포켓몬 느낌: "{이상해씨}는(은) 무엇을 할까?"
        mainText = `${playerName}은(는) 무엇을 할까?`;
    }

    const showSkillGrid = !isQuizPhase && !isFinished;

    return (
        <div
            style={{
                position: "relative",
                borderRadius: 8,
                border: "1px solid #111827",
                background:
                    "linear-gradient(180deg, rgba(15,23,42,1) 0%, #020617 100%)",
                padding: "0.6rem 0.75rem",
                color: "#e5e7eb",
                fontSize: 13,
            }}
        >
            <div
                style={{
                    display: "flex",
                    gap: "0.75rem",
                }}
            >
                {/* 🔹 왼쪽: 메세지 + (퀴즈 phase일 때) 보기 4개 */}
                <div
                    style={{
                        flex: 3,
                        borderRadius: 8,
                        border: "1px solid #1f2937",
                        background: "rgba(15,23,42,0.96)",
                        padding: "0.4rem 0.6rem 0.5rem",
                        minHeight: 60,
                    }}
                >
                    <div
                        style={{
                            minHeight: 32,
                            paddingBottom: "0.4rem",
                            whiteSpace: "pre-wrap",
                        }}
                    >
                        {mainText}
                    </div>

                    {isQuizPhase && currentQuestion && (
                        <div
                            style={{
                                marginTop: "0.4rem",
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "0.5rem",
                            }}
                        >
                            {currentQuestion.options.map((opt, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => onAnswer(idx)}
                                    style={{
                                        textAlign: "left",
                                        padding: "0.5rem 0.75rem",
                                        borderRadius: 8,
                                        border: "1px solid #4b5563",
                                        background: "#020617",
                                        color: "#e5e7eb",
                                        fontSize: 13,
                                        cursor: "pointer",
                                    }}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 🔹 오른쪽: 스킬 이름 4개 그리드 */}
                <div
                    style={{
                        flex: 2,
                        display: "flex",
                        alignItems: "stretch",
                    }}
                >
                    {showSkillGrid && (
                        <div
                            style={{
                                width: "100%",
                                borderRadius: 8,
                                border: "1px solid #1f2937",
                                background: "#020617",
                                padding: "0.5rem",
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "0.4rem",
                                minHeight: 80,
                            }}
                        >
                            {playerMoves.map((move) => (
                                <button
                                    key={move.id}
                                    type="button"
                                    disabled={!canSelectMove}
                                    onClick={() => onSelectMove(move)}
                                    onMouseEnter={() =>
                                        setHoveredMoveId(move.id)
                                    }
                                    onMouseLeave={() =>
                                        setHoveredMoveId((prev) =>
                                            prev === move.id ? null : prev,
                                        )
                                    }
                                    onFocus={() =>
                                        setHoveredMoveId(move.id)
                                    }
                                    onBlur={() =>
                                        setHoveredMoveId((prev) =>
                                            prev === move.id ? null : prev,
                                        )
                                    }
                                    onTouchStart={() =>
                                        setHoveredMoveId(move.id)
                                    }
                                    onTouchEnd={() =>
                                        setHoveredMoveId((prev) =>
                                            prev === move.id ? null : prev,
                                        )
                                    }
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        textAlign: "center",
                                        padding: "0.45rem 0.4rem",
                                        borderRadius: 8,
                                        border: "1px solid #4b5563",
                                        background: canSelectMove
                                            ? "#020617"
                                            : "#020617aa",
                                        color: "#e5e7eb",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: canSelectMove
                                            ? "pointer"
                                            : "default",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                >
                                    {move.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 🔹 스킬 상세 모달(툴팁 카드) */}
            {showSkillGrid && hoveredMove && (
                <div
                    style={{
                        position: "absolute",
                        right: "0.8rem",
                        bottom: "4.5rem", // 스킬 박스 바로 위
                        minWidth: 220,
                        padding: "0.6rem 0.8rem",
                        borderRadius: 12,
                        background: "rgba(15,23,42,0.98)",
                        border: "1px solid #4b5563",
                        boxShadow: "0 18px 45px rgba(0, 0, 0, 0.75)",
                        pointerEvents: "none",
                    }}
                >
                    <div
                        style={{
                            fontSize: 13,
                            fontWeight: 600,
                            marginBottom: 4,
                        }}
                    >
                        {hoveredMove.name}
                    </div>
                    <div
                        style={{
                            fontSize: 12,
                            opacity: 0.9,
                        }}
                    >
                        위력 {hoveredMove.power} / 명중{" "}
                        {hoveredMove.baseAcc}%
                    </div>
                </div>
            )}
        </div>
    );
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

    useEffect(() => {
        setLocalProfile(props.profile ?? null);
    }, [props.profile]);

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

    const PLAYER_SCALE = 3.0; // 적(2.0)보다 1.5배
    const ENEMY_SCALE = 2.0;
    
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
                    "id, profile_id, species_id, level, exp, party_slot, created_at, updated_at",
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
                setHasBattleInitialized(true); // ⭐ 추가
                return;
            }

            const ownedRows = (ownedData ?? []) as QuizmonOwnedMonsterRow[];

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

    // 배틀 종료 시 → viewState 를 result 로 전환 (결산 화면)
    useEffect(() => {
        if (state.phase === "finished") {
            setViewState("result");
        }
    }, [state.phase]);

    /** 현재 질문 선택 (없으면 null) */
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
                maxWidth: 960,
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
                    }}
                >
                    {/* BG 는 항상 보여주기 */}
                    <div
                        style={{
                            width: "100%",
                            paddingTop: "62.5%",
                            backgroundImage: `url(${BATTLE_BG_URL})`,
                            backgroundRepeat: "no-repeat",
                            backgroundSize: "cover",
                            backgroundPosition: "center bottom",
                            imageRendering: "pixelated",
                        }}
                    />

                    {/* 🐾 배틀 레이어: battle 상태에서만 포켓몬/HP/명령창 표시 */}
                    {viewState === "battle" && (
                        <>
                            {/* 적 측: 상단 우측 HP + 포켓몬 */}
                            <div
                                style={{
                                    position: "absolute",
                                    top: 8,
                                    right: 8,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "flex-end",
                                    gap: 8,
                                }}
                            >
                                <div
                                    style={{
                                        minWidth: 160,
                                        padding: "0.35rem 0.5rem",
                                        borderRadius: 8,
                                        background:
                                            "rgba(15,23,42,0.92)",
                                        border: "1px solid #020617",
                                        textAlign: "right",
                                        fontSize: 12,
                                    }}
                                >
                                    <div
                                        style={{
                                            fontWeight: 700,
                                            marginBottom: 2,
                                        }}
                                    >
                                        {enemyMon.name}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            marginBottom: 2,
                                        }}
                                    >
                                        HP {enemyMon.hp}/{enemyMon.maxHp}
                                    </div>
                                    <HpBar
                                        current={enemyMon.hp}
                                        max={enemyMon.maxHp}
                                    />
                                </div>

                                <div
                                    style={{
                                        width: 96,
                                        height: 96,
                                        display: "flex",
                                        alignItems: "flex-end",
                                        justifyContent: "flex-end",
                                    }}
                                >
                                    {renderEnemySprite()}
                                </div>
                            </div>

                            {/* 플레이어 측: 하단 좌측 포켓몬 + HP */}
                            <div
                                style={{
                                    position: "absolute",
                                    left: 16,
                                    bottom: 128,
                                    display: "flex",
                                    alignItems: "flex-end",
                                    gap: 12,
                                }}
                            >
                                <div
                                    style={{
                                        width: 96,
                                        height: 96,
                                        display: "flex",
                                        alignItems: "flex-end",
                                        justifyContent: "flex-start",
                                    }}
                                >
                                    {renderPlayerSprite()}
                                </div>

                                <div
                                    style={{
                                        minWidth: 180,
                                        padding: "0.35rem 0.5rem",
                                        borderRadius: 8,
                                        background:
                                            "rgba(15,23,42,0.92)",
                                        border: "1px solid #020617",
                                        fontSize: 12,
                                    }}
                                >
                                    <div
                                        style={{
                                            fontWeight: 700,
                                            marginBottom: 2,
                                        }}
                                    >
                                        {playerMon.name}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            marginBottom: 2,
                                        }}
                                    >
                                        HP {playerMon.hp}/{playerMon.maxHp}
                                    </div>
                                    <HpBar
                                        current={playerMon.hp}
                                        max={playerMon.maxHp}
                                    />
                                </div>
                            </div>

                            {/* 🔹 하단 명령 / 퀴즈 패널 */}
                            <div
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    padding: "0.6rem 0.75rem",
                                    background:
                                        "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(15,23,42,1) 60%, #020617 100%)",
                                    borderTop: "1px solid #020617",
                                }}
                            >
                                <QuizBottomPanel
                                    phase={state.phase}
                                    currentQuestion={
                                        state.phase === "quiz"
                                            ? state.currentQuestion ?? null
                                            : null
                                    }
                                    playerName={playerMon.name}
                                    playerMoves={playerMon.moves}
                                    canSelectMove={canSelectMove}
                                    hasQuestions={questions.length > 0}
                                    onSelectMove={handleSelectMove}
                                    onAnswer={handleAnswer}
                                />
                            </div>
                        </>
                    )}

                    {viewState === "lobby" && (
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
                                    width: 420,
                                    maxWidth: "100%",
                                    background: "#020617",
                                    borderRadius: 24,
                                    padding: "20px 24px 24px",
                                    boxShadow: "0 18px 40px rgba(0,0,0,0.65)",
                                    border: "1px solid rgba(148,163,184,0.3)",
                                }}
                            >
                                {/* 헤더 + 탭 */}
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontSize: 12, color: "#9ca3af" }}>QuizMon Class · Beta</div>
                                    <div style={{ fontSize: 18, fontWeight: 600, color: "#e5e7eb" }}>메인 메뉴</div>

                                    <div
                                        style={{
                                            marginTop: 12,
                                            display: "flex",
                                            gap: 8,
                                            fontSize: 13,
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
                                                onClick={() => setMenuTab(tab.key as any)}
                                                style={{
                                                    padding: "4px 10px",
                                                    borderRadius: 999,
                                                    border: "none",
                                                    cursor: "pointer",
                                                    background:
                                                        menuTab === tab.key ? "rgba(59,130,246,0.2)" : "transparent",
                                                    color: menuTab === tab.key ? "#bfdbfe" : "#9ca3af",
                                                    fontWeight: menuTab === tab.key ? 600 : 500,
                                                }}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 탭별 내용 */}
                                {menuTab === "menu" && (
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 8,
                                        }}
                                    >
                                        {/* ▶ 계속하기 : 진행 중인 배틀이 있을 때만 노출 */}
                                        {canContinue && (
                                            <button
                                                type="button"
                                                onClick={handleContinue}
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

                                        {/* 새 레이드 시작 (던전) */}
                                        <button
                                            type="button"
                                            onClick={() => setViewState("dungeon")}
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

                                        {/* 가챠 (보상 뽑기) */}
                                        <button
                                            type="button"
                                            onClick={() => setViewState("gacha")}
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
                                )}

                                {menuTab === "monsters" && (
                                    <MonstersTab
                                        monsters={props.monsters ?? []}
                                        collectionLoading={props.collectionLoading}
                                        collectionError={props.collectionError}
                                        onPullFreeGacha={props.onPullFreeGacha}
                                    />
                                )}

                                {menuTab === "dex" && (
                                    <div style={{ fontSize: 13, color: "#9ca3af" }}>
                                        도감 기능은 아직 준비 중입니다. (Beta)
                                    </div>
                                )}

                                {menuTab === "profile" && (
                                    <ProfileTab profile={props.profile} lastRaidResult={props.lastRaidResult} />
                                )}
                            </div>
                        </div>
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
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                gap: 8,
                                            }}
                                        >
                                            <div>
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
                                                        {gachaLastResult.starShardsGained}개를 획득했어요.
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
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                background: "rgba(0,0,0,0.72)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "1rem",
                            }}
                        >
                            <div
                                style={{
                                    width: "100%",
                                    maxWidth: 480,
                                    borderRadius: 8,
                                    border: "2px solid #b91c1c",
                                    background:
                                        "linear-gradient(180deg,#111827 0%,#020617 100%)",
                                    padding: "0.9rem 1rem 0.8rem",
                                    color: "#f9fafb",
                                    boxShadow:
                                        "0 20px 40px rgba(0,0,0,0.6)",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "#fecaca",
                                        marginBottom: 4,
                                    }}
                                >
                                    배틀 결과
                                </div>
                                <div
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 700,
                                        marginBottom: 8,
                                    }}
                                >
                                    {resultMessage}
                                </div>

                                <div
                                    style={{
                                        fontSize: 13,
                                        marginBottom: 8,
                                    }}
                                >
                                    정답 {battleStats.correct} /{" "}
                                    {battleStats.total} (
                                    {accuracyPercent}
                                    %)
                                </div>

                                <div
                                    style={{
                                        display: "flex",
                                        gap: 12,
                                        fontSize: 12,
                                    }}
                                >
                                    <div
                                        style={{
                                            flex: 1,
                                            padding: "0.4rem 0.5rem",
                                            borderRadius: 6,
                                            border: "1px solid #1f2937",
                                            background: "#020617",
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "#9ca3af",
                                            }}
                                        >
                                            내 파트너
                                        </div>
                                        <div
                                            style={{
                                                fontWeight: 600,
                                                marginBottom: 2,
                                            }}
                                        >
                                            {playerMon.name}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                marginBottom: 2,
                                            }}
                                        >
                                            HP {playerMon.hp}/
                                            {playerMon.maxHp}
                                        </div>
                                        <HpBar
                                            current={playerMon.hp}
                                            max={playerMon.maxHp}
                                        />
                                    </div>

                                    <div
                                        style={{
                                            flex: 1,
                                            padding: "0.4rem 0.5rem",
                                            borderRadius: 6,
                                            border: "1px solid #1f2937",
                                            background: "#020617",
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "#9ca3af",
                                            }}
                                        >
                                            상대 포켓몬
                                        </div>
                                        <div
                                            style={{
                                                fontWeight: 600,
                                                marginBottom: 2,
                                            }}
                                        >
                                            {enemyMon.name}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                marginBottom: 2,
                                            }}
                                        >
                                            HP {enemyMon.hp}/
                                            {enemyMon.maxHp}
                                        </div>
                                        <HpBar
                                            current={enemyMon.hp}
                                            max={enemyMon.maxHp}
                                        />
                                    </div>
                                </div>

                                <div
                                    style={{
                                        marginTop: 10,
                                        display: "flex",
                                        justifyContent: "flex-end",
                                        gap: 8,
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            // 메인 메뉴로 돌아가기 (던전 종료)
                                            setViewState("lobby");
                                        }}
                                        style={{
                                            padding:
                                                "0.35rem 0.9rem",
                                            borderRadius: 999,
                                            border: "1px solid #4b5563",
                                            background: "#020617",
                                            color: "#e5e7eb",
                                            fontSize: 12,
                                            cursor: "pointer",
                                        }}
                                    >
                                        메뉴로
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            // 새 배틀 시작
                                            handleReset();
                                        }}
                                        style={{
                                            padding:
                                                "0.35rem 0.9rem",
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
                                        다시 도전
                                    </button>
                                </div>
                            </div>
                        </div>
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

// =========================
// 📘 탭용 서브 컴포넌트
// =========================

// 기존 MonstersTabProps / MonstersTab 전부 삭제 후 이걸로 교체

// 몬스터 탭용 타입
type MonstersTabProps = {
    profile: QuizmonProfileRow | null;
    monsters: QuizmonOwnedMonsterRow[];
    collectionLoading: boolean;
    collectionError: string | null;
    onPullFreeGacha: () => Promise<QuizmonOwnedMonsterRow | null>;
};

type OwnedMonsterWithStatus = QuizmonOwnedMonsterRow & {
    displayName: string;
    statusText: string;
};

function enhanceOwned(mon: QuizmonOwnedMonsterRow): OwnedMonsterWithStatus {
    // 우선은 species_id 그대로 이름처럼 사용 (나중에 species 테이블 조인해서 이름/타입 넣자)
    const displayName = mon.species_id ?? "???";

    let statusText = "정상";
    if (mon.is_fainted) {
        statusText = "기절";
    } else if (typeof mon.current_hp === "number") {
        statusText = `HP ${mon.current_hp}`;
    }

    return {
        ...mon,
        displayName,
        statusText,
    };
}

function MonstersTab(props: MonstersTabProps) {
    const {
        monsters,
        collectionLoading,
        collectionError,
        onPullFreeGacha,
    } = props;

    const [localMonsters, setLocalMonsters] = useState<OwnedMonsterWithStatus[]>(
        [],
    );
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [gachaBusy, setGachaBusy] = useState(false);

    // monsters → localMonsters 로 동기화
    useEffect(() => {
        const enhanced = monsters.map(enhanceOwned);
        setLocalMonsters(enhanced);

        // 선택된 몬스터가 목록에서 사라졌으면 첫 번째로 다시 선택
        if (enhanced.length === 0) {
            setSelectedId(null);
        } else if (!enhanced.some((m) => m.id === selectedId)) {
            setSelectedId(enhanced[0].id);
        }
    }, [monsters, selectedId]);

    const handlePullFree = useCallback(async () => {
        // 콜백이 아직 안 꽂혀 있는 경우 그냥 무시
        if (!onPullFreeGacha) return;

        if (gachaBusy) return;
        setGachaBusy(true);
        try {
            const inserted = await onPullFreeGacha();
            if (inserted) {
                setSelectedId(inserted.id);
            }
        } finally {
            setGachaBusy(false);
        }
    }, [gachaBusy, onPullFreeGacha]);

    if (collectionLoading) {
        return (
            <div style={{ padding: "1rem", fontSize: "0.9rem", opacity: 0.8 }}>
                몬스터 정보를 불러오는 중입니다…
            </div>
        );
    }

    if (collectionError) {
        return (
            <div style={{ padding: "1rem", color: "#ff8080", fontSize: "0.9rem" }}>
                {collectionError}
            </div>
        );
    }

    const partySlots = [1, 2, 3] as const;

    const partyBySlot: Record<number, OwnedMonsterWithStatus | undefined> = {};
    for (const mon of localMonsters) {
        if (mon.party_slot != null) {
            partyBySlot[mon.party_slot] = mon;
        }
    }

    const selected =
        (selectedId && localMonsters.find((m) => m.id === selectedId)) ||
        localMonsters[0] ||
        null;

    return (
        <div
            style={{
                display: "flex",
                gap: "1.5rem",
                alignItems: "flex-start",
                minHeight: 260,
            }}
        >
            {/* 좌측: 가챠 + 파티 + 벤치 */}
            <div
                style={{
                    flex: "0 0 320px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                }}
            >
                {/* 가챠 버튼 */}
                <div
                    style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "0.75rem",
                        background: "rgba(0,0,0,0.35)",
                        border: "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "0.5rem",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "0.85rem",
                                opacity: 0.8,
                            }}
                        >
                            가챠 (수업 보상)
                        </div>
                        <div
                            style={{
                                fontSize: "0.8rem",
                                opacity: 0.6,
                            }}
                        >
                            Gems / Shards 사용 예정
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handlePullFree}
                        disabled={gachaBusy}
                        style={{
                            width: "100%",
                            padding: "0.6rem 0.75rem",
                            borderRadius: "999px",
                            border: "none",
                            fontSize: "0.9rem",
                            fontWeight: 600,
                            cursor: gachaBusy ? "default" : "pointer",
                            background:
                                "linear-gradient(135deg, #3b82f6, #2563eb, #0ea5e9)",
                            color: "#fff",
                            boxShadow:
                                "0 8px 18px rgba(37,99,235,0.45), 0 0 0 1px rgba(255,255,255,0.05)",
                        }}
                    >
                        {gachaBusy ? "소환 중…" : "무료 소환 1회"}
                    </button>
                </div>

                {/* 파티 1~3번 */}
                <div
                    style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "0.75rem",
                        background: "rgba(0,0,0,0.35)",
                        border: "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    <div
                        style={{
                            fontSize: "0.85rem",
                            marginBottom: "0.4rem",
                            opacity: 0.8,
                        }}
                    >
                        파티 편성
                    </div>
                    <div
                        style={{
                            display: "flex",
                            gap: "0.6rem",
                            justifyContent: "space-between",
                        }}
                    >
                        {partySlots.map((slot) => {
                            const mon = partyBySlot[slot];
                            const iconUrl = mon
                                ? getMonsterIcon(mon.species_id)
                                : null;

                            return (
                                <button
                                    key={slot}
                                    type="button"
                                    onClick={() => mon && setSelectedId(mon.id)}
                                    style={{
                                        flex: 1,
                                        minHeight: 92,
                                        borderRadius: "0.75rem",
                                        border:
                                            selected && mon && selected.id === mon.id
                                                ? "1px solid rgba(96,165,250,0.9)"
                                                : "1px solid rgba(255,255,255,0.06)",
                                        background: mon
                                            ? "radial-gradient(circle at 0% 0%, rgba(96,165,250,0.28), transparent 55%), rgba(15,23,42,0.85)"
                                            : "rgba(15,23,42,0.8)",
                                        padding: "0.4rem 0.5rem",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "0.25rem",
                                        cursor: mon ? "pointer" : "default",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "0.75rem",
                                            opacity: 0.75,
                                        }}
                                    >
                                        파티 {slot}번
                                    </div>
                                    {mon ? (
                                        <>
                                            {iconUrl && (
                                                <div
                                                    style={{
                                                        width: 40,
                                                        height: 40,
                                                        borderRadius: 999,
                                                        overflow: "hidden",
                                                        background:
                                                            "rgba(15,23,42,0.9)",
                                                    }}
                                                >
                                                    <img
                                                        src={iconUrl}
                                                        alt={mon.displayName}
                                                        style={{
                                                            width: "100%",
                                                            height: "100%",
                                                            imageRendering:
                                                                "pixelated",
                                                            objectFit: "contain",
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <div
                                                style={{
                                                    fontSize: "0.8rem",
                                                    marginTop: "0.1rem",
                                                }}
                                            >
                                                {mon.displayName}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "0.75rem",
                                                    opacity: 0.7,
                                                }}
                                            >
                                                Lv.{mon.level}
                                            </div>
                                        </>
                                    ) : (
                                        <div
                                            style={{
                                                fontSize: "0.8rem",
                                                opacity: 0.6,
                                                marginTop: "0.4rem",
                                            }}
                                        >
                                            빈 슬롯
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 벤치 몬스터 목록 */}
                <div
                    style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "0.75rem",
                        background: "rgba(0,0,0,0.35)",
                        border: "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "0.4rem",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "0.85rem",
                                opacity: 0.8,
                            }}
                        >
                            몬스터 목록
                        </div>
                        <div
                            style={{
                                fontSize: "0.75rem",
                                opacity: 0.6,
                            }}
                        >
                            {localMonsters.length} 마리 보유
                        </div>
                    </div>

                    {localMonsters.length === 0 ? (
                        <div
                            style={{
                                fontSize: "0.8rem",
                                opacity: 0.7,
                                padding: "0.5rem 0.2rem",
                            }}
                        >
                            아직 보유한 몬스터가 없습니다.
                            <br />
                            무료 소환으로 첫 파트너를 뽑아 보세요.
                        </div>
                    ) : (
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))",
                                gap: "0.5rem",
                            }}
                        >
                            {localMonsters.map((mon) => {
                                const iconUrl = getMonsterIcon(mon.species_id);
                                const isSelected = selected && mon.id === selected.id;

                                return (
                                    <button
                                        key={mon.id}
                                        type="button"
                                        onClick={() => setSelectedId(mon.id)}
                                        style={{
                                            textAlign: "left",
                                            borderRadius: "0.75rem",
                                            border: isSelected
                                                ? "1px solid rgba(96,165,250,0.95)"
                                                : "1px solid rgba(255,255,255,0.06)",
                                            background: isSelected
                                                ? "radial-gradient(circle at 0% 0%, rgba(37,99,235,0.4), rgba(15,23,42,0.95))"
                                                : "rgba(15,23,42,0.9)",
                                            padding: "0.45rem 0.55rem",
                                            display: "flex",
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: "0.4rem",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {iconUrl && (
                                            <div
                                                style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: "0.65rem",
                                                    overflow: "hidden",
                                                    background:
                                                        "radial-gradient(circle at 0% 0%, rgba(148,163,184,0.35), rgba(15,23,42,1))",
                                                }}
                                            >
                                                <img
                                                    src={iconUrl}
                                                    alt={mon.displayName}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        imageRendering:
                                                            "pixelated",
                                                        objectFit: "contain",
                                                    }}
                                                />
                                            </div>
                                        )}
                                        <div
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "0.1rem",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: "0.8rem",
                                                }}
                                            >
                                                {mon.displayName}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "0.75rem",
                                                    opacity: 0.75,
                                                }}
                                            >
                                                Lv.{mon.level} · {mon.statusText}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* 우측: 선택된 몬스터 상세 프로필 */}
            <div
                style={{
                    flex: "1 1 auto",
                    borderRadius: "0.9rem",
                    background:
                        "radial-gradient(circle at 0% 0%, rgba(59,130,246,0.18), rgba(15,23,42,0.96))",
                    border: "1px solid rgba(148,163,184,0.35)",
                    padding: "1rem 1.25rem",
                    minHeight: 220,
                }}
            >
                <div
                    style={{
                        fontSize: "0.85rem",
                        opacity: 0.8,
                        marginBottom: "0.5rem",
                    }}
                >
                    몬스터 프로필
                </div>
                {!selected ? (
                    <div
                        style={{
                            fontSize: "0.9rem",
                            opacity: 0.75,
                            marginTop: "0.5rem",
                        }}
                    >
                        왼쪽에서 몬스터를 선택하면 상세 정보가 표시됩니다.
                    </div>
                ) : (
                    <div
                        style={{
                            display: "flex",
                            gap: "1rem",
                        }}
                    >
                        <div
                            style={{
                                width: 96,
                                height: 96,
                                borderRadius: "1rem",
                                overflow: "hidden",
                                background:
                                    "radial-gradient(circle at 0% 0%, rgba(96,165,250,0.4), rgba(15,23,42,1))",
                                boxShadow:
                                    "0 12px 30px rgba(15,23,42,0.9), 0 0 0 1px rgba(148,163,184,0.6)",
                            }}
                        >
                            {getMonsterIcon(selected.species_id) && (
                                <img
                                    src={getMonsterIcon(selected.species_id)!}
                                    alt={selected.displayName}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        imageRendering: "pixelated",
                                        objectFit: "contain",
                                    }}
                                />
                            )}
                        </div>

                        <div
                            style={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.25rem",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "1rem",
                                    fontWeight: 600,
                                }}
                            >
                                {selected.displayName}
                            </div>
                            <div
                                style={{
                                    fontSize: "0.85rem",
                                    opacity: 0.8,
                                }}
                            >
                                Lv.{selected.level} · {selected.statusText}
                            </div>
                            <div
                                style={{
                                    marginTop: "0.4rem",
                                    fontSize: "0.8rem",
                                    opacity: 0.75,
                                }}
                            >
                                앞으로 레벨·진화·스킬 정보, 타입 상성 같은 상세 스탯은
                                여기에서 확인할 수 있게 확장하면 좋을 것 같아.
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}



type ProfileTabProps = {
    profile?: any;
    lastRaidResult?: { correct: number; total: number } | null;
};

function ProfileTab({ profile, lastRaidResult }: ProfileTabProps) {
    if (!profile) {
        return (
            <div style={{ fontSize: 13, color: "#9ca3af" }}>
                프로필 정보를 불러오는 중이거나 아직 생성되지 않았습니다.
            </div>
        );
    }

    const accuracy =
        lastRaidResult && lastRaidResult.total > 0
            ? Math.round((lastRaidResult.correct / lastRaidResult.total) * 100)
            : 0;

    return (
        <div style={{ fontSize: 13, color: "#e5e7eb", display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
                <strong>트레이너 이름:</strong> {profile.trainer_name ?? "(이름 없음)"}
            </div>
            <div>
                <strong>총 전투 수:</strong> {profile.total_raids ?? 0}
            </div>
            <div>
                <strong>총 정답 수:</strong> {profile.total_correct ?? 0}
            </div>
            <div>
                <strong>최근 레이드:</strong>{" "}
                {lastRaidResult ? `${lastRaidResult.correct}/${lastRaidResult.total} (${accuracy}%)` : "기록 없음"}
            </div>
        </div>
    );
}

