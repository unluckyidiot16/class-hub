// scripts/seedQuizmonBots.cjs
//
// QuizMon 아레나 봇 100명 + 배틀 타워 100층 자동 생성 스크립트
//
// 준비사항:
// 1) .env.seed 등에 아래 환경변수 설정
//    SUPABASE_URL=...
//    SUPABASE_SERVICE_ROLE_KEY=...
//    QUIZMON_BOT_CLASS_ID=...   -- 봇용으로 묶을 class_id 하나
//
// 2) 실행:
//    node scripts/seedQuizmonBots.cjs

require("dotenv").config({ path: ".env.seed" });

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLASS_ID = process.env.QUIZMON_BOT_CLASS_ID; // 필수

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("⚠️ SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.");
    process.exit(1);
}

if (!CLASS_ID) {
    console.error("⚠️ QUIZMON_BOT_CLASS_ID 환경변수를 설정해 주세요.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** 몬스터 파워 계산: 스탯 + 레벨 */
function calcMonPower(species, level) {
    const statTotal = species.battle_stat_total ?? 0;
    return statTotal / 3 + level * 8;
}

/** 3마리 팀 파워/ELO 계산 */
function calcTeamRating(team) {
    let power = 0;
    for (const m of team) {
        power += calcMonPower(m.species, m.level);
    }
    return Math.round(200 + power);
}

/** idx(1~100)에 따라 티어 패턴 결정 */
function getTierPattern(idx) {
    if (idx <= 20) return ["C", "C", "C"];
    if (idx <= 40) return ["C", "C", "B"];
    if (idx <= 60) return ["C", "B", "B"];
    if (idx <= 80) return ["B", "B", "A"];
    if (idx <= 90) return ["B", "A", "A"];
    return ["A", "A", "S"]; // 91~100
}

/** idx 기반 레벨 범위 결정 (대전/타워 공통) */
function getLevelBase(idx) {
    // 1 → 5레벨 근처, 100 → 50레벨 근처
    return 4 + Math.floor((idx - 1) * (45 / 99)); // 4~49
}

/** 각 티어별 species 풀에서 한 마리 선택 (순환) */
function buildTeam(idx, speciesByTier) {
    const tiers = getTierPattern(idx);
    const baseLevel = getLevelBase(idx);
    const result = [];

    for (let slot = 0; slot < 3; slot++) {
        const tier = tiers[slot];
        let pool = speciesByTier[tier];

        // 해당 tier가 비어있으면 한 단계 아래/위로 폴백
        if (!pool || pool.length === 0) {
            if (tier === "S") pool = speciesByTier["A"] || speciesByTier["B"] || speciesByTier["C"];
            else if (tier === "A") pool = speciesByTier["B"] || speciesByTier["C"] || speciesByTier["S"];
            else if (tier === "B") pool = speciesByTier["C"] || speciesByTier["A"] || speciesByTier["S"];
            else pool = speciesByTier["C"] || speciesByTier["B"] || speciesByTier["A"] || speciesByTier["S"];
        }

        if (!pool || pool.length === 0) {
            throw new Error("종 풀을 찾을 수 없습니다. quizmon_species.is_playable 데이터를 확인하세요.");
        }

        // 난수 대신 idx+slot 기반 순환 선택 (재실행해도 안정적인 구성)
        const idxInPool = (idx * 3 + slot) % pool.length;
        const species = pool[idxInPool];

        // 슬롯별 레벨 약간씩 차이
        const level = baseLevel + slot; // 5,6,7 → 50,51,52 정도

        result.push({ species, level });
    }

    return result;
}

async function loadPlayableSpecies() {
    const { data, error } = await supabase
        .from("quizmon_species")
        .select("id, name, battle_stat_total, battle_stat_rank, is_playable")
        .eq("is_playable", true);

    if (error) {
        throw error;
    }

    const byTier = { C: [], B: [], A: [], S: [] };

    for (const s of data) {
        const rank = s.battle_stat_rank || "C";
        if (!byTier[rank]) byTier[rank] = [];
        byTier[rank].push(s);
    }

    console.log("✅ species loaded:", {
        C: byTier.C.length,
        B: byTier.B.length,
        A: byTier.A.length,
        S: byTier.S.length,
    });

    return byTier;
}

/** 봇 프로필 생성/업서트 */
async function ensureBotProfile(botIndex) {
    const studentKey = `BOT_ARENA_${String(botIndex).padStart(3, "0")}`;
    const trainerName = `봇 트레이너 #${botIndex}`;

    const { data: existing, error: selectError } = await supabase
        .from("quizmon_profiles")
        .select("id")
        .eq("student_key", studentKey)
        .maybeSingle();

    if (selectError) throw selectError;

    if (existing) {
        return { profileId: existing.id, studentKey, trainerName };
    }

    const { data, error } = await supabase
        .from("quizmon_profiles")
        .insert({
            class_id: CLASS_ID,
            student_key: studentKey,
            trainer_name: trainerName,
            starter_chosen: true,
            gold: 0,
            gems: 0,
            star_shards: 0,
            trainer_level: 1,
            trainer_exp: 0,
        })
        .select("id")
        .single();

    if (error) throw error;

    return { profileId: data.id, studentKey, trainerName };
}

/** 봇 몬스터 교체 후, arena_profiles / ranked_stats 세팅 */
async function upsertArenaBot(botIndex, team, rating, profileInfo) {
    const { profileId, studentKey, trainerName } = profileInfo;

    // 기존 몬스터 제거 (봇 프로필 전부 삭제 후 다시 넣기)
    const { error: delError } = await supabase
        .from("quizmon_owned_monsters")
        .delete()
        .eq("profile_id", profileId);

    if (delError) throw delError;

    // 새 몬스터 3마리 삽입
    const insertRows = team.map((m, i) => ({
        profile_id: profileId,
        species_id: m.species.id,
        level: m.level,
        exp: 0,
        party_slot: i + 1,
    }));

    const { data: inserted, error: insError } = await supabase
        .from("quizmon_owned_monsters")
        .insert(insertRows)
        .select("id, party_slot");

    if (insError) throw insError;

    const slotMap = {};
    for (const row of inserted) {
        slotMap[row.party_slot] = row.id;
    }

    // arena_profiles 업서트
    const arenaRow = {
        profile_id: profileId,
        attack_slot1_owned_id: slotMap[1] || null,
        attack_slot2_owned_id: slotMap[2] || null,
        attack_slot3_owned_id: slotMap[3] || null,
        defense_slot1_owned_id: slotMap[1] || null,
        defense_slot2_owned_id: slotMap[2] || null,
        defense_slot3_owned_id: slotMap[3] || null,
        rating,
    };

    const { error: arenaError } = await supabase
        .from("quizmon_arena_profiles")
        .upsert(arenaRow, { onConflict: "profile_id" });

    if (arenaError) throw arenaError;

    // ranked_stats (시즌 1 기준)
    const rankedRow = {
        profile_id: profileId,
        season: 1,
        rating,
        wins: 0,
        losses: 0,
        draws: 0,
    };

    const { error: rankError } = await supabase
        .from("quizmon_ranked_stats")
        .upsert(rankedRow, { onConflict: "profile_id,season" });

    if (rankError) throw rankError;

    console.log(
        `✅ Arena Bot #${botIndex} (${studentKey}, ${trainerName}) rating=${rating}`
    );
}

/** 배틀 타워 1~100층 upsert (floors + dungeons) */
async function upsertBattleTowerFloor(floorIndex, team, rating) {
    const id = `tower-${floorIndex}f`;
    const name = `${floorIndex}층 도전자`;
    const dungeonName = `배틀 타워 ${floorIndex}층`;

    const avgLevel =
        team.reduce((sum, m) => sum + m.level, 0) / team.length;

    const enemyTeamJson = team.map((m, slotIdx) => ({
        slot: slotIdx + 1,
        species_id: m.species.id,
        level: m.level,
    }));

    // 보상은 난이도에 따라 대략적으로 스케일 (예: 층수 * 3 골드, exp_dust 1~5)
    const rewardsJson = {
        gold: floorIndex * 3,
        exp_dust: Math.max(1, Math.floor(floorIndex / 20)),
    };

    // 1) floors
    const floorRow = {
        id,
        floor: floorIndex,
        name,
        recommended_rating: rating,
    };

    const { error: floorError } = await supabase
        .from("quizmon_battle_tower_floors")
        .upsert(floorRow, { onConflict: "id" });

    if (floorError) throw floorError;

    // 2) dungeons (enemy_team / rewards)
    const dungeonRow = {
        id,
        name: dungeonName,
        description: `배틀 타워 ${floorIndex}층 도전자 팀입니다.`,
        recommended_level: Math.round(avgLevel),
        grade: null,
        dungeon_type: "normal",
        enemy_team: enemyTeamJson,
        rewards: rewardsJson,
    };

    const { error: dungeonError } = await supabase
        .from("quizmon_dungeons")
        .upsert(dungeonRow, { onConflict: "id" });

    if (dungeonError) throw dungeonError;

    console.log(
        `✅ Tower Floor ${floorIndex} (id=${id}) rating≈${rating}, avgLv≈${avgLevel.toFixed(
            1
        )}`
    );
}

async function main() {
    console.log("🔄 loading playable species...");
    const speciesByTier = await loadPlayableSpecies();

    console.log("🔄 seeding 100 arena bots & 100 tower floors...");

    for (let i = 1; i <= 100; i++) {
        // 1) 공통 팀 구성
        const team = buildTeam(i, speciesByTier);
        const rating = calcTeamRating(team);

        // 2) 아레나 봇
        const profileInfo = await ensureBotProfile(i);
        await upsertArenaBot(i, team, rating, profileInfo);

        // 3) 배틀 타워 층
        await upsertBattleTowerFloor(i, team, rating);
    }

    console.log("🎉 완료: 100명의 아레나 봇 + 100층 배틀 타워 생성 완료");
}

main().catch((err) => {
    console.error("❌ seedQuizmonBots 실패:", err);
    process.exit(1);
});
