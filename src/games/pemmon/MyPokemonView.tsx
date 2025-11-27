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
        <div className="w-full h-full flex flex-col bg-[#f6f8fb]">
            {/* 헤더 */}
            <div className="flex items-center gap-2 px-4 py-4 bg-[#f6f8fb]">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-1 rounded-full hover:bg-slate-100"
                >
                    <ChevronLeft size={20} />
                </button>
                <h1 className="text-lg font-bold text-slate-800">
                    내 포켓몬
                </h1>
            </div>

            {/* 리스트 */}
            <div className="flex-1 px-4 pt-2 pb-6">
                {mons.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                        아직 포켓몬이 없어요.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {mons.map((mon) => (
                            <button
                                key={mon.id}
                                type="button"
                                onClick={() =>
                                    onSelectPartner?.(mon.id)
                                }
                                className={`bg-white rounded-3xl px-3 py-3 shadow-sm text-left flex flex-col items-center border-2 ${
                                    mon.isPartner
                                        ? "border-blue-400 shadow-blue-100"
                                        : "border-transparent"
                                }`}
                            >
                                <div className="w-full flex justify-between items-start mb-1">
                                    <span className="text-[11px] text-slate-400">
                                        Lv.{mon.level}
                                    </span>
                                    {mon.isPartner && (
                                        <Star
                                            size={14}
                                            className="text-blue-400 fill-blue-400"
                                        />
                                    )}
                                </div>
                                <PokemonSprite
                                    species={mon.species}
                                    size={64}
                                />
                                <div className="mt-2 text-sm font-bold text-slate-800">
                                    {mon.species.name}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
