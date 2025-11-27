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
        <div className="w-full h-full flex flex-col bg-gray-50">
            {/* 헤더 (PEMV2 Header 느낌) */}
            <div className="flex items-center gap-2 px-4 py-4 bg-white shadow-sm">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-1 rounded-full hover:bg-slate-100"
                >
                    <ChevronLeft size={20} />
                </button>
                <h1 className="text-lg font-bold text-slate-800">내 포켓몬</h1>
            </div>

            {/* 내용 */}
            <div className="flex-1 px-4 pb-4">
                {mons.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                        아직 포켓몬이 없어요.
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3 mt-2 overflow-y-auto pb-4">
                        {mons.map((mon) => {
                            const isPartner = mon.isPartner;
                            return (
                                <button
                                    key={mon.id}
                                    type="button"
                                    onClick={() => onSelectPartner?.(mon.id)}
                                    className={`bg-white p-2 rounded-xl border-2 relative flex flex-col items-center shadow-sm cursor-pointer transition-all
                                        ${
                                        isPartner
                                            ? "border-blue-500 ring-2 ring-blue-100 bg-blue-50"
                                            : "border-transparent hover:border-gray-200"
                                    }`}
                                >
                                    {isPartner && (
                                        <div className="absolute top-1 right-1 text-blue-500">
                                            <Star size={12} className="fill-current" />
                                        </div>
                                    )}
                                    <PokemonSprite species={mon.species} size={64} />
                                    <div className="font-bold text-xs text-center text-gray-800 truncate w-full mt-1">
                                        {mon.species.name}
                                    </div>
                                    <div className="text-[10px] text-gray-400">
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
