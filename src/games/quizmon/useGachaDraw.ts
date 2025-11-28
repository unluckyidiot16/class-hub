// src/games/quizmon/useGachaDraw.ts
import { useCallback, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import type {
    QuizmonProfileRow,
    QuizmonSpeciesRow,
} from "./types";

type GachaMode = "gems";

export type GachaLastResult = {
    speciesId: string;
    species: QuizmonSpeciesRow;
    kind: "new" | "duplicate";
    starShardsGained: number;
    abilityId?: string;
};

type UseGachaDrawOptions = {
    profile: QuizmonProfileRow | null;
    onProfileUpdated?: (profile: QuizmonProfileRow | null) => void;
};

// 🔹 간단한 특성 롤: 각 종마다 basic / rare 2종을 가정
function rollAbilityForSpecies(
    species: QuizmonSpeciesRow,
): { abilityId: string; variant: "basic" | "rare" } {
    const speciesId = (species as any).id as string;
    const roll = Math.random();

    // 기본 80%, 희귀 20% (원하면 나중에 종/레어도별로 다르게 튜닝)
    if (roll < 0.2) {
        return {
            abilityId: `${speciesId}-rare`,
            variant: "rare",
        };
    }
    return {
        abilityId: `${speciesId}-basic`,
        variant: "basic",
    };
}

export function useGachaDraw(options: UseGachaDrawOptions) {
    const { profile, onProfileUpdated } = options;

    const [drawing, setDrawing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<GachaLastResult | null>(null);

    const pullGacha = useCallback(
        async (mode: GachaMode) => {
            if (!profile) {
                setError("프로필 정보를 찾을 수 없습니다.");
                return;
            }
            if (drawing) return; // 중복 클릭 방지

            setDrawing(true);
            setError(null);

            try {
                // 1) 현재 프로필 재화 스냅샷
                let gems = profile.gacha_gems ?? 0;
                let starShards = profile.star_shards ?? 0;

                if (mode === "gems") {
                    if (gems <= 0) {
                        throw new Error("가챠를 돌릴 젬이 부족합니다.");
                    }
                    gems -= 1; // 1회 소환당 젬 1개 소비
                }

                // 2) 가챠 풀: quizmon_species 전체(혹은 나중에 rarity 기반 조정)
                const { data: speciesRows, error: speciesError } =
                    await supabase
                        .from("quizmon_species")
                        .select(
                            "id, name, element, rarity, base_hp, base_atk, base_def, base_spd, pokedex_no, sprite_key, description",
                        );

                if (speciesError || !speciesRows || speciesRows.length === 0) {
                    console.error(
                        "[useGachaDraw] species select error",
                        speciesError,
                    );
                    throw new Error(
                        "가챠 풀을 불러오는 중 오류가 발생했습니다.",
                    );
                }

                const pool = speciesRows as QuizmonSpeciesRow[];

                // 🔹 TODO: 나중에 rarity / gacha_weight 컬럼 생기면 가중치 랜덤으로 교체
                const chosenIndex = Math.floor(Math.random() * pool.length);
                const species = pool[chosenIndex];
                const speciesId = (species as any).id as string;

                // 3) 이미 보유한 종인지 확인
                const { data: ownedRows, error: ownedError } = await supabase
                    .from("quizmon_owned_monsters")
                    .select("id")
                    .eq("profile_id", profile.id)
                    .eq("species_id", speciesId);

                if (ownedError) {
                    console.error(
                        "[useGachaDraw] owned check error",
                        ownedError,
                    );
                    throw new Error(
                        "보유 몬스터 정보를 확인하는 중 오류가 발생했습니다.",
                    );
                }

                const isDuplicate = !!(ownedRows && ownedRows.length > 0);

                let starShardsGained = 0;
                let abilityId: string | undefined;

                if (isDuplicate) {
                    // 🔹 중복 → Star Shards 지급
                    const rarity =
                        (species as any).rarity != null
                            ? Number((species as any).rarity)
                            : 1;
                    // 예시: 레어도 * 5개 (원하면 나중에 조정)
                    starShardsGained = Math.max(1, rarity * 5);
                    starShards += starShardsGained;
                } else {
                    // 🔹 신규 획득 → 능력 롤 + owned_monsters 행 생성
                    const abilityRoll = rollAbilityForSpecies(species);
                    abilityId = abilityRoll.abilityId;

                    const { data: inserted, error: insertError } =
                        await supabase
                            .from("quizmon_owned_monsters")
                            .insert({
                                profile_id: profile.id,
                                species_id: speciesId,
                                level: 1,
                                exp: 0,
                                party_slot: null,
                                current_hp: null,
                                is_fainted: false,
                                learned_moves: [],
                                abilityId,
                            })
                            .select("id")
                            .maybeSingle();

                    if (insertError || !inserted) {
                        console.error(
                            "[useGachaDraw] insert owned error",
                            insertError,
                        );
                        throw new Error(
                            "몬스터를 추가하는 중 오류가 발생했습니다.",
                        );
                    }
                }

                // 4) 프로필(gacha_gems / star_shards) 업데이트
                const { data: updatedProfile, error: profileError } =
                    await supabase
                        .from("quizmon_profiles")
                        .update({
                            gacha_gems: gems,
                            star_shards: starShards,
                        })
                        .eq("id", profile.id)
                        .select("*")
                        .maybeSingle();

                if (profileError || !updatedProfile) {
                    console.error(
                        "[useGachaDraw] profile update error",
                        profileError,
                    );
                    throw new Error(
                        "프로필 정보를 저장하는 중 오류가 발생했습니다.",
                    );
                }

                if (onProfileUpdated) {
                    onProfileUpdated(updatedProfile as QuizmonProfileRow);
                }

                // 5) 마지막 결과 상태 업데이트 → UI에서 표시
                setLastResult({
                    speciesId,
                    species,
                    kind: isDuplicate ? "duplicate" : "new",
                    starShardsGained,
                    abilityId,
                });
            } catch (err: any) {
                console.error("[useGachaDraw] pullGacha error", err);
                setError(
                    err?.message ?? "가챠 중 오류가 발생했습니다.",
                );
            } finally {
                setDrawing(false);
            }
        },
        [profile, onProfileUpdated, drawing],
    );

    return {
        drawing,
        error,
        pullGacha,
        lastResult,
    };
}
