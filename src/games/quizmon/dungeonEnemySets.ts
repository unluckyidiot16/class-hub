// src/games/quizmon/dungeonEnemySets.ts

/** 던전 난이도 */
export type DungeonDifficulty = "easy" | "normal" | "hard";

/** 던전 메타 정보 */
export type DungeonConfig = {
    id: string;
    name: string;
    description: string;
    difficulty: DungeonDifficulty;
    /** UI용 난이도 라벨 (한글) */
    difficultyLabel: string;
    /** 나중에 적 세트 테이블/JSON과 연결할 키 */
    enemySetId: string;
    /** 보상 계수 (코인/Exp/아이템 드랍 등) */
    rewardMultiplier: number;
    /** 권장 레벨 범위 */
    recommendedMinLevel: number;
    recommendedMaxLevel: number;
    /** 배경/아레나 키 */
    arenaKey: string;
};

/** 🏰 던전 리스트 (기존 QuizMonGame에 있던 DUNGEON_CONFIGS 그대로 이동) */
export const DUNGEON_CONFIGS: DungeonConfig[] = [
    {
        id: "forest-easy-1",
        name: "숲 입구 튜토리얼",
        description: "HP가 낮은 적이 등장하는 튜토리얼용 레이드입니다.",
        difficulty: "easy",
        difficultyLabel: "쉬움",
        enemySetId: "forest-set-1",
        rewardMultiplier: 1.0,
        recommendedMinLevel: 1,
        recommendedMaxLevel: 5,
        arenaKey: "forest_bg",
    },
    {
        id: "forest-normal-1",
        name: "숲 깊은 곳",
        description: "조금 더 강한 야생 포켓몬이 등장합니다.",
        difficulty: "normal",
        difficultyLabel: "보통",
        enemySetId: "forest-set-2",
        rewardMultiplier: 1.5,
        recommendedMinLevel: 3,
        recommendedMaxLevel: 8,
        arenaKey: "forest_bg",
    },
    {
        id: "tower-hard-1",
        name: "연습 타워 (하드)",
        description:
            "정답률이 높을수록 보상이 크게 늘어나는 도전용 던전입니다.",
        difficulty: "hard",
        difficultyLabel: "어려움",
        enemySetId: "tower-set-1",
        rewardMultiplier: 2.0,
        recommendedMinLevel: 5,
        recommendedMaxLevel: 12,
        arenaKey: "forest_bg",
    },
    // 👉 나머지 던전이 더 있으면 여기 그대로 이어서 복붙
];

/** (다음 단계용) 던전 적 세트 정의 타입 */
export type EnemySlot = {
    speciesId: string; // quizmon_species.id
    level: number;
};

/** (다음 단계에서 채워갈 예정) 던전 ID → 적 파티 목록 */
export const ENEMY_SETS: Record<string, EnemySlot[]> = {
    // 예시:
    // "forest-set-1": [
    //   { speciesId: "poke-0001", level: 3 },
    //   { speciesId: "poke-0010", level: 4 },
    // ],
};
