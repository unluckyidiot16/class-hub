// src/games/quizmon/useQuizmonBattle.ts
import { useEffect, useMemo, useState, useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { saveGhostBattle, type GhostBattleRecord } from "./ghostBattle";
import type {
    BattleState,
    Move,
    QuizAnswerResult,
    QuizQuestionLite,
    Monster,
    ElementType, DamagePopup,
} from "./types";
import type { QuizPackJsonV1 } from "../../types/quizPackJson";
import { quizPackToLiteQuestions } from "./quizSource";
import { logGameEvent } from "../../api/gameSessions";
import {
    applyDamageToMonster,
    calcDamageWithContext,
    calcHitChance,
    calcQuizMod,
    pushLog,
    rollHit,
} from "./logic";
import { createInitialBattleState } from "./mockData";
import type {
    CaptureUiState,
    CaptureOverlayHandlers,
} from "./QuizMonBattleView";
import { getCaptureBallStocks, getCaptureBallMeta } from "./ballShop";
import { grantMonsterOrShards } from "./duplicateRewards";



type CaptureSession = {
    enemy: Monster;
    ballId: string | null;
    ballLabel: string | null;
    baseRate: number;      // HP/상태/볼 보정 전 기본값
    currentRate: number;   // 퀴즈 정오 등에 따라 보정된 값
    question: QuizQuestionLite | null;
    success: boolean | null;
    resultKind: "new-monster" | "duplicate" | null;
    shardsGained: number;
};

type CaptureBallStock = {
    id: string;
    label: string;
    quantity: number;
    rateBonus?: number;
};

// 간단한 셔플 유틸 (QuizMonGame.tsx 에 있는 것과 동일한 구현)
function shuffleArray<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
// 🔹 실제 18타입 상성 테이블 (Gen 6+ 기준)
const TYPE_EFFECTIVENESS: Partial<
    Record<ElementType, Partial<Record<ElementType, number>>>
> = {
    normal: {
        rock: 0.5,
        ghost: 0,
        steel: 0.5,
    },
    fire: {
        fire: 0.5,
        water: 0.5,
        grass: 2,
        ice: 2,
        bug: 2,
        rock: 0.5,
        dragon: 0.5,
        steel: 2,
    },
    water: {
        fire: 2,
        water: 0.5,
        grass: 0.5,
        ground: 2,
        rock: 2,
        dragon: 0.5,
    },
    grass: {
        fire: 0.5,
        water: 2,
        grass: 0.5,
        poison: 0.5,
        ground: 2,
        flying: 0.5,
        bug: 0.5,
        rock: 2,
        dragon: 0.5,
        steel: 0.5,
    },
    electric: {
        water: 2,
        electric: 0.5,
        grass: 0.5,
        ground: 0,
        flying: 2,
        dragon: 0.5,
    },
    ice: {
        fire: 0.5,
        water: 0.5,
        grass: 2,
        ice: 0.5,
        ground: 2,
        flying: 2,
        dragon: 2,
        steel: 0.5,
    },
    fighting: {
        normal: 2,
        ice: 2,
        rock: 2,
        dark: 2,
        steel: 2,
        poison: 0.5,
        flying: 0.5,
        psychic: 0.5,
        bug: 0.5,
        fairy: 0.5,
        ghost: 0,
    },
    poison: {
        grass: 2,
        fairy: 2,
        poison: 0.5,
        ground: 0.5,
        rock: 0.5,
        ghost: 0.5,
        steel: 0,
    },
    ground: {
        fire: 2,
        electric: 2,
        poison: 2,
        rock: 2,
        steel: 2,
        grass: 0.5,
        bug: 0.5,
        flying: 0,
    },
    flying: {
        grass: 2,
        fighting: 2,
        bug: 2,
        electric: 0.5,
        rock: 0.5,
        steel: 0.5,
    },
    psychic: {
        fighting: 2,
        poison: 2,
        psychic: 0.5,
        steel: 0.5,
        dark: 0,
    },
    bug: {
        grass: 2,
        psychic: 2,
        dark: 2,
        fire: 0.5,
        fighting: 0.5,
        poison: 0.5,
        flying: 0.5,
        ghost: 0.5,
        steel: 0.5,
        fairy: 0.5,
    },
    rock: {
        fire: 2,
        ice: 2,
        flying: 2,
        bug: 2,
        fighting: 0.5,
        ground: 0.5,
        steel: 0.5,
    },
    ghost: {
        psychic: 2,
        ghost: 2,
        dark: 0.5,
        normal: 0,
    },
    dragon: {
        dragon: 2,
        steel: 0.5,
        fairy: 0,
    },
    dark: {
        psychic: 2,
        ghost: 2,
        fighting: 0.5,
        dark: 0.5,
        fairy: 0.5,
    },
    steel: {
        ice: 2,
        rock: 2,
        fairy: 2,
        fire: 0.5,
        water: 0.5,
        electric: 0.5,
        steel: 0.5,
    },
    fairy: {
        fighting: 2,
        dragon: 2,
        dark: 2,
        fire: 0.5,
        poison: 0.5,
        steel: 0.5,
    },
};



function getTypeMultiplier(
    attack: ElementType,
    defend?: ElementType | null,
): number {
    if (!defend) return 1;
    const row = TYPE_EFFECTIVENESS[attack];
    if (!row) return 1;
    return row[defend] ?? 1;
}

/**
 * 기술 속성 vs 상대 속성을 보고 포켓몬식 코멘트 생성
 */
function getEffectivenessComment(
    moveElement: ElementType | undefined,
    defender: Monster,
): string | null {
    if (!moveElement) return null;

    const m1 = getTypeMultiplier(moveElement, defender.element);
    const m2 = getTypeMultiplier(moveElement, defender.element2 ?? null);
    const total = m1 * m2;

    if (total === 0) return "그러나 아무 효과도 없는 것 같다...";
    if (total > 1.01) return "효과가 굉장했다!";
    if (total < 1) return "별로 효과가 없는 것 같다.";
    return null;
}

// 0~1 사이 값
function calcBaseCaptureRate(enemy: Monster): number {
    const hpRatio = enemy.hp / enemy.maxHp; // 0~1
    let rate = 0.3 + (1 - hpRatio) * 0.5; // 0.3 ~ 0.8

    const anyMon = enemy as any;
    const status = (anyMon.statusAilment ?? anyMon.status) as
        | "normal"
        | "sleep"
        | "paralysis"
        | "freeze"
        | "burn"
        | "poison"
        | undefined;

    if (status && status !== "normal") {
        rate += 0.1;
    }

    // 🔹 여기부터 quizmon_species 기반 보정 (enemy에 복사되어 있다고 가정)
    const rarity = (anyMon.rarity as number | undefined) ?? 1; // 1~5
    const isLegendary = Boolean(anyMon.is_legendary);
    const isMythical = Boolean(anyMon.is_mythical);

    // 희귀도가 높을수록 잡기 어렵게 (최대 -0.15 정도)
    const rarityPenalty = (rarity - 1) * 0.04; // rarity 1 → 0, rarity 5 → 0.16
    rate -= rarityPenalty;

    // 전설/신화면 추가 패널티
    if (isLegendary || isMythical) {
        rate -= 0.1;
    }

    // 안전 범위 클램프
    return Math.max(0.03, Math.min(0.9, rate));
}


export type UseQuizmonBattleOptions = {
    quizpack: QuizPackJsonV1 | null;
    roomId?: string | null;
    gameSessionId?: string | null;
    studentId?: string | null;
    onQuizAnswer?: (result: QuizAnswerResult) => void;
    onBattleEnd?: (summary: { correct: number; total: number }) => void;
    profileId?: string | null;
    /**
     * 배틀 모드:
     *  - "normal": 기존 수업/던전/레이드 배틀
     *  - "ghost": 저장된 고스트 기록과 다시 싸우는 배틀
     */
    mode?: "normal" | "ghost";
    /**
     * 고스트 배틀 시 사용할 기록 (playerMonsters / enemyMonsters 를 그대로 사용)
     */
    ghostOpponent?: GhostBattleRecord | null;
};

export type UseQuizmonBattleResult = {
    // 배틀 상태 + setter (외부에서 resetBattleWithProfileParty 등에서 사용)
    state: BattleState;
    setState: Dispatch<SetStateAction<BattleState>>;

    // 퀴즈 관련
    questions: QuizQuestionLite[];
    questionIndex: number;
    setQuestionIndex: Dispatch<SetStateAction<number>>;
    questionOrder: number[];
    setQuestionOrder: Dispatch<SetStateAction<number[]>>;

    // 통계
    battleStats: { correct: number; total: number };
    setBattleStats: Dispatch<
        SetStateAction<{ correct: number; total: number }>
    >;
    hasReportedEnd: boolean;
    setHasReportedEnd: Dispatch<SetStateAction<boolean>>;

    // 파생 값들
    playerMon: Monster;
    enemyMon: Monster;
    canSelectMove: boolean;
    accuracyPercent: number | null;
    battleFinished: boolean;

    damagePopups: DamagePopup[];

    // 🔹 포획 관련 (BattleView로 내려가는 값)
    canCapture: boolean;
    onRequestCapture: () => void;
    captureUi: CaptureUiState;
    captureHandlers: CaptureOverlayHandlers;
    
    // 액션
    handleSelectMove: (move: Move) => void;
    handleAnswer: (optionIndex: number) => void;
    handleSwitch: (targetIndex: number) => void;
};

export function useQuizmonBattle(
    options: UseQuizmonBattleOptions,
): UseQuizmonBattleResult {
    const {
        quizpack,
        roomId,
        gameSessionId,
        studentId,
        onQuizAnswer,
        onBattleEnd,
        mode = "normal",
        ghostOpponent = null,
        profileId = null,
    } = options;

    // 1) 전투 상태
    const [state, setState] = useState<BattleState>(() =>
        createInitialBattleState(),
    );
    const [questionIndex, setQuestionIndex] = useState(0);
    const [questionOrder, setQuestionOrder] = useState<number[]>([]);
    const [battleStats, setBattleStats] = useState({ correct: 0, total: 0 });
    const [hasReportedEnd, setHasReportedEnd] = useState(false);

    const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);

    // 2) 포획 상태
    const [captureUi, setCaptureUi] = useState<CaptureUiState>({
        phase: "hidden",
    });
    const [captureSession, setCaptureSession] =
        useState<CaptureSession | null>(null);
    const [captureBallStocks, setCaptureBallStocks] = useState<CaptureBallStock[]>([]);

    const isCapturing = captureUi.phase !== "hidden";

    // 3) 퀴즈 소스: quizpackJson → Lite 배열
    const questions: QuizQuestionLite[] = useMemo(
        () => (quizpack ? quizPackToLiteQuestions(quizpack) : []),
        [quizpack],
    );

    // quizpack이 준비되면 한 번 문제 순서를 섞어 둔다
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

    // 현재 출전 중인 포켓몬 (참조)
    const playerMon = useMemo(
        () => state.player.monsters[state.player.activeIndex],
        [state.player],
    );
    const enemyMon = useMemo(
        () => state.enemy.monsters[state.enemy.activeIndex],
        [state.enemy],
    );

    // 고스트 배틀 모드: 전달받은 ghostOpponent로 양측 파티 초기화
    useEffect(() => {
        if (mode !== "ghost") return;
        if (!ghostOpponent) return;

        setState((prev) => ({
            ...prev,
            player: {
                ...prev.player,
                monsters: ghostOpponent.playerMonsters.map((m) => ({ ...m })),
                activeIndex: 0,
            },
            enemy: {
                ...prev.enemy,
                monsters: ghostOpponent.enemyMonsters.map((m) => ({ ...m })),
                activeIndex: 0,
            },
        }));
    }, [mode, ghostOpponent]);

    /** 현재 질문 선택 (없으면 null)
     *  - questions: 원본 질문 배열
     *  - questionOrder: 랜덤으로 섞인 인덱스 배열
     *  - 보기(option)도 매번 섞어서 반환
     */
    function getNextQuestion(): QuizQuestionLite | null {
        if (!questions || questions.length === 0) return null;
        if (!questionOrder.length) return null;

        const orderIdx = questionIndex % questionOrder.length;
        const baseIdx = questionOrder[orderIdx];
        const baseQuestion = questions[baseIdx];
        if (!baseQuestion) return null;

        // 보기 인덱스를 셔플해서
        const optionIndices = baseQuestion.options.map((_, idx) => idx);
        const shuffledOptionIndices = shuffleArray(optionIndices);

        // 새 보기 배열과 정답 인덱스 계산
        const shuffledOptions = shuffledOptionIndices.map(
            (optIdx) => baseQuestion.options[optIdx],
        );

        const newAnswerIndex = shuffledOptionIndices.indexOf(
            baseQuestion.answerIndex,
        );

        // questionIndex +1
        setQuestionIndex((idx) => idx + 1);

        return {
            ...baseQuestion,
            options: shuffledOptions,
            answerIndex: newAnswerIndex,
        };
    }

    // 데미지 팝업
    const spawnDamagePopup = (
        target: "player" | "enemy",
        amount: number,
        isCritical: boolean,
        effectiveness: number,
    ) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const popup: DamagePopup = {
            id,
            target,
            amount,
            isCritical,
            effectiveness,
        };
        setDamagePopups((prev) => [...prev, popup]);

        // 0.8초 후 자동 제거
        window.setTimeout(() => {
            setDamagePopups((prev) => prev.filter((p) => p.id !== id));
        }, 800);
    };

    // =====================
    //   포획 관련 핸들러
    // =====================

    const handleRequestCapture = useCallback(() => {
        if (state.phase !== "command") return;
        const enemy = state.enemy.monsters[state.enemy.activeIndex];
        if (!enemy || enemy.hp <= 0) return;

        if (!profileId) {
            setState(prev =>
                pushLog(prev, "[시스템] 프로필 정보가 없어 포획을 시도할 수 없습니다."),
            );
            return;
        }

        // 🔹 클릭이 실제로 들어오는지 확인용
        console.log("[useQuizmonBattle] handleRequestCapture", {
            phase: state.phase,
            enemyHp: enemy.hp,
            profileId,
        });

        void (async () => {
            try {
                const balls = await getCaptureBallStocks(profileId);

                if (!balls.length) {
                    setState(prev =>
                        pushLog(prev, "[시스템] 사용할 수 있는 포획 볼이 없습니다."),
                    );
                    return;
                }

                const base = calcBaseCaptureRate(enemy);

                setCaptureSession({
                    enemy,
                    ballId: null,
                    ballLabel: null,
                    baseRate: base,
                    currentRate: base,
                    question: null,
                    success: null,
                    resultKind: null,
                    shardsGained: 0,
                });

                setCaptureBallStocks(balls);

                setCaptureUi({
                    phase: "encounter",
                    baseRate: base,
                    currentRate: base,
                    selectedBallLabel: undefined,
                    success: undefined,
                    resultKind: null,
                    shardsGained: 0,
                });
            } catch (err) {
                console.error("[useQuizmonBattle] handleRequestCapture error", err);
                setState(prev =>
                    pushLog(
                        prev,
                        "[시스템] 포획 정보를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
                    ),
                );
            }
        })();
    }, [state, profileId, setState]);


    // 볼 선택
    const handleSelectBall = useCallback(
        async (ballId: string) => {
            if (!captureSession) return;

            const ballMeta = await getCaptureBallMeta(ballId);
            // { id, label, rateBonus? }

            const base = captureSession.baseRate;
            const withBall = Math.max(
                0.01,
                Math.min(0.99, base + (ballMeta.rateBonus ?? 0)),
            );

            // 포획용 퀴즈: 일단 기존 퀴즈 풀 재사용
            const q = getNextQuestion();

            setCaptureSession((prev) =>
                prev
                    ? {
                        ...prev,
                        ballId,
                        ballLabel: ballMeta.label,
                        baseRate: base,
                        currentRate: withBall,
                        question: q,
                    }
                    : prev,
            );

            setCaptureUi((prev) => ({
                ...prev,
                phase: q ? "quiz" : "throw",
                baseRate: base,
                currentRate: withBall,
                selectedBallLabel: ballMeta.label,
            }));

            setState((prev) =>
                pushLog(prev,  `[플레이어] ${ballMeta.label}을(를) 꺼냈다.`),
            );
        },
        [captureSession],
    );

    const handleCaptureAnswer = useCallback(
        (index: number) => {
            if (!captureSession || !captureSession.question) return;

            const q = captureSession.question;
            const correct = index === q.answerIndex;

            // 🔹 정오답에 따라 현재 포획률 조정
            const rate = correct
                ? Math.min(0.99, captureSession.currentRate + 0.15)
                : Math.max(0.01, captureSession.currentRate - 0.15);

            setCaptureSession((prev) =>
                prev
                    ? {
                        ...prev,
                        currentRate: rate,
                    }
                    : prev,
            );

            // 🔹 UI는 throw 단계로 전환
            setCaptureUi((prev) => ({
                ...prev,
                phase: "throw",
                currentRate: rate,
            }));

            // 🔹 로그
            setState((prev) =>
                pushLog(
                    prev,
                    correct
                        ? "[플레이어] 퀴즈에 정답했다! 포획 확률이 올라간다."
                        : "[플레이어] 퀴즈를 틀렸다... 포획 확률이 떨어진다.",
                ),
            );
        },
        [captureSession],
    );

    const handleThrowAnimationFinished = useCallback(() => {
        if (!captureSession) {
            // 세션이 없으면 그냥 실패로 마무리
            setCaptureUi((prev) => ({
                ...prev,
                phase: "result",
                success: false,
                resultKind: null,
                shardsGained: 0,
            }));
            return;
        }

        // 🔹 최종 포획 확률 (퀴즈 및 볼 보정 포함)
        const rate =
            captureSession.currentRate ??
            captureSession.baseRate ??
            0.4;

        const roll = Math.random();
        const success = roll <= rate;

        // 프로필이 없으면 DB 보상 처리를 못하니, 실패처럼 처리
        if (!profileId || !success) {
            if (!profileId) {
                setState((prev) =>
                    pushLog(
                        prev,
                        "[시스템] 프로필 정보가 없어 포획 결과를 처리하지 못했습니다.",
                    ),
                );
            } else {
                setState((prev) =>
                    pushLog(
                        prev,
                        `[적] ${captureSession.enemy.name}이(가) 포켓볼에서 튀어나왔다!`,
                    ),
                );
            }

            setCaptureSession((prev) =>
                prev
                    ? {
                        ...prev,
                        success: false,
                        resultKind: null,
                        shardsGained: 0,
                    }
                    : prev,
            );

            setCaptureUi((prev) => ({
                ...prev,
                phase: "result",
                success: false,
                resultKind: null,
                shardsGained: 0,
            }));
            return;
        }

        // 🔹 성공 케이스: DB에 몬스터 지급 or 샤드 지급
        void (async () => {
            try {
                const r = await grantMonsterOrShards({
                    profileId,
                    speciesId: captureSession.enemy.speciesId,
                    source: "capture",
                });

                const resultKind = r.kind;
                const shards = r.shardsAwarded ?? 0;

                // 적 HP 0 처리 + 로그
                setState((prev) => {
                    const next = { ...prev };
                    const enemy = next.enemy.monsters[next.enemy.activeIndex];
                    if (enemy) enemy.hp = 0;

                    const logText =
                        resultKind === "duplicate"
                            ? `[시스템] ${captureSession.enemy.name}은(는) 이미 보유 중이어서 Star Shards x${shards}로 변했다.`
                            : `[시스템] ${captureSession.enemy.name}을(를) 포획했다!`;

                    return pushLog(next, logText);
                });

                setCaptureSession((prev) =>
                    prev
                        ? {
                            ...prev,
                            success: true,
                            resultKind,
                            shardsGained: shards,
                        }
                        : prev,
                );

                setCaptureUi((prev) => ({
                    ...prev,
                    phase: "result",
                    success: true,
                    resultKind,
                    shardsGained: shards,
                }));
            } catch (err) {
                console.error("[capture] grantMonsterOrShards error", err);
                setState((prev) =>
                    pushLog(
                        prev,
                        "[시스템] 포획 결과 처리 중 오류가 발생했습니다.",
                    ),
                );

                setCaptureSession((prev) =>
                    prev
                        ? {
                            ...prev,
                            success: false,
                            resultKind: null,
                            shardsGained: 0,
                        }
                        : prev,
                );
                setCaptureUi((prev) => ({
                    ...prev,
                    phase: "result",
                    success: false,
                    resultKind: null,
                    shardsGained: 0,
                }));
            }
        })();
    }, [captureSession, profileId]);


    const handleResultClose = useCallback(() => {
        const success = captureSession?.success ?? false;

        if (success) {
            setState((prev) => {
                if (prev.enemy.monsters.every((m) => m.hp <= 0)) {
                    return {
                        ...prev,
                        phase: "finished",
                    };
                }
                return prev;
            });
        }

        setCaptureUi({ phase: "hidden" });
        setCaptureSession(null);
    }, [captureSession]);

    // =====================
    //   스킬 선택/교체/정답 처리
    // =====================

    const handleSelectMove = (move: Move) => {
        if (state.phase === "finished") return;
        if (playerMon.hp <= 0 || enemyMon.hp <= 0) return;
        if (!questions.length) {
            setState((prev) =>
                pushLog(prev, "[시스템] 이 퀴즈팩에는 문제가 없습니다."),
            );
            return;
        }

        const question = getNextQuestion();
        if (!question) {
            setState((prev) =>
                pushLog(prev, "[시스템] 문제를 불러오는 중 오류가 발생했습니다."),
            );
            return;
        }

        const now = Date.now();

        setState((prev) => ({
            ...prev,
            pendingPlayerMove: { side: "player", move },
            pendingPlayerSwitchIndex: null,
            currentQuestion: question,
            questionStartedAt: now,
            lastQuizResult: null,
            phase: "quiz",
        }));
    };

    const handleSwitch = (targetIndex: number) => {
        if (state.phase === "finished") return;
        if (state.phase !== "command") return;

        const targetMon = state.player.monsters[targetIndex];
        if (!targetMon) return;
        if (targetIndex === state.player.activeIndex) return;
        if (targetMon.hp <= 0) return;

        if (!questions.length) {
            setState((prev) =>
                pushLog(prev, "[시스템] 이 퀴즈팩에는 문제가 없습니다."),
            );
            return;
        }

        const question = getNextQuestion();
        if (!question) {
            setState((prev) =>
                pushLog(prev, "[시스템] 문제를 불러오는 중 오류가 발생했습니다."),
            );
            return;
        }

        const now = Date.now();

        setState((prev) => ({
            ...prev,
            pendingPlayerMove: null,
            pendingEnemyMove: null,
            pendingPlayerSwitchIndex: targetIndex,
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

        const raidDamage = correct ? 10 : 0;

        setBattleStats((prev) => ({
            correct: prev.correct + (correct ? 1 : 0),
            total: prev.total + 1,
        }));

        onQuizAnswer?.(quizResult);

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
                    raidDamage,
                },
            });
        } else {
            console.warn("[QuizMonGame] skip logGameEvent – missing ids", {
                roomId,
                gameSessionId,
                studentId,
            });
        }

        setState((prev) => {
            const hasPendingSwitch = prev.pendingPlayerSwitchIndex != null;
            const hasPendingMove = !!prev.pendingPlayerMove;

            if (!hasPendingMove && !hasPendingSwitch) {
                return {
                    ...prev,
                    lastQuizResult: quizResult,
                    lastPlayerMoveId: null,
                    lastEnemyMoveId: null,
                    phase: "command",
                    currentQuestion: null,
                    questionStartedAt: null,
                };
            }

            const playerMoveId = prev.pendingPlayerMove?.move.id ?? null;
            const enemyMoveId = prev.pendingEnemyMove?.move.id ?? null;

            let next: BattleState = {
                ...prev,
                lastQuizResult: quizResult,
                lastPlayerMoveId: playerMoveId,
                lastEnemyMoveId: enemyMoveId,
            };

            // 1) 교체 액션 우선 처리
            if (hasPendingSwitch) {
                const switchIndex = prev.pendingPlayerSwitchIndex!;
                const targetMonBeforeCheck = prev.player.monsters[switchIndex];

                if (!targetMonBeforeCheck || targetMonBeforeCheck.hp <= 0) {
                    next = pushLog(
                        next,
                        "[시스템] 교체 대상 포켓몬이 유효하지 않아 교체에 실패했습니다.",
                    );

                    return {
                        ...next,
                        pendingPlayerMove: null,
                        pendingEnemyMove: null,
                        pendingPlayerSwitchIndex: null,
                        currentQuestion: null,
                        questionStartedAt: null,
                        phase: "command",
                        lastPlayerMoveId: null,
                        lastEnemyMoveId: null,
                    };
                }

                next = {
                    ...next,
                    player: {
                        ...next.player,
                        activeIndex: switchIndex,
                    },
                };

                const switchedMon =
                    next.player.monsters[next.player.activeIndex];

                if (quizResult.correct) {
                    next = pushLog(
                        next,
                        `[시스템] 문제를 맞추고 ${switchedMon.name}(으)로 안전하게 교체했습니다.`,
                    );

                    return {
                        ...next,
                        pendingPlayerMove: null,
                        pendingEnemyMove: null,
                        pendingPlayerSwitchIndex: null,
                        currentQuestion: null,
                        questionStartedAt: null,
                        phase: "command",
                        lastPlayerMoveId: null,
                        lastEnemyMoveId: null,
                    };
                }

                next = pushLog(
                    next,
                    `[시스템] 문제를 틀려 교체 도중 공격을 받았습니다!`,
                );

                const enemyActive =
                    next.enemy.monsters[next.enemy.activeIndex];
                const defenderBefore =
                    next.player.monsters[next.player.activeIndex];

                const enemyMove = enemyActive?.moves?.[0];

                if (enemyActive && enemyActive.hp > 0 && enemyMove) {
                    const enemyQuizMod = 1.0;
                    const enemyHitChance = calcHitChance(
                        defenderBefore,
                        enemyMove,
                        enemyQuizMod,
                    );

                    next = { ...next, lastEnemyMoveId: enemyMove.id };

                    let enemyLog = `[적] ${enemyMove.name}으로 교체한 ${defenderBefore.name}(을)를 노렸습니다! `;
                    if (rollHit(enemyHitChance)) {
                        const {
                            damage: dmg,
                            isCritical,
                            effectiveness,
                        } = calcDamageWithContext(
                            enemyActive,
                            defenderBefore,
                            enemyMove,
                        );

                        const damaged = applyDamageToMonster(
                            defenderBefore,
                            dmg,
                        );
                        const newPlayerMons = [...next.player.monsters];
                        newPlayerMons[next.player.activeIndex] = damaged;

                        next = {
                            ...next,
                            player: {
                                ...next.player,
                                monsters: newPlayerMons,
                            },
                        };

                        enemyLog += `${dmg} 데미지! (HP ${defenderBefore.hp} → ${damaged.hp})`;

                        const effComment = getEffectivenessComment(
                            enemyMove.element,
                            defenderBefore,
                        );
                        if (effComment) {
                            enemyLog += ` ${effComment}`;
                        }
                        if (isCritical) {
                            enemyLog += " 급소에 맞았다!";
                        }

                        spawnDamagePopup(
                            "player",
                            dmg,
                            isCritical,
                            effectiveness,
                        );
                    } else {
                        enemyLog += "하지만 빗나갔다!";
                    }

                    next = pushLog(next, enemyLog);
                }

                const playerMonsAfter = next.player.monsters;
                const enemyMonsAfter = next.enemy.monsters;

                if (
                    playerMonsAfter[next.player.activeIndex] &&
                    playerMonsAfter[next.player.activeIndex].hp <= 0
                ) {
                    const nextAliveIndex = playerMonsAfter.findIndex(
                        (m) => m.hp > 0,
                    );
                    if (
                        nextAliveIndex >= 0 &&
                        nextAliveIndex !== next.player.activeIndex
                    ) {
                        next = {
                            ...next,
                            player: {
                                ...next.player,
                                activeIndex: nextAliveIndex,
                            },
                        };
                        next = pushLog(
                            next,
                            `[시스템] ${playerMonsAfter[nextAliveIndex].name}(이)가 대신 싸우러 나왔습니다!`,
                        );
                    }
                }

                if (
                    enemyMonsAfter[next.enemy.activeIndex] &&
                    enemyMonsAfter[next.enemy.activeIndex].hp <= 0
                ) {
                    const nextAliveIndex = enemyMonsAfter.findIndex(
                        (m) => m.hp > 0,
                    );
                    if (
                        nextAliveIndex >= 0 &&
                        nextAliveIndex !== next.enemy.activeIndex
                    ) {
                        next = {
                            ...next,
                            enemy: {
                                ...next.enemy,
                                activeIndex: nextAliveIndex,
                            },
                        };
                        next = pushLog(
                            next,
                            `[시스템] 상대의 ${enemyMonsAfter[nextAliveIndex].name}(이)가 대신 나왔습니다!`,
                        );
                    }
                }

                const playerAllFainted = next.player.monsters.every(
                    (m) => m.hp <= 0,
                );
                const enemyAllFainted = next.enemy.monsters.every(
                    (m) => m.hp <= 0,
                );

                if (playerAllFainted || enemyAllFainted) {
                    next = {
                        ...next,
                        phase: "finished",
                    };
                    const resultText = playerAllFainted
                        ? enemyAllFainted
                            ? "무승부!"
                            : "패배…"
                        : "승리!";
                    next = pushLog(
                        next,
                        `[시스템] 배틀 종료: ${resultText}`,
                    );
                } else {
                    next = {
                        ...next,
                        phase: "command",
                    };
                }

                return {
                    ...next,
                    pendingPlayerMove: null,
                    pendingEnemyMove: null,
                    pendingPlayerSwitchIndex: null,
                    currentQuestion: null,
                    questionStartedAt: null,
                };
            }

            const prevPlayerMon =
                prev.player.monsters[prev.player.activeIndex];
            const prevEnemyMon =
                prev.enemy.monsters[prev.enemy.activeIndex];

            const pendingPlayerMove = prev.pendingPlayerMove;
            if (!pendingPlayerMove) {
                return {
                    ...next,
                    pendingPlayerMove: null,
                    pendingEnemyMove: null,
                    pendingPlayerSwitchIndex: null,
                    currentQuestion: null,
                    questionStartedAt: null,
                    phase: "command",
                };
            }

            // 1) 플레이어 공격
            const quizMod = calcQuizMod(quizResult);
            const hitChance = calcHitChance(
                prevEnemyMon,
                pendingPlayerMove.move,
                quizMod,
            );

            let playerLog = `[플레이어] ${pendingPlayerMove.move.name}을(를) 사용했다! (명중률 ${hitChance.toFixed(
                1,
            )}%) `;
            if (rollHit(hitChance)) {
                const {
                    damage: dmg,
                    isCritical,
                    effectiveness,
                } = calcDamageWithContext(
                    prevPlayerMon,
                    prevEnemyMon,
                    pendingPlayerMove.move,
                );

                const newEnemyMon = applyDamageToMonster(prevEnemyMon, dmg);

                const newEnemyMons = [...prev.enemy.monsters];
                newEnemyMons[prev.enemy.activeIndex] = newEnemyMon;

                next = {
                    ...next,
                    enemy: {
                        ...prev.enemy,
                        monsters: newEnemyMons,
                    },
                    lastPlayerMoveId: pendingPlayerMove.move.id,
                };

                playerLog += `${dmg} 데미지! (HP ${prevEnemyMon.hp} → ${newEnemyMon.hp})`;

                const effComment = getEffectivenessComment(
                    pendingPlayerMove.move.element,
                    prevEnemyMon,
                );
                if (effComment) {
                    playerLog += ` ${effComment}`;
                }

                if (isCritical) {
                    playerLog += " 급소에 맞았다!";
                }

                spawnDamagePopup("enemy", dmg, isCritical, effectiveness);
            } else {
                playerLog += "하지만 빗나갔다!";
                next = {
                    ...next,
                    lastPlayerMoveId: pendingPlayerMove.move.id,
                };
            }

            next = pushLog(next, playerLog);

            // 2) 적이 살아있으면 적도 공격
            if (next.enemy.monsters[next.enemy.activeIndex].hp > 0) {
                const pendingEnemyMove = prev.pendingEnemyMove;
                if (pendingEnemyMove) {
                    const enemyQuizMod = 1.0;
                    const enemyHitChance = calcHitChance(
                        prevPlayerMon,
                        pendingEnemyMove.move,
                        enemyQuizMod,
                    );

                    let enemyLog = `[적] ${pendingEnemyMove.move.name}을(를) 사용했다! `;
                    if (rollHit(enemyHitChance)) {
                        const {
                            damage: dmg,
                            isCritical,
                            effectiveness,
                        } = calcDamageWithContext(
                            prevEnemyMon,
                            prevPlayerMon,
                            pendingEnemyMove.move,
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
                            lastEnemyMoveId: pendingEnemyMove.move.id,
                        };

                        enemyLog += `${dmg} 데미지! (HP ${prevPlayerMon.hp} → ${newPlayerMon.hp})`;

                        const effComment = getEffectivenessComment(
                            pendingEnemyMove.move.element,
                            prevPlayerMon,
                        );
                        if (effComment) {
                            enemyLog += ` ${effComment}`;
                        }
                        if (isCritical) {
                            enemyLog += " 급소에 맞았다!";
                        }

                        spawnDamagePopup(
                            "player",
                            dmg,
                            isCritical,
                            effectiveness,
                        );
                    } else {
                        enemyLog += "빗나갔다!";
                        next = {
                            ...next,
                            lastEnemyMoveId: pendingEnemyMove.move.id,
                        };
                    }

                    next = pushLog(next, enemyLog);
                } else {
                    next = {
                        ...next,
                        lastEnemyMoveId: null,
                    };
                }
            } else {
                next = {
                    ...next,
                    lastEnemyMoveId: null,
                };
            }

            // 2.5) 스페셜 게이지 갱신
            {
                const prevActiveIdx = prev.player.activeIndex;
                const prevMonForGauge =
                    prev.player.monsters[prevActiveIdx];

                const specialMoveId =
                    prevMonForGauge.moves[1]?.id ?? null;
                const usedMoveId = pendingPlayerMove.move.id;
                const isSpecialMove =
                    !!specialMoveId && usedMoveId === specialMoveId;

                let newGauge = prevMonForGauge.specialGauge ?? 0;
                const maxGauge = prevMonForGauge.maxSpecialGauge ?? 3;

                if (quizResult.correct) {
                    if (isSpecialMove) {
                        newGauge = 0;
                    } else {
                        newGauge = Math.min(maxGauge, newGauge + 1);
                    }
                } else {
                    if (isSpecialMove) {
                        newGauge = 0;
                    }
                }

                const curPlayerMons = [...next.player.monsters];
                const currentMon = curPlayerMons[prevActiveIdx];

                curPlayerMons[prevActiveIdx] = {
                    ...currentMon,
                    specialGauge: newGauge,
                    maxSpecialGauge: maxGauge,
                };

                next = {
                    ...next,
                    player: {
                        ...next.player,
                        monsters: curPlayerMons,
                    },
                };
            }

            // 3) 승패 체크 + 파티 교체
            const playerMons = next.player.monsters;
            const enemyMons = next.enemy.monsters;

            if (playerMons[next.player.activeIndex]?.hp <= 0) {
                const nextAliveIndex = playerMons.findIndex((m) => m.hp > 0);
                if (
                    nextAliveIndex >= 0 &&
                    nextAliveIndex !== next.player.activeIndex
                ) {
                    next = {
                        ...next,
                        player: {
                            ...next.player,
                            activeIndex: nextAliveIndex,
                        },
                    };
                    next = pushLog(
                        next,
                        `[시스템] ${playerMons[nextAliveIndex].name}(이)가 대신 싸우러 나왔습니다!`,
                    );
                }
            }

            if (enemyMons[next.enemy.activeIndex]?.hp <= 0) {
                const nextAliveIndex = enemyMons.findIndex((m) => m.hp > 0);
                if (
                    nextAliveIndex >= 0 &&
                    nextAliveIndex !== next.enemy.activeIndex
                ) {
                    next = {
                        ...next,
                        enemy: {
                            ...next.enemy,
                            activeIndex: nextAliveIndex,
                        },
                    };
                    next = pushLog(
                        next,
                        `[시스템] 상대의 ${enemyMons[nextAliveIndex].name}(이)가 대신 나왔습니다!`,
                    );
                }
            }

            const playerAllFainted = next.player.monsters.every(
                (m) => m.hp <= 0,
            );
            const enemyAllFainted = next.enemy.monsters.every(
                (m) => m.hp <= 0,
            );

            if (playerAllFainted || enemyAllFainted) {
                next = {
                    ...next,
                    phase: "finished",
                };
                const resultText = playerAllFainted
                    ? enemyAllFainted
                        ? "무승부!"
                        : "패배…"
                    : "승리!";
                next = pushLog(
                    next,
                    `[시스템] 배틀 종료: ${resultText}`,
                );
            } else {
                next = {
                    ...next,
                    phase: "command",
                };
            }

            return {
                ...next,
                pendingPlayerMove: null,
                pendingEnemyMove: null,
                pendingPlayerSwitchIndex: null,
                currentQuestion: null,
                questionStartedAt: null,
            };
        });
    };

    // 적은 일단 영구히 첫 번째 기술만 쓰는 더미 AI
    useEffect(() => {
        if (!state.pendingEnemyMove && state.phase === "command") {
            const enemyMove = enemyMon.moves[0];
            if (!enemyMove) return;
            setState((prev) => ({
                ...prev,
                pendingEnemyMove: {
                    side: "enemy",
                    move: enemyMove,
                },
            }));
        }
    }, [state.phase, state.pendingEnemyMove, enemyMon]);

    // 배틀 종료 시 콜백 + 고스트 저장
    const accuracyPercent =
        battleStats.total > 0
            ? Math.round((battleStats.correct / battleStats.total) * 100)
            : null;

    useEffect(() => {
        const finished = state.phase === "finished";
        if (!finished) return;
        if (battleStats.total <= 0) return;

        if (onBattleEnd && !hasReportedEnd) {
            onBattleEnd({ ...battleStats });
            setHasReportedEnd(true);
        }

        try {
            const record: GhostBattleRecord = {
                id:
                    typeof crypto !== "undefined" &&
                    typeof crypto.randomUUID === "function"
                        ? crypto.randomUUID()
                        : `${Date.now()}`,
                createdAt: new Date().toISOString(),
                source: roomId ? "class" : "solo",
                quizPackId: quizpack?.pack?.id ?? null,
                stats: {
                    correct: battleStats.correct,
                    total: battleStats.total,
                    accuracy: accuracyPercent ?? 0,
                },
                playerMonsters: state.player.monsters,
                enemyMonsters: state.enemy.monsters,
            };

            saveGhostBattle(record);
        } catch (err) {
            console.warn("[useQuizmonBattle] saveGhostBattle error", err);
        }
    }, [
        state.phase,
        state.player.monsters,
        state.enemy.monsters,
        battleStats,
        accuracyPercent,
        onBattleEnd,
        hasReportedEnd,
        roomId,
        quizpack,
    ]);

    const canSelectMove =
        state.phase !== "finished" &&
        questions.length > 0 &&
        playerMon.hp > 0 &&
        enemyMon.hp > 0 &&
        !isCapturing;

    const battleFinished =
        state.player.monsters.every((m) => m.hp <= 0) ||
        state.enemy.monsters.every((m) => m.hp <= 0);

    const canCapture =
        state.phase === "command" &&
        playerMon.hp > 0 &&
        enemyMon.hp > 0 &&
        !battleFinished &&
        !isCapturing;

    const captureHandlers: CaptureOverlayHandlers = {
        availableBalls: captureBallStocks.map(({ id, label, quantity }) => ({
            id,
            label,
            quantity,
        })),
        onSelectBall: handleSelectBall,
        onRun: () => {
            setCaptureUi({ phase: "hidden" });
            setCaptureSession(null);
            setState((prev) =>
                pushLog(prev, "[플레이어] 도망치기로 했다."),
            );
        },
        question: captureSession?.question ?? null,
        onAnswer: handleCaptureAnswer,
        onThrowAnimationFinished: handleThrowAnimationFinished,
        onResultClose: handleResultClose,
    };

    return {
        state,
        setState,
        questions,
        questionIndex,
        setQuestionIndex,
        questionOrder,
        setQuestionOrder,
        battleStats,
        setBattleStats,
        hasReportedEnd,
        setHasReportedEnd,
        playerMon,
        enemyMon,
        canSelectMove,
        accuracyPercent,
        battleFinished,
        damagePopups,
        handleSelectMove,
        handleAnswer,
        handleSwitch,
        // 포획 관련
        canCapture,
        onRequestCapture: handleRequestCapture,
        captureUi,
        captureHandlers,
    };
}
