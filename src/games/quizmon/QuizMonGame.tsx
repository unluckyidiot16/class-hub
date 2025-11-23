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
import { getArenaSprite, getMonsterAnimJson, getMonsterSprite } from "./assets";
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
                                    width: "min(1040px, 100%)",   // 🔹 넓게
                                    maxHeight: "90vh",
                                    padding: "1.1rem 1.3rem",
                                    borderRadius: 24,
                                    background: "rgba(15,23,42,0.98)",
                                    border: "1px solid #1f2937",
                                    boxShadow: "0 22px 60px rgba(0,0,0,0.8)",
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
                                    <PartyAndDexPanel
                                        profile={localProfile}
                                        monsters={props.monsters}
                                        collectionLoading={props.collectionLoading}
                                        collectionError={props.collectionError}
                                        onPullFreeGacha={props.onPullFreeGacha}
                                    />
                                )}

                                {menuTab === "dex" && (
                                    <div style={{ fontSize: 13, opacity: 0.8 }}>
                                        도감 전용 보기(필요하면 남겨두고, 아니면 이 탭은 숨겨도 됨)
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
// 보유 몬스터 + 표시용 메타 정보
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
        (rawSpeciesId
            ? rawSpeciesId.startsWith("poke-")
                ? rawSpeciesId
                : `poke-${rawSpeciesId.toString().padStart(4, "0")}`
            : "????");

    const displayName = `포켓몬 #${displayId}`;

    let statusText = "정상";

    const hp = anyMon.current_hp as number | null;
    const maxHp = anyMon.max_hp as number | null;
    const isFainted = Boolean(anyMon.is_fainted);

    if (typeof hp === "number" && typeof maxHp === "number" && maxHp > 0) {
        if (hp <= 0 || isFainted) {
            statusText = "기절";
        } else {
            const ratio = hp / maxHp;
            if (ratio < 0.25) statusText = `빈사 (${hp}/${maxHp})`;
            else if (ratio < 0.6) statusText = `부상 (${hp}/${maxHp})`;
            else statusText = `HP ${hp}/${maxHp}`;
        }
    }

    return {
        ...(mon as any),
        displayName,
        statusText,
    };
}

type PartyAndDexPanelProps = {
    /** 학생의 퀴즈몬 프로필 (트레이너 이름 표시에 사용) */
    profile: QuizmonProfileRow | null;
    /** 보유 몬스터 목록 (Supabase에서 그대로 내려온 값) */
    monsters?: QuizmonOwnedMonsterRow[];
    /** 로딩/에러 표시용 */
    collectionLoading?: boolean;
    collectionError?: string | null;
    /** 무료 소환 버튼 핸들러(있으면 상단에 표시) */
    onPullFreeGacha?: () => void | Promise<void>;
};

/**
 * 몬스터 탭: 내 파트너/파티 + 도감/보유 몬스터
 *
 * - 왼쪽 상단: 파티 슬롯 3개만 세로 리스트로 표시
 * - 아래: 도감/보유 몬스터 요약 그리드
 * - 도감 칸 클릭 시:
 *   - 빈 파티 슬롯이 있으면 첫 빈 슬롯에 배정
 *   - 이미 3칸이 꽉 차 있으면 오른쪽 상세 정보만 갱신
 */
function PartyAndDexPanel(props: PartyAndDexPanelProps) {
    const { profile } = props;

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
        setSelectedId((prev) => {
            if (prev && enhancedMonsters.some((m) => m.id === prev)) return prev;
            return enhancedMonsters[0].id;
        });
    }, [enhancedMonsters]);

    const selected =
        enhancedMonsters.find((m) => m.id === selectedId) ?? null;

    // 파티 슬롯(3인 고정)
    const [partyIds, setPartyIds] = useState<(string | null)[]>([
        null,
        null,
        null,
    ]);

    // 첫 로딩 시 서버의 party_slot 값을 기반으로 파티 초기화
    useEffect(() => {
        if (!enhancedMonsters.length) {
            setPartyIds([null, null, null]);
            return;
        }

        setPartyIds((prev) => {
            // 이미 수동으로 조정된 적이 있으면 그대로 유지
            if (prev.some((id) => id !== null)) return prev;

            const slots: (string | null)[] = [null, null, null];
            for (const mon of enhancedMonsters) {
                const slot = (mon as any).party_slot as number | null | undefined;
                if (slot && slot >= 1 && slot <= 3 && !slots[slot - 1]) {
                    slots[slot - 1] = mon.id;
                }
            }
            return slots;
        });
    }, [enhancedMonsters]);

    // 슬롯별 파티 몬스터 (최대 3개)
    const partyMonsters = partyIds.map(
        (id) => enhancedMonsters.find((m) => m.id === id) ?? null,
    );

    // 도감(보유 몬스터) – 종별 카운트 + 대표 개체
    const dexEntries = useMemo(() => {
        const bySpecies = new Map<
            string,
            { speciesId: string; count: number; sample: EnhancedOwnedMonster }
        >();

        for (const mon of enhancedMonsters) {
            const sid = String((mon as any).species_id ?? "");
            if (!sid) continue;
            const existing = bySpecies.get(sid);
            if (existing) {
                existing.count += 1;
            } else {
                bySpecies.set(sid, {
                    speciesId: sid,
                    count: 1,
                    sample: mon,
                });
            }
        }

        return Array.from(bySpecies.values()).sort((a, b) =>
            a.speciesId.localeCompare(b.speciesId),
        );
    }, [enhancedMonsters]);

    const trainerName = profile?.trainer_name ?? "미지의 트레이너";

    // 선택된 몬스터가 파티 몇 번 슬롯에 있는지 (-1이면 파티 외)
    const selectedPartyIndex = selected ? partyIds.indexOf(selected.id) : -1;

    // 파티 슬롯 클릭 → 해당 슬롯 비우기 (옛 Delete 버튼 기능)
    function handlePartySlotClick(index: number) {
        setPartyIds((prev) => {
            const next = [...prev];
            next[index] = null;
            return next;
        });
    }


    // 파티 슬롯 비우기 (예: 삭제 기능)
    function clearPartySlot(slotIndex: number, monId: string | null) {
        setPartyIds((prev) => {
            const next = [...prev];
            next[slotIndex] = null;
            return next;
        });

        if (monId) {
            setSelectedId((prev) => (prev === monId ? null : prev));
        }
    }

    // 도감 칸 클릭 → 빈 슬롯이 있으면 배정, 없으면 상세 정보만 변경
    function handleDexClick(entry: { sample: EnhancedOwnedMonster }) {
        setSelectedId(entry.sample.id);
        setPartyIds((prev) => {
            // 이미 파티에 있으면 그대로 두고 상세만 변경
            if (prev.includes(entry.sample.id)) return prev;
            const emptyIndex = prev.findIndex((id) => id === null);
            if (emptyIndex === -1) return prev;
            const next = [...prev];
            next[emptyIndex] = entry.sample.id;
            return next;
        });
    }

    return (
        <div
            className="quizmon-menu-layout"
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                height: "100%",
            }}
        >
            {/* 상단: 내 파트너 / 파티 + 선택한 파트너 */}
            <div
                style={{
                    display: "flex",
                    gap: "1rem",
                    flex: "1 1 auto",
                    minHeight: 0,
                }}
            >
                {/* 왼쪽: 파티 3마리 리스트 */}
                <div
                    className="quizmon-card"
                    style={{
                        flex: "0 0 40%",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <div
                        className="quizmon-card-header"
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "0.5rem",
                        }}
                    >
                        <div>
                            <div className="quizmon-card-title">
                                내 파트너 / 파티
                            </div>
                            <div
                                className="quizmon-card-subtitle"
                                style={{ opacity: 0.75, fontSize: "0.8rem" }}
                            >
                                트레이너: {trainerName}
                            </div>
                        </div>

                        {props.onPullFreeGacha && (
                            <button
                                type="button"
                                onClick={props.onPullFreeGacha}
                                className="quizmon-button subtle"
                                style={{
                                    fontSize: "0.75rem",
                                    padding: "0.25rem 0.75rem",
                                    borderRadius: "999px",
                                }}
                            >
                                무료 소환
                            </button>
                        )}
                    </div>

                    {/* 파티 3마리만 세로 리스트로 노출 */}
                    <div
                        style={{
                            flex: "1 1 auto",
                            minHeight: 0,
                            overflowY: "auto",
                            borderRadius: "0.75rem",
                            background: "rgba(15,23,42,0.85)",
                            padding: "0.5rem",
                        }}
                    >
                        {partyMonsters.map((mon, idx) => {
                            const slotLabel = `파티 ${idx + 1}번`;
                            const isFilled = !!mon;
                            const isSelected =
                                isFilled && selected?.id === mon!.id;

                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={(e) => {
                                        // Ctrl/Command + 클릭 시 해당 슬롯 비우기
                                        if (
                                            isFilled &&
                                            (e.metaKey || e.ctrlKey)
                                        ) {
                                            clearPartySlot(
                                                idx,
                                                mon!.id as string,
                                            );
                                            return;
                                        }
                                        if (isFilled) {
                                            setSelectedId(mon!.id as string);
                                        }
                                    }}
                                    style={{
                                        width: "100%",
                                        textAlign: "left",
                                        padding: "0.5rem 0.75rem",
                                        borderRadius: "0.75rem",
                                        border:
                                            "1px solid rgba(148,163,184,0.25)",
                                        background: isSelected
                                            ? "linear-gradient(135deg, rgba(59,130,246,0.45), rgba(37,99,235,0.25))"
                                            : "rgba(15,23,42,0.9)",
                                        marginBottom: "0.4rem",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        cursor: "pointer",
                                        fontSize: "0.8rem",
                                    }}
                                >
                                    <div>
                                        <div
                                            style={{
                                                fontWeight: 600,
                                                marginBottom: "0.1rem",
                                            }}
                                        >
                                            {isFilled
                                                ? mon!.displayName
                                                : "빈 슬롯"}
                                        </div>
                                        <div style={{ opacity: 0.8 }}>
                                            {isFilled
                                                ? `Lv.${(mon as any).level ?? 1} · ${
                                                    mon!.statusText
                                                }`
                                                : "도감에서 몬스터를 선택하면 자동으로 배치됩니다."}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            textAlign: "right",
                                            fontSize: "0.75rem",
                                            opacity: 0.85,
                                        }}
                                    >
                                        <div>{slotLabel}</div>
                                        {isFilled && (
                                            <div style={{ opacity: 0.6 }}>
                                                ID: {mon!.id.slice(0, 4)}...
                                                {mon!.id.slice(-4)}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}

                        {partyMonsters.every((m) => !m) && (
                            <div
                                style={{
                                    fontSize: "0.8rem",
                                    opacity: 0.7,
                                    marginTop: "0.25rem",
                                }}
                            >
                                아직 파티에 배치된 포켓몬이 없습니다.
                                아래 도감에서 몬스터를 선택해 파티를 구성해
                                보세요.
                            </div>
                        )}
                    </div>
                </div>

                {/* 오른쪽: 선택한 파트너 상세 */}
                <div
                    className="quizmon-card"
                    style={{
                        flex: "1 1 auto",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <div
                        className="quizmon-card-header"
                        style={{ marginBottom: "0.5rem" }}
                    >
                        <div className="quizmon-card-title">
                            선택한 파트너
                        </div>
                    </div>
                    <div
                        style={{
                            flex: 1,
                            borderRadius: "0.75rem",
                            background: "rgba(15,23,42,0.9)",
                            padding: "1rem",
                            fontSize: "0.9rem",
                        }}
                    >
                        {!selected && (
                            <div style={{ opacity: 0.7 }}>
                                왼쪽에서 파트너를 선택해 주세요.
                            </div>
                        )}
                        {selected && (
                            <>
                                <div
                                    style={{
                                        fontSize: "1rem",
                                        fontWeight: 600,
                                        marginBottom: "0.25rem",
                                    }}
                                >
                                    {selected.displayName}
                                </div>
                                <div
                                    style={{
                                        opacity: 0.8,
                                        marginBottom: "0.5rem",
                                    }}
                                >
                                    Lv.{(selected as any).level ?? 1} ·{" "}
                                    {selected.statusText}
                                </div>

                                {selectedPartyIndex !== -1 && (
                                    <button
                                        type="button"
                                        onClick={() => handlePartySlotClick(selectedPartyIndex)}
                                        className="quizmon-button subtle"
                                        style={{
                                            marginLeft: "0.5rem",   // LV 줄 오른쪽에 붙이고 싶으면
                                            marginBottom: "0",      // 아래 간격 줄이기
                                            fontSize: "0.8rem",
                                            padding: "0.35rem 0.9rem",
                                            borderRadius: "999px",
                                            display: "inline-flex",
                                            alignItems: "center",
                                        }}
                                    >
                                        파티 {selectedPartyIndex + 1}번에서 빼기
                                    </button>
                                )}

                                <div style={{ opacity: 0.8 }}>
                                    앞으로는 여기에서 개체 값, 성장, 레이드
                                    기록 등을 자세히 보여 줄 예정입니다.
                                </div>
                            </>
                        )}

                    </div>
                </div>
            </div>

            {/* 하단: 도감 / 보유 몬스터 (정사각형 그리드, Y축 살짝 확대) */}
            <div
                className="quizmon-card"
                style={{
                    flex: "0 0 auto",
                    paddingBottom: "0.75rem",
                }}
            >
                <div
                    className="quizmon-card-header"
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.5rem",
                    }}
                >
                    <div className="quizmon-card-title">
                        도감 / 보유 몬스터
                    </div>
                    <div
                        style={{
                            fontSize: "0.8rem",
                            opacity: 0.8,
                        }}
                    >
                        소유 {dexEntries.length}종
                    </div>
                </div>

                {props.collectionLoading && (
                    <div
                        style={{
                            fontSize: "0.8rem",
                            opacity: 0.7,
                            marginBottom: "0.25rem",
                        }}
                    >
                        보유 몬스터를 불러오는 중...
                    </div>
                )}
                {props.collectionError && (
                    <div
                        style={{
                            fontSize: "0.8rem",
                            color: "#f97373",
                            marginBottom: "0.25rem",
                        }}
                    >
                        오류: {props.collectionError}
                    </div>
                )}

                <div
                    className="quizmon-dex-grid"
                    style={{
                        display: "grid",
                        gridTemplateColumns:
                            "repeat(auto-fill, minmax(5rem, 1fr))",
                        gap: "0.5rem",
                        minHeight: "7.5rem", // Y축 조금 더 키움
                    }}
                >
                    {dexEntries.map((entry) => {
                        const label = entry.speciesId.startsWith("poke-")
                            ? entry.speciesId
                            : `poke-${entry.speciesId
                                .toString()
                                .padStart(4, "0")}`;

                        return (
                            <button
                                key={entry.speciesId}
                                type="button"
                                onClick={() => handleDexClick(entry)}
                                style={{
                                    position: "relative",
                                    borderRadius: "0.75rem",
                                    padding: "0.45rem 0.35rem",
                                    border:
                                        "1px solid rgba(148,163,184,0.3)",
                                    background:
                                        "radial-gradient(circle at top, rgba(148,163,184,0.15), rgba(15,23,42,0.95))",
                                    fontSize: "0.7rem",
                                    textAlign: "left",
                                    aspectRatio: "1 / 1", // 정사각형
                                    cursor: "pointer",
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        fontWeight: 600,
                                        marginBottom: "0.2rem",
                                    }}
                                >
                                    {label}
                                </div>
                                <div style={{ opacity: 0.8 }}>
                                    x{entry.count}
                                </div>
                            </button>
                        );
                    })}

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

