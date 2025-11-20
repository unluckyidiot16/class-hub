// src/games/quizmon/types.ts

export type ElementType = "normal" | "fire" | "water" | "grass" | "electric";

export type Trainer = {
    id: string;
    name: string;
    passiveDescription: string;
    skillName: string;
    skillDescription: string;
};

export type Move = {
    id: string;
    name: string;
    power: number; // 0 이면 순수 보조 기술
    baseAcc: number; // 0~100
    element: ElementType;
};

export type Monster = {
    id: string;
    name: string;
    element: ElementType;
    maxHp: number;
    hp: number;
    atk: number;
    def: number;
    spd: number;
    accStage: number; // 명중 보정 (1.0이 기본)
    evaStage: number; // 회피 보정 (1.0이 기본)
    moves: Move[];
};

export type BattleSide = {
    trainer: Trainer;
    monsters: Monster[];
    activeIndex: number; // 현재 전투 중인 몬스터 인덱스
};

export type QuizQuestionLite = {
    id: string;
    prompt: string;
    options: string[];
    answerIndex: number;
};

export type QuizAnswerResult = {
    questionId: string;
    correct: boolean;
    chosenIndex: number;
    timeMs: number;
};

export type TurnPhase = "command" | "quiz" | "resolve" | "finished";

export type PendingMove = {
    side: "player" | "enemy";
    move: Move;
};

export type BattleLogEntry = {
    id: string;
    text: string;
};

export type BattleState = {
    player: BattleSide;
    enemy: BattleSide;
    phase: TurnPhase;
    turn: number;
    pendingPlayerMove: PendingMove | null;
    pendingEnemyMove: PendingMove | null; // 샌드박스에서는 랜덤 선택
    currentQuestion: QuizQuestionLite | null;
    questionStartedAt: number | null;
    lastQuizResult: QuizAnswerResult | null;
    logs: BattleLogEntry[];
};

// DB row 타입
export type QuizmonPartner = {
    speciesId: string;   // "starter-001" 등
    level: number;
    exp: number;
};

export type QuizmonProfileRow = {
    id: string;
    student_key: string;
    partner: QuizmonPartner;
    total_raids: number;
    total_correct: number;
    total_questions: number;
    created_at: string | null;
    updated_at: string | null;
};

/** 새 프로필 생성 시 기본 파트너 값 */
export const DEFAULT_PARTNER: QuizmonPartner = {
    speciesId: "starter-001",
    level: 1,
    exp: 0,
};
