// src/games/pemmon/DexView.tsx

import type { Species } from "./pemmonTypes";
import speciesData from "./pemmonSpecies.json";
import { PokemonSprite } from "./PokemonSprite";

const ALL_SPECIES = (speciesData as Species[])
    .slice()
    .sort((a, b) => a.id - b.id);

type DexViewProps = {
    onBackToLobby: () => void;
};

export function DexView({ onBackToLobby }: DexViewProps) {
    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="p-3 border-b bg-white flex items-center justify-between">
                <button
                    className="px-3 py-1 rounded-full bg-slate-200 text-xs"
                    onClick={onBackToLobby}
                >
                    ← 로비로
                </button>
                <div className="font-bold text-sm">
                    도감 ({ALL_SPECIES.length}종)
                </div>
                <div className="w-16" />
            </div>

            <div className="flex-1 overflow-auto p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {ALL_SPECIES.map((s) => {
                    const heightMeters = (s.height ?? 10) / 10;

                    return (
                        <div
                            key={s.id}
                            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 flex flex-col text-xs"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="font-bold">
                                    #{s.id.toString().padStart(3, "0")}{" "}
                                    {s.name}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    {s.generation ?? ""}
                                </div>
                            </div>

                            {/* 실제 포켓몬 스프라이트 + 키 기반 스케일링 */}
                            <div className="mt-1 mb-2 flex items-center justify-center">
                                <PokemonSprite species={s} size={64} />
                            </div>

                            <div className="flex justify-between text-[10px] text-slate-600">
                                <div>
                                    <div>HP {s.maxHp}</div>
                                    <div>ATK {s.atk}</div>
                                    <div>DEF {s.def}</div>
                                </div>
                                <div className="text-right">
                                    <div>키 {heightMeters.toFixed(1)} m</div>
                                    {s.isLegendary && (
                                        <div className="mt-1 text-amber-500 font-bold">
                                            전설/환상
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
