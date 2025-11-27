// src/games/pemmon/pemmonTypes.ts

export type QuizPackRow = {
    id: string;
    title: string;
    subject: string | null;
    grade: string | null;
};

export type QuizQuestionRow = {
    id: string;
    pack_id: string;
    text: string;
    options: string[] | null;
    answer_index: number | null;
};

export type Species = {
    id: number;
    name: string;
    maxHp: number;
    atk: number;
    def: number;
    height: number;
    generation?: string | null;
    isLegendary?: boolean;
    spriteUrl?: string | null;

    type1?: string | null;
};


export type PartnerState = {
    species: Species;
    level: number;
    exp: number;
    maxHp: number;
};

export type SubmissionRow = {
    id: string;
    class_id: string;
    student_key: string;
    trainer_name: string;
    partner_species: number;
    partner_level: number;
    partner_stats: {
        maxHp: number;
        atk: number;
        def: number;
    };
    coins: number;
    updated_at: string;

    total_training_sessions?: number | null;
    total_training_questions?: number | null;
    total_training_correct?: number | null;
    last_training_at?: string | null;
};

export type ViewState = "intro" | "lobby" | "pvp" | "dex";

export type TrainingState =
    | { phase: "idle" }
    | {
    phase: "quiz";
    questions: QuizQuestionRow[];
    index: number;
    correctCount: number;
    selectedIndex: number | null;
    isAnswered: boolean;
    isCorrect: boolean | null;
}
    | {
    phase: "result";
    total: number;
    correct: number;
    expGain: number;
    coinGain: number;
};
