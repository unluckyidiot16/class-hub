// src/games/quizmon/mockData.ts
import type {
    BattleState,
    BattleSide,
    Monster,
    Move,
    QuizQuestionLite,
    Trainer,
} from "./types";

const basicTrainer: Trainer = {
    id: "t_basic",
    name: "기본 트레이너",
    passiveDescription: "수업용 기본 트레이너입니다.",
    skillName: "집중 지시",
    skillDescription:
        "다음 턴 아군 명중률을 약간 올립니다. (샌드박스에서는 미구현)",
};

const tackle: Move = {
    id: "m_tackle",
    name: "몸통박치기",
    power: 40,
    baseAcc: 100,
    element: "normal",
};

const thunder: Move = {
    id: "m_thunder",
    name: "번개",
    power: 110,
    baseAcc: 70,
    element: "electric",
};

const growl: Move = {
    id: "m_growl",
    name: "울음소리",
    power: 0,
    baseAcc: 100,
    element: "normal",
};

// ✅ 플레이어용 샘플 몬스터 (피카츄 느낌)
const samplePlayerMon: Monster = {
    spAtk: 15, spDef: 15,
    id: "p_001",                  // 개체 ID
    speciesId: "poke-0025",       // 종 ID (예: 피카츄)
    name: "스파크몽",
    element: "electric",

    level: 5,
    exp: 0,

    maxHp: 100,
    hp: 100,
    atk: 30,
    def: 15,
    spd: 20,

    accStage: 0,
    evaStage: 0,
    status: "none",

    // 명중률 계산용 덩치 정보
    pokedexNo: 25,
    heightM: 0.4,
    weightKg: 6.0,

    // 테스트용 스킬 3개 (최대 4개까지 권장)
    moves: [tackle, thunder, growl]
};

// ✅ 적용 샘플 몬스터 (꼬부기 느낌)
const sampleEnemyMon: Monster = {
    spAtk: 30, spDef: 30,
    id: "e_001",
    speciesId: "poke-0007",       // 예: 꼬부기
    name: "연습 슬라임",
    element: "water",

    level: 5,
    exp: 0,

    maxHp: 100,
    hp: 100,
    atk: 20,
    def: 10,
    spd: 10,

    accStage: 0,
    evaStage: 0,
    status: "none",

    pokedexNo: 7,
    heightM: 0.5,
    weightKg: 9.0,

    moves: [tackle]
};

export const sampleQuestions: QuizQuestionLite[] = [
    {
        id: "q1",
        prompt: "2 + 3 = ?",
        options: ["4", "5", "6", "7"],
        answerIndex: 1,
    },
    {
        id: "q2",
        prompt: "영어로 '고양이'는?",
        options: ["dog", "cat", "bird", "fish"],
        answerIndex: 1,
    },
];

function createSide(trainerId: "player" | "enemy"): BattleSide {
    const trainer =
        trainerId === "player"
            ? basicTrainer
            : { ...basicTrainer, id: "t_enemy", name: "연습 트레이너" };

    const mon = trainerId === "player" ? samplePlayerMon : sampleEnemyMon;

    return {
        trainer,
        monsters: [mon],
        activeIndex: 0,
    };
}

export function createInitialBattleState(): BattleState {
    return {
        player: createSide("player"),
        enemy: createSide("enemy"),
        phase: "command",
        turn: 1,
        pendingPlayerMove: null,
        pendingEnemyMove: null,
        pendingPlayerSwitchIndex: null,
        currentQuestion: null,
        questionStartedAt: null,
        lastQuizResult: null,
        logs: [],
        lastPlayerMoveId: null,  // ✅
        lastEnemyMoveId: null,   // ✅
    };
}
