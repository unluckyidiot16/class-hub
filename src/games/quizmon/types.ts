// src/games/quizmon/types.ts

// ===== 공통 타입 =====

export type ElementType = "normal" | "fire" | "water" | "grass" | "electric";

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

    // 레벨/경험치
    level?: number;
    exp?: number;

    // 전투 스탯
    maxHp: number;
    hp: number;
    atk: number;
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

/**
 * quizmon_species 테이블 대응 타입
 * - 실제 포켓몬 스탯 + 번호 + 스프라이트 키/설명
 */
export type QuizmonSpeciesRow = {
    id: string;               // "poke-0001" 등
    name: string;
    element: ElementType;
    rarity: number;           // 1~5
    base_hp: number;
    base_atk: number;
    base_def: number;
    base_spd: number;
    pokedex_no: number | null;
    sprite_key: string | null;
    description: string | null;

    // 나중에 height/weight 컬럼 추가 시 확장 여지
    height_m?: number | null;
    weight_kg?: number | null;
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
    gold: number;         // 전투/회복/강화용
    gacha_gems: number;   // 가챠 전용 재화
    star_shards: number;  // 돌파 MAX 중복 → 교환 재화

    // 레거시 필드 (RPC 등에서 아직 쓰면 유지)
    coins: number;
};


export type QuizmonOwnedMonsterRow = {
    id: string;
    profile_id: string;
    species_id: string;
    level: number;
    exp: number;
    party_slot: number | null;

    // 새 필드
    current_hp: number | null;   // null = 아직 풀피 상태/미초기화
    is_fainted: boolean;         // true면 전투/레이드 입장 불가
    learned_moves: string[];     // jsonb 배열: ["tackle","growl",...]

    created_at: string | null;
    updated_at: string | null;
};


export const DEFAULT_PARTNER: QuizmonPartner = {
    speciesId: "poke-0001", // 이상해씨 (#001)
    level: 1,
    exp: 0,
};
