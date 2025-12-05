// seedSpeciesLevelupFromBasic.cjs
// basicSpecialMoves.json 기준으로 quizmon_species_levelup_moves 다시 채우기

const fs = require("fs/promises");
const path = require("path");
require("dotenv").config({ path: ".env.seed" });
const { createClient } = require("@supabase/supabase-js");

async function main() {
    const url =
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
        throw new Error("SUPABASE_URL / SERVICE_ROLE_KEY env 확인 필요");
    }

    const supabase = createClient(url, key);

    // 1) basicSpecialMoves.json 로드
    const raw = await fs.readFile(
        path.join(__dirname, "basicSpecialMoves.json"),
        "utf8",
    );
    const basicMap = JSON.parse(raw); // { [speciesId]: { basicMoveId, specialMoveId } }

    // 2) 기존 레벨업 데이터 전체 삭제 (원하면 주석 처리해서 병행도 가능)
    console.log("[seed] 기존 quizmon_species_levelup_moves 전체 삭제");
    const { error: delError } = await supabase
        .from("quizmon_species_levelup_moves")
        .delete()
        .neq("species_id", ""); // where true

    if (delError) {
        console.error("[seed] 삭제 에러", delError);
        process.exit(1);
    }

    const rows = [];

    for (const [speciesId, value] of Object.entries(basicMap)) {
        if (!value) continue;
        const { basicMoveId, specialMoveId } = value;

        let sortOrder = 0;

        // 둘 다 레벨 1에서 배운다고 가정 (처음부터 두 개 다 사용 가능)
        if (basicMoveId) {
            rows.push({
                species_id: speciesId,
                level: 1,
                move_id: basicMoveId,
                sort_order: sortOrder++,
            });
        }

        if (specialMoveId && specialMoveId !== basicMoveId) {
            rows.push({
                species_id: speciesId,
                level: 1,
                move_id: specialMoveId,
                sort_order: sortOrder++,
            });
        }
    }

    console.log("[seed] insert rows:", rows.length);

    // 3) 500개씩 끊어서 insert
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabase
            .from("quizmon_species_levelup_moves")
            .insert(chunk);

        if (error) {
            console.error("[seed] insert 에러", error);
            process.exit(1);
        }
    }

    console.log("[seed] 완료");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
