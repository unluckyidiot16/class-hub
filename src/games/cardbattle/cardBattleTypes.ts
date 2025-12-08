// src/games/cardbattle/cardBattleTypes.ts

export type Subject = "kor" | "eng" | "math" | "social" | "science";

export type CardBase = {
    id: string;
};

export type AttackCard = CardBase & {
    type: "attack";
    subject: Subject;
};

export type DefenseCard = CardBase & {
    type: "defense";
};

export type Card = AttackCard | DefenseCard;

export type PlayerId = "P1" | "P2";

export type PlayerState = {
    id: PlayerId;
    name: string;
    deck: Card[];
    hand: Card[];
    discard: Card[];
    /** 내가 상대에게 성공시킨 공격 횟수 (0~3) */
    hitsGiven: number;
};

export type GameStatus = "waiting" | "playing" | "finished";

/**
 * 한 번의 공격 시 떠 있는 문제 정보
 */
export type ActiveQuestion = {
    subject: Subject;
    questionId: string;
    attackerId: PlayerId;
    defenderId: PlayerId;
    /** 이 시각(ms) 이후에는 시간 초과 처리 */
    deadlineAt: number;
};

export type GameState = {
    status: GameStatus;
    currentTurn: PlayerId;
    players: Record<PlayerId, PlayerState>;
    activeQuestion?: ActiveQuestion;
    winnerId?: PlayerId;
};
