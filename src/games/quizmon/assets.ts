// src/games/quizmon/assets.ts

// GitHub Pages에서도 잘 동작하도록 base URL을 사용
const BASE_URL = (import.meta as any).env?.BASE_URL ?? "/";

// docs/games/quizmon 아래를 기준으로
const MONSTER_BASE = `${BASE_URL}games/quizmon/monster/`;
const TRAINER_BASE = `${BASE_URL}games/quizmon/trainers/`;
const ARENA_BASE = `${BASE_URL}games/quizmon/arenas/`;
const UI_BASE = `${BASE_URL}games/quizmon/ui/`;

// ✅ 포켓볼 전용 베이스 경로 추가
const BALL_BASE = `${BASE_URL}games/quizmon/pokeball/`;

// 4자리 포켓몬 번호 정규화: "1" | "001" | "0001" | "poke-0001" 다 받아서 "0001"로 통일
function normalizeSpeciesId(speciesId: string | number): string {
    const raw =
        typeof speciesId === "number" ? String(speciesId) : String(speciesId);
    const digits = raw.replace(/\D/g, ""); // 숫자만 추출
    if (!digits) return "0000";
    return digits.padStart(4, "0");
}

export type MonsterSpriteVariant = "front" | "back" | "icon";

/**
 * 포켓몬 정면/후면/아이콘 스프라이트 URL
 * - 실제 파일 경로 예시:
 *   - docs/games/quizmon/monster/front/0001.png
 *   - docs/games/quizmon/monster/back/0001.png
 *   - docs/games/quizmon/monster/icons/0001.png
 */
export function getMonsterSprite(
    speciesId?: string | number | null,
    variant: MonsterSpriteVariant = "front",
): string | null {
    if (speciesId == null) return null;
    const id = normalizeSpeciesId(speciesId);

    // 실제 폴더 이름은 icons 이라서 icon → icons로 매핑
    const folder = variant === "icon" ? "icons" : variant;

    return `${MONSTER_BASE}${folder}/${id}.png`;
}



/**
 * 도감/리스트 전용 아이콘 (variant "icon" 래퍼)
 */
export function getMonsterIcon(
    speciesId?: string | number | null,
): string | null {
    return getMonsterSprite(speciesId, "icon");
}

/**
 * 트레이너 스프라이트
 * - docs/games/quizmon/trainers/{key}.png
 *   ex) "default", "teacher-1", "rival-1"
 */
export function getTrainerSprite(trainerKey?: string | null): string {
    const key = trainerKey || "default";
    return `${TRAINER_BASE}${key}.png`;
}

// 아레나 키 타입 (필요하면 계속 추가)
export type ArenaKey = "forest_bg" | "classroom" | string;

/**
 * 배틀 배경
 * - docs/games/quizmon/arenas/{key}.png
 *   ex) "forest_bg.png", "classroom.png"
 *
 * QuizMonGame 기본 background(지금 forest_bg.png)와 맞추기 위해
 * 기본값을 "forest_bg"로 설정.
 */
export function getArenaSprite(key: ArenaKey = "forest_bg"): string {
    return `${ARENA_BASE}${key}.png`;
}

// UI 스프라이트 키 타입 (지금 가져온 파일들 기준)
export type UiSpriteKey =
    | "bg"
    | "overlay_message"
    | "party_bg"
    | "party_slot_hp_bar"
    | "party_slot_hp_overlay"
    | "pokedex_summary_bg"
    | "starter_container_bg"
    | "starter_select_bg"
    | string;

/**
 * UI 프레임/텍스트박스 등
 * - docs/games/quizmon/ui/{key}.png
 *   ex) "bg.png", "overlay_message.png"
 */
export function getUiSprite(key: UiSpriteKey): string {
    return `${UI_BASE}${key}.png`;
}

// ===== 몬스터 애니메이션(TexturePacker json) =====

export type MonsterAnimVariant = "front" | "back";

/**
 * 몬스터 애니메이션 JSON (TexturePacker) 경로
 * 예)
 *  - /games/quizmon/monster/front/0001.json
 *  - /games/quizmon/monster/back/0001.json
 */
export function getMonsterAnimJson(
    speciesId?: string | number | null,
    variant: MonsterAnimVariant = "front",
): string | null {
    if (speciesId == null) return null;
    const id = normalizeSpeciesId(speciesId);

    // 실제 폴더 이름: front / back
    const folder = variant === "front" ? "front" : "back";

    return `${MONSTER_BASE}${folder}/${id}.json`;
}

/* ⬇️ 여기부터 새로 추가 */

// 포획 연출용 포켓볼 스프라이트 상태
export type CaptureBallSpriteState = "closed" | "opening" | "open";

/**
 * 포켓볼 스프라이트 URL:
 *  - closed   → pb.png
 *  - opening  → pb_opening.png
 *  - open     → pb_open.png
 */
export function getCaptureBallSprite(
    state: CaptureBallSpriteState = "closed",
): string {
    switch (state) {
        case "open":
            return `${BALL_BASE}pb_open.png`;
        case "opening":
            return `${BALL_BASE}pb_opening.png`;
        case "closed":
        default:
            return `${BALL_BASE}pb.png`;
    }
}