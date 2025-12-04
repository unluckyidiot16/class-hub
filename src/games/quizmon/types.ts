// src/games/quizmon/types.ts

// ===== 공통 타입 =====

export type ElementType =
    | "normal"
    | "fire"
    | "water"
    | "grass"
    | "electric"
    | "ice"
    | "fighting"
    | "poison"
    | "ground"
    | "flying"
    | "psychic"
    | "bug"
    | "rock"
    | "ghost"
    | "dragon"
    | "dark"
    | "steel"
    | "fairy";

/**
 * 포켓몬식 스킬 분류
 * - physical: 물리
 * - special: 특수
 * - status: 상태/보조기
 */
export type MoveCategory = "physical" | "special" | "status";

/**
 * 스킬 대상 타입 (필요시 점진 확장)
 */
export type MoveTarget = "enemy" | "ally" | "self" | "field";

// 특성 ID는 이제 문자열 전체 허용 (DB/JSON 기반)
export type AbilityId = string;

export type AbilityDamageRule = {
    /**
     * 이 룰이 적용될 기술/피해 타입
     * - 공격 측: move.element 와 비교
     * - 방어 측: 들어오는 공격의 타입과 비교
     */
    element?: ElementType;

    /**
     * (선택) 현재 HP 비율 조건
     * - 예: 0.33 → HP가 1/3 이하일 때만 적용 (Overgrow 류)
     */
    whenHpBelowOrEqual?: number;

    /**
     * 배율 (예: 1.5, 0.8, 0)
     */
    multiplier: number;
};

export type AbilityMeta = {
    /**
     * 공격 시 최종 대미지 배율에 곱해지는 룰 목록
     * - 예: Overgrow / Blaze / Torrent / Swarm
     */
    damageOut?: AbilityDamageRule[];

    /**
     * 피격 시 최종 대미지 배율에 곱해지는 룰 목록
     * - 예: 물 기술 피해 0.8배 같은 방어형 특성
     */
    damageIn?: AbilityDamageRule[];

    /**
     * STAB(같은 타입 보너스) 배율 커스텀
     * - 기본 1.5, 예: Adaptability → 2.0
     */
    stabMultiplier?: number;

    // 필요하면 이후 crit / status 등 더 확장 가능
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
};

export type Ability = {
    id: AbilityId;
    name: string;
    description: string;
    meta?: AbilityMeta;
};

/**
 * 상태 이상 (기본 포켓몬식 + 확장 여지)
 */
export type StatusCondition =
    | "none"
    | "burn"
    | "poison"
    | "paralysis"
    | "sleep"
    | "freeze";

/**
 * 트레이너 (지금은 심플하게 유지)
 */
export type Trainer = {
    id: string;
    name: string;
    passiveDescription: string;
    skillName: string;
    skillDescription: string;
};

/**
 * 전투에서 사용하는 스킬/기술
 *
 * - 필수: id / name / power / baseAcc / element
 * - 선택: category / PP / priority / target / description
 *   → 지금 mockData는 필수 필드만 채워도 그대로 동작하고,
 *     나중에 데이터베이스/에디터 붙일 때 확장 가능하게 설계.
 */
export type Move = {
    id: string;
    name: string;
    power: number;
    baseAcc: number;
    element: ElementType;

    // --- 포켓몬식 확장 필드 (전부 optional) ---
    category?: MoveCategory;
    maxPp?: number;        // 최대 PP
    currentPp?: number;    // 남은 PP (전투 중)
    priority?: number;     // 우선도 (기본 0, 높을수록 먼저)
    target?: MoveTarget;   // 기본 enemy
    description?: string;  // 간단한 효과 설명 텍스트
};

/**
 * 전투에 등장하는 "개체" 단위 몬스터
 *
 * - id: 개체 ID (owned_monsters.id 등과 연결)
 * - speciesId: 종 ID (quizmon_species.id)
 * - pokedexNo: 실제 포켓몬 번호 (키/몸무게 lookup 용)
 *
 * - maxHp/hp/atk/def/spd: 전투용 스탯
 * - level/exp: 성장용 정보
 *
 * - heightM/weightKg/pokedexNo는 calcHitChance의 SizeSource 요구사항을
 *   만족시키기 위해 optional로 붙여둠.
 */
export type Monster = {
    // 개체/종 정보
    id: string;          // 개체 ID (owned_monsters.id 대응)
    speciesId?: string;  // 종 ID (quizmon_species.id)
    name: string;
    element: ElementType;
    element2?: ElementType | null;  // 서브 타입 (없으면 null/undefined)


    // 레벨/경험치 (QuizMon에서는 항상 채워짐)
    level: number;
    exp: number;

    // 🔹 전투 스탯 (calcDerivedStats 결과)
    //   - maxHp/atk/def/spd는 DB base_*가 아니라 "종 + 레벨"에서 계산된 값
    maxHp: number;
    currentHp?: number;  // ✅ optional 처리
    hp: number;
    atk: number;
    spAtk: number; // ✅ 추가
    spDef: number; // ✅ 추가
    def: number;
    spd: number;

    // 명중/회피 랭크 (포켓몬식 stat stage)
    accStage: number;
    evaStage: number;

    // 상태 이상 (없으면 "none"으로 간주)
    status?: StatusCondition;

    // 덩치/포켓몬 번호 (명중률 계산용)
    pokedexNo?: number | null;
    heightM?: number | null;
    weightKg?: number | null;

    // 보유 스킬 (최대 4개 사용 권장; 타입은 유연하게 배열로 둠)
    moves: Move[];

    // ✅ 특성: 없을 수도 있으므로 optional + nullable
    abilityId?: AbilityId | null;
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
    /** 퀴즈를 풀고 나서 교체할 대상 인덱스 (없으면 null) */
    pendingPlayerSwitchIndex: number | null;
    currentQuestion: QuizQuestionLite | null;
    questionStartedAt: number | null;
    lastQuizResult: QuizAnswerResult | null;
    logs: BattleLogEntry[];
};

// ------- DB row 타입들 -------

/**
 * quizmon_species 테이블 대응 타입
 * - 실제 포켓몬 스탯 + 번호 + 스프라이트 키/설명
 */
export type EvolutionTrigger = "level" | "item" | "special";

export type QuizmonSpeciesRow = {
    id: string;
    name: string;
    element: ElementType;
    element2?: ElementType | null;  // 서브 타입
    rarity: number;
    base_hp: number;
    base_atk: number;
    base_spatk?: number;
    base_def: number;
    base_spdef?: number;
    base_spd: number;
    pokedex_no: number | null;
    sprite_key: string | null;
    description: string | null;

    // 🔹 DB 원본 높이/무게
    height_dm?: number | null;
    weight_hg?: number | null;

    // 🔹 m/kg 캐시
    height_m?: number | null;
    weight_kg?: number | null;

    // 🔹 진화 정보
    evolves_to_id?: string | null;
    evolution_trigger?: EvolutionTrigger | null;
    evolution_level?: number | null;
    evolution_item_id?: string | null;
    evolution_special_key?: string | null;

    // 🔹 인기도/가챠/플래그 (DB 스키마와 맞추기)
    popularity_rank?: number | null;
    gacha_weight: number;       // NOT NULL DEFAULT 100
    generation?: number | null; // 1~10, 없으면 null
    is_playable: boolean;       // NOT NULL DEFAULT false

    // (선택) 나중에 쓰고 싶으면 이것들도 추가 가능
    // is_legendary: boolean;
    // is_mythical: boolean;
    // first_encounter_level?: number | null;
    // popularity_tier?: "low" | "mid" | "high" | "top" | null;
};



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

    // 메타 정보
    class_id: string | null;
    trainer_name: string | null;
    starter_species_id: string | null;
    starter_chosen: boolean;

    // 경제 필드
    gold: number;        // (선택) 전투/회복/강화용
    gems: number;        // 가챠/상점용 통합 재화
    star_shards: number; // 중복 보상 재화 (미사용 시 0 고정)
};




export type QuizmonOwnedMonsterRow = {
    id: string;
    profile_id: string;
    species_id: string;
    level: number;
    exp: number;
    party_slot: number | null;
    current_hp: number | null;
    is_fainted: boolean;

    learned_moves: string[];   // TM/레벨업으로 배운 전체 기술
    equipped_moves: string[];  // 실제 전투에서 사용하는 1~4개 기술

    // ✅ 개체가 가진 특성 (없으면 null)
    ability_id?: AbilityId | null;
    
    created_at: string | null;
    updated_at: string | null;
};



export const DEFAULT_PARTNER: QuizmonPartner = {
    speciesId: "poke-0001", // 이상해씨 (#001)
    level: 1,
    exp: 0,
};

// src/games/quizmon/types.ts

export type QuizmonSpeciesLevelupMoveRow = {
    id: string;
    species_id: string;
    level: number;
    move_id: string;
    sort_order: number;
    created_at?: string | null;
};

/**
 * 종별 레벨업 기술 테이블
 * - key: species_id ("poke-0001" 등)
 * - value: { level, moveId } 배열 (레벨/정렬 순으로 정렬된 상태)
 */
export type LevelUpMoveEntry = {
    level: number;
    moveId: string;
};

export type LevelUpMoveTable = Record<string, LevelUpMoveEntry[]>;

