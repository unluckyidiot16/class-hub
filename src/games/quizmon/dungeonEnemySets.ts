// src/games/quizmon/dungeonEnemySets.ts

/** 던전 난이도 */
export type DungeonDifficulty = "easy" | "normal" | "hard";

/** 과목 메타 (필터/통계용, 아직 UI에서는 안 씀) */
export type DungeonSubject = "korean" | "math" | "science" | "general";

/** 학년 메타 (필터/통계용) */
export type DungeonGrade = 1 | 2 | 3 | 4 | 5 | 6;

export type EnemySetKey = string;

// 기준으로 삼을 능력치 키
export type FocusStatKey = "level" | "maxHp" | "atk" | "def" | "spd";

// UI 표시용 라벨
export const FOCUS_STAT_LABEL: Record<FocusStatKey, string> = {
    level: "레벨",
    maxHp: "HP",
    atk: "공격",
    def: "방어",
    spd: "스피드",
};

/** 던전 메타 정보 */
export type DungeonConfig = {
    id: string;
    name: string;
    description: string;
    difficulty: "easy" | "normal" | "hard";
    difficultyLabel: string;
    recommendedMinLevel: number;
    recommendedMaxLevel: number;
    arenaKey: string;
    rewardMultiplier: number;

    /** 이 던전이 기준으로 삼는 능력치 (난이도/보상 계산에 사용) */
    focusStat: FocusStatKey;

    /** 이 던전에 기본으로 쓸 ENEMY_SETS 키 */
    enemySetId: EnemySetKey;

    /** 동시에 상대할 몬스터 수 (생략 시 세트 전체) */
    enemyCount?: number;

    /** ✅ 수업 중 빠른 난이도 튜닝용: 전체 레벨 오프셋 (예: -2, +3) */
    levelOffset?: number;

    /** ✅ 수업 중 빠른 난이도 튜닝용: 전체 HP 배수 (예: 0.7, 1.2) */
    hpScale?: number;

    /** 퀴즈 필터링용 메타데이터 */
    quizTags: string[];
    grade?: number | null;
    subject?:
        | "korean"
        | "math"
        | "science"
        | "social"
        | "english"
        | "general" // ← tower 같은 종합형용
        | null;
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
        focusStat: "level",
        enemySetId: "forest-easy-1",
        rewardMultiplier: 1.0,
        recommendedMinLevel: 3,
        recommendedMaxLevel: 6,
        subject: "korean",
        grade: 2,
        arenaKey: "forest_bg",
        enemyCount: 1, // 쉬움: 1마리
        quizTags: ["korean", "grade-2", "forest", "easy"],
    },
    {
        id: "forest-easy-2",
        name: "숲 1-2: 조금 더 안쪽",
        description: "조금 더 강해진 몬스터가 등장합니다. 여전히 입문용에 가깝습니다.",
        difficulty: "easy",
        difficultyLabel: "쉬움",
        focusStat: "level",
        enemySetId: "forest-easy-2",
        rewardMultiplier: 1.2,
        recommendedMinLevel: 5,
        recommendedMaxLevel: 8,
        subject: "korean",
        grade: 2,
        arenaKey: "forest_bg",
        enemyCount: 2,
        quizTags: ["korean", "grade-2", "forest", "easy"],
    },
    {
        id: "forest-normal-1",
        name: "숲 2-1: 진짜 실전",
        description: "파티가 어느 정도 성장했을 때 도전하는 실전형 던전입니다.",
        difficulty: "normal",
        difficultyLabel: "보통",
        focusStat: "level",
        enemySetId: "forest-normal-1",
        rewardMultiplier: 1.5,
        recommendedMinLevel: 8,
        recommendedMaxLevel: 12,
        subject: "korean",
        grade: 3,
        arenaKey: "forest_bg",
        enemyCount: 3,
        quizTags: ["korean", "grade-3", "forest", "normal"],
    },
    {
        id: "tower-normal-1",
        name: "연습 타워 1층",
        description: "스타터 최종 진화와 싸워 보는 연습용 타워입니다.",
        difficulty: "normal",
        difficultyLabel: "보통",
        focusStat: "level",
        enemySetId: "tower-set-1",
        rewardMultiplier: 2.0,
        recommendedMinLevel: 10,
        recommendedMaxLevel: 15,
        subject: "general", // ← 종합
        grade: 3,
        arenaKey: "forest_bg",
        enemyCount: 3,
        quizTags: ["general", "tower", "normal"],
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
    ],

    "forest-easy-1-A": [
        { speciesId: "poke-0004", level: 3 }, // 파이리
    ],

    "forest-easy-1-B": [
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

// ---- Helper functions for Dungeon meta & UI ----

/** id → 던전 설정 찾기 */
export function findDungeonConfigById(id: string): DungeonConfig | undefined {
    return DUNGEON_CONFIGS.find((d) => d.id === id);
}
function getLocationLabel(cfg: DungeonConfig): string {
    if (cfg.id.startsWith("forest-")) return "숲";
    if (cfg.id.startsWith("tower-")) return "타워";
    return "기타";
}

function getSubjectLabel(subject: DungeonConfig["subject"]): string {
    switch (subject) {
        case "korean":
            return "국어";
        case "math":
            return "수학";
        case "science":
            return "과학";
        case "social":
            return "사회";
        case "english":
            return "영어";
        case "general":
            return "통합";
        default:
            return "기타";
    }
}

/** 한 던전에 대한 적 정보 요약 */
export type DungeonEnemySummary = {
    id: string;
    label: string;
    difficultyLabel: string;
    locationLabel: string;
    subjectLabel: string;
    enemyCount: number;
    enemySpeciesIds: string[];
    minEnemyLevel: number;
    maxEnemyLevel: number;
};

export function getDungeonEnemySummary(cfg: DungeonConfig): DungeonEnemySummary {
    const slots = ENEMY_SETS[cfg.enemySetId] ?? [];
    const enemyCount = cfg.enemyCount ?? slots.length;
    const trimmed = slots.slice(0, enemyCount);

    const levelOffset = cfg.levelOffset ?? 0;
    const levels = trimmed.map((s) => s.level + levelOffset);

    const minEnemyLevel =
        levels.length > 0 ? Math.min(...levels) : cfg.recommendedMinLevel;
    const maxEnemyLevel =
        levels.length > 0 ? Math.max(...levels) : cfg.recommendedMaxLevel;

    const enemySpeciesIds = trimmed.map((s) => s.speciesId);

    return {
        id: cfg.id,
        label: cfg.name,
        difficultyLabel: cfg.difficultyLabel,
        locationLabel: getLocationLabel(cfg),
        subjectLabel: getSubjectLabel(cfg.subject ?? null),
        enemyCount,
        enemySpeciesIds,
        minEnemyLevel,
        maxEnemyLevel,
    };
}

/** 교사용 던전 패널에서 전체 리스트를 뿌릴 때 사용 */
export function getAllDungeonEnemySummaries(): DungeonEnemySummary[] {
    return DUNGEON_CONFIGS.map((cfg) => getDungeonEnemySummary(cfg));
}

export type FocusStatDifficultyResult = {
    focusStat: FocusStatKey;
    difficultyLabel: string;   // 플레이어 기준 난이도 라벨
    rewardMultiplier: number;  // 플레이어 기준 보상 배수
    recommendedMin: number;    // 이 던전의 권장 focusStat 최소
    recommendedMax: number;    // 이 던전의 권장 focusStat 최대
};

/**
 * 플레이어의 focusStat 값(focusValue)을 기준으로,
 * 이 던전의 실제 난이도/보상 배수를 계산한다.
 *
 * - focusValue < 권장 범위 → 더 어려운 던전 → 보상 증가
 * - focusValue > 권장 범위 → 더 쉬운 던전 → 보상 감소
 */
export function evaluateDungeonForFocusStat(
    dungeon: DungeonConfig,
    focusValue: number | null | undefined,
): FocusStatDifficultyResult {
    const focusStat = dungeon.focusStat;
    const min = dungeon.recommendedMinLevel;
    const max = dungeon.recommendedMaxLevel;
    const baseReward = dungeon.rewardMultiplier;

    // 값이 없으면 기존 고정 난이도/보상 그대로 사용
    if (!focusValue || !Number.isFinite(focusValue)) {
        return {
            focusStat,
            difficultyLabel: dungeon.difficultyLabel,
            rewardMultiplier: baseReward,
            recommendedMin: min,
            recommendedMax: max,
        };
    }

    const center = (min + max) / 2 || 1;
    const ratio = focusValue / center;

    let difficultyLabel = dungeon.difficultyLabel;
    let rewardMultiplier = baseReward;

    // ratio < 1  → 우리 능력치가 권장보다 낮다 = 실제 난이도 ↑ = 보상 ↑
    // ratio > 1  → 우리 능력치가 권장보다 높다 = 실제 난이도 ↓ = 보상 ↓
    if (ratio <= 0.5) {
        difficultyLabel = "매우 어려움";
        rewardMultiplier = baseReward * 1.7;
    } else if (ratio <= 0.85) {
        difficultyLabel = "어려움";
        rewardMultiplier = baseReward * 1.3;
    } else if (ratio <= 1.15) {
        difficultyLabel = "보통";
        rewardMultiplier = baseReward;
    } else if (ratio <= 1.5) {
        difficultyLabel = "쉬움";
        rewardMultiplier = baseReward * 0.8;
    } else {
        difficultyLabel = "매우 쉬움";
        rewardMultiplier = baseReward * 0.6;
    }

    // 소수점 1자리로 정리
    rewardMultiplier = Math.round(rewardMultiplier * 10) / 10;

    return {
        focusStat,
        difficultyLabel,
        rewardMultiplier,
        recommendedMin: min,
        recommendedMax: max,
    };
}
