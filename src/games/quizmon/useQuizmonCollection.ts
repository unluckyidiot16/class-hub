// src/games/quizmon/useQuizmonCollection.ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { QuizmonOwnedMonsterRow } from "./types";

// 아주 단순한 가챠 풀 (일단은 하드코딩)
const GACHA_POOL = ["starter-001", "starter-002", "starter-003"] as const;

function rollSpeciesId(): string {
    const idx = Math.floor(Math.random() * GACHA_POOL.length);
    return GACHA_POOL[idx];
}

type UseQuizmonCollectionOptions = {
    profileId: string | null;
};

type UseQuizmonCollectionResult = {
    monsters: QuizmonOwnedMonsterRow[];
    loading: boolean;
    error: string | null;
    refresh: () => void;

    // 무료 1회 소환
    pullFreeGacha: () => Promise<QuizmonOwnedMonsterRow | null>;
};

export function useQuizmonCollection(
    options: UseQuizmonCollectionOptions,
): UseQuizmonCollectionResult {
    const { profileId } = options;

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

    // 무료 소환 1회
    const pullFreeGacha = useCallback(async () => {
        if (!profileId) return null;

        setError(null);

        // 1) 종족 뽑기
        const speciesId = rollSpeciesId();

        // 2) 현재 파티 슬롯 상황 확인
        const currentPartySlots = new Set(
            monsters
                .map((m) => m.party_slot)
                .filter((s): s is number => typeof s === "number"),
        );

        let newPartySlot: number | null = null;
        for (let slot = 1; slot <= 3; slot++) {
            if (!currentPartySlots.has(slot)) {
                newPartySlot = slot;
                break;
            }
        }
        // 처음 3마리까지는 자동 파티 편성, 이후는 벤치 (party_slot = null)

        const { data, error } = await supabase
            .from("quizmon_owned_monsters")
            .insert({
                profile_id: profileId,
                species_id: speciesId,
                level: 1,
                exp: 0,
                party_slot: newPartySlot,
            })
            .select("*")
            .single();

        if (error) {
            console.error("[useQuizmonCollection] gacha insert error", error);
            setError("몬스터를 소환하는 중 오류가 발생했습니다.");
            return null;
        }

        const inserted = data as QuizmonOwnedMonsterRow;

        // 로컬 상태도 즉시 반영
        setMonsters((prev) => [...prev, inserted]);

        return inserted;
    }, [profileId, monsters]);

    return {
        monsters,
        loading,
        error,
        refresh,
        pullFreeGacha,
    };
}
