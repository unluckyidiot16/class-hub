// src/games/quizmon/DexTab.tsx
import { useEffect, useMemo, useState } from "react";
import type {
    QuizmonOwnedMonsterRow,
    QuizmonSpeciesRow,
    AbilityId,
} from "./types";
import { supabase } from "../../lib/supabaseClient";
import { getMonsterIcon, getMonsterSprite } from "./assets";
import {
    DexEntryDetailPanel,
    type DexSpeciesStats,
    type DexMoveInfo,
    type DexAbilityInfo,
} from "./DexEntryDetailPanel";

type DexTabProps = {
    monsters?: QuizmonOwnedMonsterRow[];
    selectedSpeciesId: string | null;
    onSelectSpecies?: (speciesId: string) => void;
};

// ✅ 간단 element 라벨/색
function getElementMeta(element: string | null | undefined) {
    switch (element) {
        case "grass":
            return { label: "풀", color: "#4ade80" };
        case "fire":
            return { label: "불꽃", color: "#f97316" };
        case "water":
            return { label: "물", color: "#38bdf8" };
        case "electric":
            return { label: "전기", color: "#facc15" };
        default:
            return { label: "노말", color: "#e5e7eb" };
    }
}

// ✅ v1 특성 기본 매핑 (PartyAndDexPanel 과 동일 컨셉)
const ABILITY_DB: Record<
    AbilityId,
    { name: string; description: string }
> = {
    overgrow: {
        name: "풀의 힘",
        description: "HP 1/3 이하일 때 풀 기술 위력 1.5배",
    },
    water_guard: {
        name: "물의 보호",
        description: "받는 물 기술 피해 0.8배",
    },
};

function getDefaultAbilityForSpeciesRow(
    species: QuizmonSpeciesRow,
): AbilityId | null {
    if (species.element === "grass") return "overgrow";
    if (species.element === "water") return "water_guard";
    return null;
}

function toDexStats(species: QuizmonSpeciesRow): DexSpeciesStats {
    const hp = species.base_hp ?? 1;
    const atk = species.base_atk ?? 1;
    const def = species.base_def ?? 1;
    const spd = species.base_spd ?? 1;

    return {
        hp,
        atk,
        def,
        spAtk: atk, // v1: 특수공/특수방은 일단 동일 값으로
        spDef: def,
        spd,
    };
}

function toDexAbilities(
    species: QuizmonSpeciesRow,
): DexAbilityInfo[] {
    const id = getDefaultAbilityForSpeciesRow(species);
    if (!id) return [];
    const info = ABILITY_DB[id];
    if (!info) return [];
    return [
        {
            id,
            name: info.name,
            description: info.description,
            rarityLabel: "기본",
        },
    ];
}

export function DexTab(props: DexTabProps) {
    const { monsters, selectedSpeciesId, onSelectSpecies } = props;

    const [speciesList, setSpeciesList] = useState<QuizmonSpeciesRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 필터/정렬 상태
    const [filterMode, setFilterMode] = useState<"all" | "seen" | "unseen">(
        "all",
    );
    const [sortMode, setSortMode] = useState<"pokedex" | "name">(
        "pokedex",
    );

    // 내부 선택 상태 (부모 state와 동기화)
    const [internalSelectedId, setInternalSelectedId] = useState<
        string | null
    >(selectedSpeciesId);

    useEffect(() => {
        setInternalSelectedId(selectedSpeciesId);
    }, [selectedSpeciesId]);

    // ✅ 최초 로드 시 quizmon_species 전체 조회
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                setLoading(true);
                setError(null);

                const { data, error } = await supabase
                    .from("quizmon_species")
                    .select("*")
                    .order("pokedex_no", { ascending: true });

                if (error) throw error;
                if (cancelled) return;

                setSpeciesList((data ?? []) as QuizmonSpeciesRow[]);
            } catch (e: any) {
                console.error("[DexTab] load species error", e);
                if (!cancelled) {
                    setError("도감 데이터를 불러오는 중 오류가 발생했습니다.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // ✅ 발견한 종 집계
    const discoveredSet = useMemo(() => {
        const set = new Set<string>();
        (monsters ?? []).forEach((m) => {
            const id = (m as any).species_id as string | null;
            if (id) set.add(id);
        });
        return set;
    }, [monsters]);

    // ✅ 정렬/필터 적용된 리스트
    const filteredList = useMemo(() => {
        let list = [...speciesList];

        if (filterMode === "seen") {
            list = list.filter((s) => discoveredSet.has(s.id));
        } else if (filterMode === "unseen") {
            list = list.filter((s) => !discoveredSet.has(s.id));
        }

        if (sortMode === "name") {
            list.sort((a, b) =>
                (a.name ?? "").localeCompare(b.name ?? "", "ko"),
            );
        } else {
            // pokedex_no 기준 정렬 (없으면 id)
            list.sort((a, b) => {
                const aNo = (a as any).pokedex_no ?? 9999;
                const bNo = (b as any).pokedex_no ?? 9999;
                if (aNo !== bNo) return aNo - bNo;
                return a.id.localeCompare(b.id);
            });
        }

        return list;
    }, [speciesList, filterMode, sortMode, discoveredSet]);

    const selectedSpecies =
        filteredList.find((s) => s.id === internalSelectedId) ??
        speciesList.find((s) => s.id === internalSelectedId) ??
        null;

    const selectedElementMeta = selectedSpecies
        ? getElementMeta(selectedSpecies.element as any)
        : { label: "", color: "#e5e7eb" };

    const handleSelect = (id: string) => {
        setInternalSelectedId(id);
        onSelectSpecies?.(id);
    };

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "row",
                gap: "1rem",
                height: "100%",
                minHeight: 0,
            }}
        >
            {/* 왼쪽: 필터 + 도감 리스트 */}
            <div
                style={{
                    width: "40%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    minWidth: 0,
                }}
            >
                {/* 필터/정렬 바 */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        alignItems: "center",
                    }}
                >
                    <div style={{ display: "flex", gap: 4 }}>
                        {[
                            { key: "all", label: "전체" },
                            { key: "seen", label: "발견" },
                            { key: "unseen", label: "미발견" },
                        ].map((f) => {
                            const active = filterMode === f.key;
                            return (
                                <button
                                    key={f.key}
                                    type="button"
                                    onClick={() =>
                                        setFilterMode(f.key as typeof filterMode)
                                    }
                                    style={{
                                        padding: "4px 8px",
                                        borderRadius: 999,
                                        border: active
                                            ? "1px solid rgba(129,140,248,0.9)"
                                            : "1px solid rgba(55,65,81,0.9)",
                                        fontSize: "0.75rem",
                                        background: active
                                            ? "rgba(37,99,235,0.25)"
                                            : "rgba(15,23,42,0.8)",
                                        color: active ? "#e5e7eb" : "#9ca3af",
                                        cursor: "pointer",
                                    }}
                                >
                                    {f.label}
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ display: "flex", gap: 4 }}>
                        {[
                            { key: "pokedex", label: "도감 순" },
                            { key: "name", label: "이름 순" },
                        ].map((s) => {
                            const active = sortMode === s.key;
                            return (
                                <button
                                    key={s.key}
                                    type="button"
                                    onClick={() =>
                                        setSortMode(s.key as typeof sortMode)
                                    }
                                    style={{
                                        padding: "4px 8px",
                                        borderRadius: 999,
                                        border: active
                                            ? "1px solid rgba(129,140,248,0.9)"
                                            : "1px solid rgba(55,65,81,0.9)",
                                        fontSize: "0.75rem",
                                        background: active
                                            ? "rgba(37,99,235,0.25)"
                                            : "rgba(15,23,42,0.8)",
                                        color: active ? "#e5e7eb" : "#9ca3af",
                                        cursor: "pointer",
                                    }}
                                >
                                    {s.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 리스트 영역 */}
                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        borderRadius: 16,
                        border: "1px solid rgba(31,41,55,0.9)",
                        background:
                            "radial-gradient(circle at top, rgba(30,64,175,0.35), rgba(15,23,42,0.95))",
                        padding: "0.5rem",
                        overflowY: "auto",
                    }}
                >
                    {loading && (
                        <div
                            style={{
                                padding: "0.75rem",
                                fontSize: "0.8rem",
                                color: "#9ca3af",
                            }}
                        >
                            도감 불러오는 중...
                        </div>
                    )}
                    {error && (
                        <div
                            style={{
                                padding: "0.75rem",
                                fontSize: "0.8rem",
                                color: "#fca5a5",
                            }}
                        >
                            {error}
                        </div>
                    )}

                    {!loading &&
                        !error &&
                        filteredList.map((s) => {
                            const discovered = discoveredSet.has(s.id);
                            const ownedCount = (monsters ?? []).filter(
                                (m) => (m as any).species_id === s.id,
                            ).length;
                            const iconUrl = getMonsterIcon(s.id);
                            const { label, color } = getElementMeta(
                                s.element as any,
                            );
                            const active = internalSelectedId === s.id;

                            return (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => handleSelect(s.id)}
                                    style={{
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "6px 8px",
                                        borderRadius: 12,
                                        marginBottom: 4,
                                        background: active
                                            ? "rgba(30,64,175,0.5)"
                                            : "rgba(15,23,42,0.8)",
                                        border: active
                                            ? "1px solid rgba(129,140,248,0.9)"
                                            : "1px solid rgba(31,41,55,0.9)",
                                        cursor: "pointer",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 10,
                                                background: discovered
                                                    ? "rgba(15,23,42,0.9)"
                                                    : "rgba(15,23,42,0.95)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                overflow: "hidden",
                                            }}
                                        >
                                            {iconUrl && discovered ? (
                                                <img
                                                    src={iconUrl}
                                                    alt={s.name ?? ""}
                                                    style={{
                                                        width: 40,
                                                        height: 40,
                                                        imageRendering: "pixelated",
                                                        filter: discovered
                                                            ? "none"
                                                            : "grayscale(1) brightness(0.3)",
                                                    }}
                                                />
                                            ) : (
                                                <span
                                                    style={{
                                                        fontSize: "0.7rem",
                                                        color: "#4b5563",
                                                    }}
                                                >
                          ??
                        </span>
                                            )}
                                        </div>
                                        <div style={{ textAlign: "left" }}>
                                            <div
                                                style={{
                                                    fontSize: "0.8rem",
                                                    fontWeight: 600,
                                                    color: discovered
                                                        ? "#e5e7eb"
                                                        : "#6b7280",
                                                }}
                                            >
                                                {discovered ? s.name : "???"}
                                            </div>
                                            <div
                                                style={{
                                                    marginTop: 2,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 6,
                                                    fontSize: "0.7rem",
                                                    color: "#9ca3af",
                                                }}
                                            >
                        <span>
                          No.{(s as any).pokedex_no ?? "??"}
                        </span>
                                                <span
                                                    style={{
                                                        padding: "0 6px",
                                                        borderRadius: 999,
                                                        backgroundColor: color,
                                                        color: "#020617",
                                                        fontWeight: 600,
                                                    }}
                                                >
                          {label}
                        </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            fontSize: "0.7rem",
                                            color: "#9ca3af",
                                        }}
                                    >
                                        보유 {ownedCount}마리
                                    </div>
                                </button>
                            );
                        })}
                </div>
            </div>

            {/* 오른쪽: 상세 패널 */}
            <div
                style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 0,
                }}
            >
                {selectedSpecies ? (
                    <DexEntryDetailPanel
                        name={selectedSpecies.name ?? "알 수 없음"}
                        code={selectedSpecies.id}
                        elementLabel={selectedElementMeta.label}
                        elementColor={selectedElementMeta.color}
                        spriteUrl={getMonsterSprite(selectedSpecies.id) || undefined}
                        flavorText={selectedSpecies.description ?? ""}
                        stats={toDexStats(selectedSpecies)}
                        moves={[] as DexMoveInfo[]} // v1: 나중에 채움
                        abilities={toDexAbilities(selectedSpecies)}
                        firstObtainedAt={null} // TODO: 나중에 얻게 되면 연동
                    />
                ) : (
                    <div
                        style={{
                            height: "100%",
                            borderRadius: 16,
                            border: "1px solid rgba(31,41,55,0.9)",
                            background:
                                "radial-gradient(circle at top, rgba(30,64,175,0.35), rgba(15,23,42,0.95))",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.85rem",
                            color: "#9ca3af",
                        }}
                    >
                        왼쪽에서 포켓몬을 선택하면 상세 정보를 보여줄게요.
                    </div>
                )}
            </div>
        </div>
    );
}
