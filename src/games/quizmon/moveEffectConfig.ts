// src/games/quizmon/moveEffectConfig.ts

export type MoveEffectAnchor = "caster" | "target" | "screen";

/**
 * 기술 이펙트의 "패턴" 타입
 * - 같은 타입이면 같은 연출 자산을 공유
 */
export type MoveEffectType =
    | "physical-contact"   // 몸통박치기, 할퀴기, 돌격류
    | "fire-hit"           // 화염구/불꽃류
    | "water-hit"          // 물대포/물줄기류
    | "grass-drain"        // 흡수/기가드레인류
    | "poison-hit"         // 산/독안개류
    | "flying-slash"       // 에어컷터/공중날기류
    | "self-buff-armor"    // 방어력 업 (산성갑옷 등)
    | "self-buff-random";  // 능력치 랜덤 업 (압정손가락 등)

/**
 * BattleEffectLayer 에서 실제로 쓰는 설정
 */
export type MoveEffectConfig = {
    moveId: string;          // 어떤 기술에서 왔는지 (디버그용)
    jsonUrl: string;
    imageUrl: string;
    fps?: number;
    scale?: number;
    anchor?: MoveEffectAnchor;
    durationMs?: number;
};

const BASE = "/games/quizmon/effects";

/**
 * effectType → 실제 스프라이트/파라미터 설정
 * - 여기서만 JSON/PNG 경로를 관리
 * - 나중에 자산 교체도 이 테이블만 건드리면 됨
 */
const EFFECT_TYPE_CONFIG: Record<
    MoveEffectType,
    Omit<MoveEffectConfig, "moveId">
> = {
    "physical-contact": {
        jsonUrl: `${BASE}/tackle.json`,
        imageUrl: `${BASE}/tackle.png`,
        fps: 18,
        scale: 1.1,
        anchor: "target",
        durationMs: 550,
    },
    "fire-hit": {
        jsonUrl: `${BASE}/ember.json`,
        imageUrl: `${BASE}/ember.png`,
        fps: 20,
        scale: 1.3,
        anchor: "target",
        durationMs: 650,
    },
    "water-hit": {
        jsonUrl: `${BASE}/water-gun.json`,
        imageUrl: `${BASE}/water-gun.png`,
        fps: 20,
        scale: 1.2,
        anchor: "target",
        durationMs: 650,
    },
    "grass-drain": {
        jsonUrl: `${BASE}/absorb.json`,
        imageUrl: `${BASE}/absorb.png`,
        fps: 18,
        scale: 1.2,
        anchor: "target",
        durationMs: 700,
    },
    "poison-hit": {
        jsonUrl: `${BASE}/acid-spray.json`,
        imageUrl: `${BASE}/acid-spray.png`,
        fps: 20,
        scale: 1.1,
        anchor: "target",
        durationMs: 650,
    },
    "flying-slash": {
        jsonUrl: `${BASE}/aerial-ace.json`,
        imageUrl: `${BASE}/aerial-ace.png`,
        fps: 24,
        scale: 1.3,
        anchor: "target",
        durationMs: 650,
    },
    "self-buff-armor": {
        jsonUrl: `${BASE}/acid-armor.json`,
        imageUrl: `${BASE}/acid-armor.png`,
        fps: 16,
        scale: 1.0,
        anchor: "caster",
        durationMs: 800,
    },
    "self-buff-random": {
        jsonUrl: `${BASE}/acupressure.json`,
        imageUrl: `${BASE}/acupressure.png`,
        fps: 18,
        scale: 1.0,
        anchor: "caster",
        durationMs: 800,
    },
};

/**
 * moveId → effectType 매핑
 * - 여기만 늘려주면 이펙트 자동으로 공유
 * - 없는 기술은 이펙트 없이 지나감(null)
 */
const MOVE_TO_EFFECT_TYPE: Record<string, MoveEffectType> = {
    // ✅ 기본 물리기
    tackle: "physical-contact",
    "quick-attack": "physical-contact",
    "body-slam": "physical-contact",
    "accelerock": "physical-contact",
    "aerial-ace": "flying-slash",
    acrobatics: "flying-slash",
    aeroblast: "flying-slash",

    // 🔥 불꽃계
    ember: "fire-hit",
    flamethrower: "fire-hit",
    "fire-blast": "fire-hit",

    // 💧 물계
    "water-gun": "water-hit",
    "bubble-beam": "water-hit",

    // 🌿 흡수계
    absorb: "grass-drain",
    "mega-drain": "grass-drain",
    "giga-drain": "grass-drain",

    // ☠️ 독/산 계열
    acid: "poison-hit",
    "acid-spray": "poison-hit",

    // 🛡 버프계
    "acid-armor": "self-buff-armor",
    acupressure: "self-buff-random",
};

/**
 * 필요하면 특정 moveId만 별도 이펙트로 override
 * - 예: accelerock 만 전용 이펙트 쓰고 싶을 때
 */
const MOVE_OVERRIDE_CONFIG: Record<string, Omit<MoveEffectConfig, "moveId">> =
    {
        accelerock: {
            jsonUrl: `${BASE}/accelerock.json`,
            imageUrl: `${BASE}/accelerock.png`,
            fps: 22,
            scale: 1.1,
            anchor: "target",
            durationMs: 500,
        },
    };

export function getMoveEffectConfig(moveId: string): MoveEffectConfig | null {
    // 1) 개별 기술 전용 설정이 있으면 우선 사용
    const override = MOVE_OVERRIDE_CONFIG[moveId];
    if (override) {
        return { moveId, ...override };
    }

    // 2) 그 외에는 effectType → 공통 설정 사용
    const type = MOVE_TO_EFFECT_TYPE[moveId];
    if (!type) return null;

    const base = EFFECT_TYPE_CONFIG[type];
    if (!base) return null;

    return { moveId, ...base };
}
