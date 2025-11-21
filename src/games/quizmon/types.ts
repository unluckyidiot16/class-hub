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
    power: number;
    baseAcc: number;
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
    accStage: number;
    evaStage: number;
    moves: Move[];
};

export type BattleSide = {
    trainer: Trainer;
    monsters: Monster[];
    activeIndex: number;
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
    pendingEnemyMove: PendingMove | null;
    currentQuestion: QuizQuestionLite | null;
    questionStartedAt: number | null;
    lastQuizResult: QuizAnswerResult | null;
    logs: BattleLogEntry[];
};

// ------- DB row 타입들 -------

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

    // 새로 추가한 컬럼들
    trainer_name: string | null;
    starter_species_id: string | null;
    starter_chosen: boolean;

    // 🔹 새로 추가: 퀴즈몬 재화 (기본 코인)
    coins: number;  // NOT NULL DEFAULT 0
};


export type QuizmonOwnedMonsterRow = {
    id: string;
    profile_id: string;
    species_id: string;
    level: number;
    exp: number;
    party_slot: number | null;
    created_at: string | null;
    updated_at: string | null;
};

export const DEFAULT_PARTNER: QuizmonPartner = {
    speciesId: "poke-0001", // 이상해씨 (#001)
    level: 1,
    exp: 0,
};

