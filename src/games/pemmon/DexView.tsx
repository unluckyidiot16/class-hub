// src/games/pemmon/DexView.tsx

import type { Species } from "./pemmonTypes";
import speciesData from "./pemmonSpecies.json";
import { getScaleForSpecies } from "./scaleUtils";

const ALL_SPECIES = (speciesData as Species[]).slice().sort((a, b) => a.id - b.id);

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
                <div className="font-bold text-sm">도감 ({ALL_SPECIES.length}종)</div>
                <div className="w-16" />
            </div>

            <div className="flex-1 overflow-auto p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {ALL_SPECIES.map((s) => {
                    const scale = getScaleForSpecies(s);
                    const heightMeters = (s.height ?? 10) / 10;

                    return (
                        <div
                            key={s.id}
                            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 flex flex-col text-xs"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="font-bold">
                                    #{s.id.toString().padStart(3, "0")} {s.name}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    {s.generation ?? ""}
                                </div>
                            </div>

                            {/* 크기 시각화 박스 */}
                            <div className="relative mt-1 mb-2 h-16 flex items-end justify-center">
                                <div className="absolute bottom-1 left-2 right-2 h-[1px] bg-slate-200" />
                                <div
                                    className="w-10 h-10 bg-gradient-to-t from-slate-200 to-slate-100 rounded-full flex items-center justify-center text-base"
                                    style={{
                                        transformOrigin: "bottom center",
                                        transform: `scale(${scale})`,
                                    }}
                                >
                                    {/* 간단한 이모지 placeholder */}
                                    <span>⭐</span>
                                </div>
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
