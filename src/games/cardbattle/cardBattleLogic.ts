// src/games/cardbattle/cardBattleLogic.ts
import type {
    ActiveQuestion,
    Card,
    GameState,
    PlayerId,
    PlayerState,
    Subject,
} from "./cardBattleTypes";

const SUBJECTS: Subject[] = ["kor", "eng", "math", "social", "science"];
const MAX_HITS_TO_WIN = 3;
const MAX_HAND_SIZE = 5;

/** 간단한 셔플 (Fisher-Yates) */
export function shuffle<T>(arr: T[]): T[] {
    const result = arr.slice();
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * 기본 덱 구성:
 * - 공격 카드: 과목 5개 × 2장 = 10장
 * - 방어 카드: 5장
 */
export function createInitialDeck(): Card[] {
    const cards: Card[] = [];

    // 공격 카드 10장 (각 과목 2장)
    for (const subject of SUBJECTS) {
        for (let i = 0; i < 2; i++) {
            cards.push({
                id: `atk-${subject}-${i}`,
                type: "attack",
                subject,
            });
        }
    }

    // 방어 카드 5장
    for (let i = 0; i < 5; i++) {
        cards.push({
            id: `def-${i}`,
            type: "defense",
        });
    }

    return shuffle(cards);
}

function drawUpTo(hand: Card[], deck: Card[], maxSize: number): {
    hand: Card[];
    deck: Card[];
} {
    const newHand = hand.slice();
    const newDeck = deck.slice();

    while (newHand.length < maxSize && newDeck.length > 0) {
        const card = newDeck.shift()!;
        newHand.push(card);
    }

    return { hand: newHand, deck: newDeck };
}

function createPlayerState(id: PlayerId, name: string, deck: Card[]): PlayerState {
    // 시작 시 5장 드로우
    const { hand, deck: remainingDeck } = drawUpTo([], deck, MAX_HAND_SIZE);
    return {
        id,
        name,
        deck: remainingDeck,
        hand,
        discard: [],
        hitsGiven: 0,
    };
}

export function getOpponentId(playerId: PlayerId): PlayerId {
    return playerId === "P1" ? "P2" : "P1";
}

/**
 * 게임을 새로 시작할 때 호출.
 * 두 플레이어 이름만 넣으면 GameState 생성.
 */
export function createInitialGameState(p1Name: string, p2Name: string): GameState {
    const deck1 = createInitialDeck();
    const deck2 = createInitialDeck();

    const p1 = createPlayerState("P1", p1Name, deck1);
    const p2 = createPlayerState("P2", p2Name, deck2);

    return {
        status: "playing",
        currentTurn: "P1",
        players: {
            P1: p1,
            P2: p2,
        },
        activeQuestion: undefined,
        winnerId: undefined,
    };
}

/**
 * 공격 카드를 사용하여 문제를 여는 단계.
 * - UI 측에서 이미 subject / questionId 선정 후 호출.
 * - 아직 문제 정답 여부는 모른다 → activeQuestion만 세팅.
 */
export function playAttackCard(
    state: GameState,
    attackerId: PlayerId,
    cardId: string,
    subject: Subject,
    questionId: string,
    nowMs: number,
    timeLimitMs = 7000,
): GameState {
    if (state.status !== "playing") return state;
    if (state.activeQuestion) return state; // 이미 문제 진행 중이면 무시
    if (state.currentTurn !== attackerId) return state;

    const attacker = state.players[attackerId];
    const card = attacker.hand.find((c) => c.id === cardId);

    if (!card || card.type !== "attack") return state;

    const newHand = attacker.hand.filter((c) => c.id !== cardId);
    const newDiscard = [...attacker.discard, card];

    const defenderId = getOpponentId(attackerId);

    const activeQuestion: ActiveQuestion = {
        subject,
        questionId,
        attackerId,
        defenderId,
        deadlineAt: nowMs + timeLimitMs,
    };

    return {
        ...state,
        activeQuestion,
        players: {
            ...state.players,
            [attackerId]: {
                ...attacker,
                hand: newHand,
                discard: newDiscard,
            },
        },
    };
}

/**
 * 방어 카드 사용:
 * - 현재 activeQuestion이 있을 때만 사용 가능
 * - 해당 플레이어 손패에서 방어 카드 1장을 제거
 * - 해당 공격은 "정답 처리"와 동일하게 취급
 */
export function useDefenseCard(state: GameState, defenderId: PlayerId): GameState {
    if (state.status !== "playing") return state;
    if (!state.activeQuestion) return state;
    if (state.activeQuestion.defenderId !== defenderId) return state;

    const defender = state.players[defenderId];
    const defenseIndex = defender.hand.findIndex((c) => c.type === "defense");
    if (defenseIndex === -1) return state; // 방어 카드 없음

    const defenseCard = defender.hand[defenseIndex];

    const newHand = defender.hand.filter((c) => c.id !== defenseCard.id);
    const newDiscard = [...defender.discard, defenseCard];

    const updated: GameState = {
        ...state,
        players: {
            ...state.players,
            [defenderId]: {
                ...defender,
                hand: newHand,
                discard: newDiscard,
            },
        },
    };

    // 방어 카드는 "강제 정답" 취급
    return resolveQuizResult(updated, true);
}

/**
 * 문제 정답/오답 판정 처리
 * - correct: true → 공격 실패, 히트 증가 없음
 * - correct: false → 공격 성공, 공격자 hitsGiven +1
 * - 그 후 턴은 공격자의 상대에게 넘어감
 */
export function resolveQuizResult(state: GameState, correct: boolean): GameState {
    const active = state.activeQuestion;
    if (state.status !== "playing" || !active) return state;

    const attackerId = active.attackerId;
    const defenderId = active.defenderId;
    const attacker = state.players[attackerId];
    const defender = state.players[defenderId];

    let newAttackerHits = attacker.hitsGiven;

    if (!correct) {
        newAttackerHits += 1;
    }

    // 기본적으로 턴은 공격자 → 수비자에게 넘어감
    const nextTurn = defenderId;

    // 승리 체크
    const attackerWins = newAttackerHits >= MAX_HITS_TO_WIN;

    // 다음 턴 플레이어의 드로우 처리
    const opponent = state.players[nextTurn];
    const { hand: newHand, deck: newDeck } = drawUpTo(
        opponent.hand,
        opponent.deck,
        MAX_HAND_SIZE,
    );

    return {
        ...state,
        status: attackerWins ? "finished" : "playing",
        currentTurn: attackerWins ? state.currentTurn : nextTurn,
        activeQuestion: undefined,
        winnerId: attackerWins ? attackerId : undefined,
        players: {
            ...state.players,
            [attackerId]: {
                ...attacker,
                hitsGiven: newAttackerHits,
            },
            [defenderId]: {
                ...defender,
            },
            [nextTurn]: {
                ...opponent,
                hand: newHand,
                deck: newDeck,
            },
        },
    };
}

/**
 * 시간 초과는 그냥 "오답"으로 처리.
 * (UI에서 deadline 체크 후 호출)
 */
export function handleTimeout(state: GameState): GameState {
    if (!state.activeQuestion) return state;
    return resolveQuizResult(state, false);
}
