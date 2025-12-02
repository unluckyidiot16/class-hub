// src/games/quizmon/dungeonEnemySets.ts

/** 던전 난이도 */
export type DungeonDifficulty = "easy" | "normal" | "hard";

/** 과목 메타 (필터/통계용, 아직 UI에서는 안 씀) */
export type DungeonSubject = "korean" | "math" | "science" | "general";

/** 학년 메타 (필터/통계용) */
export type DungeonGrade = 1 | 2 | 3 | 4 | 5 | 6;

/** 던전 메타 정보 */
export type DungeonConfig = {
    /** 던전 ID (내부 키) */
    id: string;

    /** UI에 표시되는 이름 */
    name: string;

    /** UI 설명 텍스트 */
    description: string;

    /** 난이도 (로직용) */
    difficulty: DungeonDifficulty;

    /** 난이도 라벨 (UI 표시용 한글) */
    difficultyLabel: string;

    /** 적 세트 키 (ENEMY_SETS의 key) */
    enemySetId: string;

    /**
     * 보상 배수
     * - result 화면에서 "보상 × 1.0" 같이 표기
     * - 실제 보상 계산 시 기본값에 곱해 쓰면 됨
     */
    rewardMultiplier: number;

    /** 추천 레벨 구간 (UI 표시용) */
    recommendedMinLevel: number;
    recommendedMaxLevel: number;

    arenaKey: string;
    
    /** 과목/학년 메타 (필요 시 필터에 사용) */
    subject?: DungeonSubject;
    grade?: DungeonGrade;
};

/** 적 슬롯: 한 마리 정보 */
export type EnemySlot = {
    /** quizmon_species.id (예: "poke-0001") */
    speciesId: string;
    /** 이 몬스터 레벨 */
    level: number;
};

/**
 * 던전 메타 정의
 * - 첫 번째 항목이 기본 선택값이 됨 (QuizMonGame에서 DUNGEON_CONFIGS[0])
 */
export const DUNGEON_CONFIGS: DungeonConfig[] = [
    {
        id: "forest-easy-1",
        name: "숲 1-1: 첫 퀴즈 던전",
        description: "2학년 국어 쉬운 문제와 약한 몬스터가 등장하는 입문 던전입니다.",
        difficulty: "easy",
        difficultyLabel: "쉬움",
        enemySetId: "forest-easy-1",
        rewardMultiplier: 1.0,
        recommendedMinLevel: 3,
        recommendedMaxLevel: 6,
        subject: "korean",
        grade: 2,
        arenaKey: "forest_bg",
    },
    {
        id: "forest-easy-2",
        name: "숲 1-2: 조금 더 안쪽",
        description: "조금 더 강해진 몬스터가 등장합니다. 여전히 입문용에 가깝습니다.",
        difficulty: "easy",
        difficultyLabel: "쉬움",
        enemySetId: "forest-easy-2",
        rewardMultiplier: 1.2,
        recommendedMinLevel: 5,
        recommendedMaxLevel: 8,
        subject: "korean",
        grade: 2,
        arenaKey: "forest_bg",
    },
    {
        id: "forest-normal-1",
        name: "숲 2-1: 진짜 실전",
        description: "파티가 어느 정도 성장했을 때 도전하는 실전형 던전입니다.",
        difficulty: "normal",
        difficultyLabel: "보통",
        enemySetId: "forest-normal-1",
        rewardMultiplier: 1.5,
        recommendedMinLevel: 8,
        recommendedMaxLevel: 12,
        subject: "korean",
        grade: 3,
        arenaKey: "forest_bg",
    },
    {
        id: "tower-normal-1",
        name: "연습 타워 1층",
        description: "스타터 최종 진화와 싸워 보는 연습용 타워입니다.",
        difficulty: "normal",
        difficultyLabel: "보통",
        enemySetId: "tower-set-1",
        rewardMultiplier: 2.0,
        recommendedMinLevel: 10,
        recommendedMaxLevel: 15,
        subject: "general",
        grade: 3,
        arenaKey: "forest_bg",
    },
];

/**
 * 적 세트 정의
 * - QuizMonGame.tsx에서 currentDungeon.enemySetId 로 접근
 * - 각 세트는 EnemySlot 배열
 */
export const ENEMY_SETS: Record<string, EnemySlot[]> = {
    /** 숲 1-1: 스타터 1단계들 */
    "forest-easy-1": [
        { speciesId: "poke-0001", level: 3 }, // 이상해씨
        { speciesId: "poke-0004", level: 3 }, // 파이리
        { speciesId: "poke-0007", level: 3 }, // 꼬부기
    ],

    /** 숲 1-2: 벌레/새 포켓몬 */
    "forest-easy-2": [
        { speciesId: "poke-0010", level: 5 }, // 캐터피
        { speciesId: "poke-0013", level: 6 }, // 뿔충이
        { speciesId: "poke-0016", level: 7 }, // 구구
    ],

    /** 숲 2-1: 조금 더 강한 구성 */
    "forest-normal-1": [
        { speciesId: "poke-0001", level: 8 }, // 이상해씨
        { speciesId: "poke-0004", level: 9 }, // 파이리
        { speciesId: "poke-0007", level: 9 }, // 꼬부기
    ],

    /** 튜토리얼 레이드: HP 낮은 적 (예시, 현재는 사용 안 해도 됨) */
    "tutorial-raid-easy": [
        { speciesId: "poke-0010", level: 5 }, // 캐터피
        { speciesId: "poke-0013", level: 7 }, // 뿔충이
        { speciesId: "poke-0016", level: 8 }, // 구구
    ],

    /** 연습 타워: 스타터 최종 진화 + 강한 적 (예시) */
    "tower-set-1": [
        { speciesId: "poke-0003", level: 12 }, // 이상해꽃
        { speciesId: "poke-0006", level: 12 }, // 리자몽
        { speciesId: "poke-0009", level: 12 }, // 거북왕
    ],

    // 필요하면 여기 계속 추가:
    // "cave-set-1": [ ... ],
    // "sea-set-1": [ ... ],
};
