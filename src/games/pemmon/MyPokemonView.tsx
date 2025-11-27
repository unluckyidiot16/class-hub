// src/games/pemmon/MyPokemonView.tsx

import { ChevronLeft, Star } from "lucide-react";
import type { Species } from "./pemmonTypes";
import { PokemonSprite } from "./PokemonSprite";

export type OwnedMon = {
    id: string;
    species: Species;
    level: number;
    isPartner: boolean;
};

type MyPokemonViewProps = {
    onBack: () => void;
    mons: OwnedMon[];
    onSelectPartner?: (id: string) => void;
};

export function MyPokemonView({
                                  onBack,
                                  mons,
                                  onSelectPartner,
                              }: MyPokemonViewProps) {
    return (
        <div className="w-full h-full flex flex-col bg-slate-50">
            {/* 헤더 - PEMV2 스타일 */}
            <div className="flex items-center gap-2 px-4 py-4 bg-white shadow-sm border-b border-gray-100">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                >
                    <ChevronLeft size={20} className="text-gray-600" />
                </button>
                <h1 className="text-xl font-bold text-gray-800">내 포켓몬</h1>
            </div>

            {/* 내용 */}
            <div className="flex-1 px-4 pb-4">
                {mons.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <div className="text-6xl mb-4">🎒</div>
                            <div className="text-sm text-gray-400 font-medium">
                                아직 포켓몬이 없어요
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3 mt-4 overflow-y-auto pb-4">
                        {mons.map((mon) => {
                            const isPartner = mon.isPartner;
                            return (
                                <button
                                    key={mon.id}
                                    type="button"
                                    onClick={() => onSelectPartner?.(mon.id)}
                                    className={`
                                        bg-white p-3 rounded-2xl border-2 relative flex flex-col items-center 
                                        shadow-sm cursor-pointer transition-all active:scale-[0.98]
                                        ${isPartner 
                                            ? "border-blue-500 ring-2 ring-blue-100 bg-gradient-to-b from-blue-50 to-white shadow-lg" 
                                            : "border-gray-100 hover:border-gray-300 hover:shadow-md"
                                        }
                                    `}
                                >
                                    {isPartner && (
                                        <div className="absolute top-1 right-1">
                                            <div className="bg-blue-500 rounded-full p-1 shadow-sm">
                                                <Star size={10} className="fill-white text-white" />
                                            </div>
                                        </div>
                                    )}
                                    <PokemonSprite species={mon.species} size={64} />
                                    <div className="font-bold text-xs text-center text-gray-800 truncate w-full mt-2">
                                        {mon.species.name}
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-medium">
                                        Lv.{mon.level}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
