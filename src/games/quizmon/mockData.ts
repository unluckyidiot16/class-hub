// src/games/quizmon/mockData.ts
import type {
    BattleState,
    BattleSide,
    Monster,
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

// ✅ 플레이어용 샘플 몬스터 (피카츄 느낌)
const samplePlayerMon: Monster = {
        id: "player-001",
        speciesId: "poke-0025",
        name: "피카츄?", 
        element: "electric",
        level: 5,
        exp: 0,
        maxHp: 35,
        hp: 35,
        atk: 12,
        spAtk: 12,
        spDef: 10,
        def: 8,
        spd: 14,
        accStage: 0,
        evaStage: 0,
        status: "none",
        specialGauge: 0,
        maxSpecialGauge: 3,
        moves: [],
    };

// ✅ 적용 샘플 몬스터 (꼬부기 느낌)
const sampleEnemyMon: Monster = {
    id: "enemy-001", 
        speciesId: "poke-0007",
        name: "꼬부기?",
        element: "water",
        level: 5,
        exp: 0,
        maxHp: 30,
        hp: 30,
        atk: 10,
        spAtk: 11,
        spDef: 12,
        def: 10,
        spd: 10,
        accStage: 0,
        evaStage: 0,
        status: "none",
        specialGauge: 0,
        maxSpecialGauge: 3,
        moves: [],
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
