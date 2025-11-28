// src/games/quizmon/useQuizmonCollection.ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { QuizmonOwnedMonsterRow, QuizmonProfileRow } from "./types";
import {
    buildBattleMonsterFromSpecies,
    type BattleMonsterCore,
    type QuizmonSpeciesLike,
} from "./battleFactory";

type UseQuizmonCollectionOptions = {
    profileId: string | null;
    profile?: QuizmonProfileRow | null;   // ✅ 옵셔널로 변경
};

type UseQuizmonCollectionResult = {
    monsters: QuizmonOwnedMonsterRow[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
};

type QuizmonSpeciesRow = QuizmonSpeciesLike;

export type BattlePartyMonster = BattleMonsterCore & {
    partySlot: number;
};

export function useQuizmonCollection(
    options: UseQuizmonCollectionOptions,
): UseQuizmonCollectionResult {
    const { profileId = null } = options;

    const [monsters, setMonsters] = useState<QuizmonOwnedMonsterRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reloadFlag, setReloadFlag] = useState(0);

    // 소유 몬스터 목록 로딩
    useEffect(() => {
        if (!profileId) {
            setMonsters([]);
            return;
        }

        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError(null);

            const { data, error } = await supabase
                .from("quizmon_owned_monsters")
                .select("*")
                .eq("profile_id", profileId)
                .order("created_at", { ascending: true });

            if (cancelled) return;

            if (error) {
                console.error("[useQuizmonCollection] select error", error);
                setError("몬스터 목록을 불러오는 중 오류가 발생했습니다.");
                setMonsters([]);
            } else {
                setMonsters((data ?? []) as QuizmonOwnedMonsterRow[]);
            }

            setLoading(false);
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [profileId, reloadFlag]);

    const refresh = useCallback(() => {
        setReloadFlag((x) => x + 1);
    }, []);
    

    return {
        monsters,
        loading,
        error,
        refresh
    };
}

/**
 * 특정 profileId에 대해
 *   quizmon_owned_monsters + quizmon_species 를 조인해서
 *   전투용 파티 몬스터 배열을 만들어 주는 헬퍼.
 *
 * - party_slot 이 1~3인 몬스터만 대상으로 함
 * - 슬롯 순서대로 정렬된 BattleMonsterCore[] 반환
 */
export async function loadBattlePartyForProfile(
    profileId: string | null,
): Promise<BattlePartyMonster[]> {
    if (!profileId) return [];

    // 1) 해당 프로필의 파티 몬스터(슬롯 1~3만) 가져오기
    const { data: ownedRows, error } = await supabase
        .from("quizmon_owned_monsters")
        .select("*")
        .eq("profile_id", profileId)
        .not("party_slot", "is", null)
        .order("party_slot", { ascending: true });

    if (error) {
        console.error("[loadBattlePartyForProfile] owned select error", error);
        return [];
    }

    const owned = (ownedRows ?? []) as QuizmonOwnedMonsterRow[];

    if (owned.length === 0) {
        return [];
    }

    // 2) 필요한 species_id 목록 추출
    const speciesIds = Array.from(
        new Set(owned.map((m) => m.species_id)),
    );

    // 3) quizmon_species 에서 종 마스터 데이터 가져오기
    const { data: speciesRows, error: speciesError } = await supabase
        .from("quizmon_species")
        .select(
            "id, name, element, base_hp, base_atk, base_def, base_spd, pokedex_no",
        )
        .in("id", speciesIds);

    if (speciesError) {
        console.error(
            "[loadBattlePartyForProfile] species select error",
            speciesError,
        );
        return [];
    }

    const speciesList = (speciesRows ?? []) as QuizmonSpeciesRow[];

    const speciesById = new Map<string, QuizmonSpeciesRow>();
    for (const s of speciesList) {
        speciesById.set(s.id, s);
    }

    // 4) owned + species 를 합쳐서 BattleMonsterCore로 변환
    const result: BattlePartyMonster[] = [];

    for (const ownedMon of owned) {
        if (!ownedMon.party_slot) continue;

        const species = speciesById.get(ownedMon.species_id);
        if (!species) continue;

        const battleMon = buildBattleMonsterFromSpecies(
            species,
            ownedMon,
            {
                partySlot: ownedMon.party_slot,
            },
        );

        // ✅ null 가드 + BattlePartyMonster로 캐스팅
        if (battleMon) {
            result.push(battleMon as BattlePartyMonster);
        }
    }


    return result;
}
