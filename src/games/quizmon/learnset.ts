// src/games/quizmon/learnset.ts
import type {
    LevelUpMoveTable,
    QuizmonSpeciesLevelupMoveRow,
} from "./types";
import { supabase } from "../../lib/supabaseClient";

/**
 * 여러 종에 대한 레벨업 기술 정보를 한 번에 로드
 * - speciesIds: 전투/인벤토리에서 사용 중인 종 id 목록
 */
export async function loadLevelUpMovesForSpeciesIds(
    speciesIds: string[],
): Promise<LevelUpMoveTable> {
    if (speciesIds.length === 0) return {};

    const { data, error } = await supabase
        .from("quizmon_species_levelup_moves")
        .select("species_id, level, move_id, sort_order")
        .in("species_id", speciesIds);

    if (error || !data) {
        console.error(
            "[learnset] loadLevelUpMovesForSpeciesIds error",
            error,
        );
        return {};
    }

    const table: LevelUpMoveTable = {};

    for (const row of data as QuizmonSpeciesLevelupMoveRow[]) {
        const list =
            table[row.species_id] ?? (table[row.species_id] = []);
        list.push({
            level: row.level,
            moveId: row.move_id,
        });
    }

    // 종별로 레벨 / sort_order 순으로 정렬
    for (const speciesId of Object.keys(table)) {
        table[speciesId].sort((a, b) => {
            if (a.level !== b.level) return a.level - b.level;
            const ra = data.find(
                (r: any) =>
                    r.species_id === speciesId &&
                    r.level === a.level &&
                    r.move_id === a.moveId,
            ) as QuizmonSpeciesLevelupMoveRow | undefined;
            const rb = data.find(
                (r: any) =>
                    r.species_id === speciesId &&
                    r.level === b.level &&
                    r.move_id === b.moveId,
            ) as QuizmonSpeciesLevelupMoveRow | undefined;
            return (ra?.sort_order ?? 0) - (rb?.sort_order ?? 0);
        });
    }

    return table;
}
