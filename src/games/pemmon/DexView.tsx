// src/games/pemmon/DexView.tsx

import { Search } from "lucide-react";
import { useState } from "react";
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
    const [searchTerm, setSearchTerm] = useState("");

    const filteredSpecies = searchTerm
        ? ALL_SPECIES.filter((s) =>
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.id.toString().includes(searchTerm)
        )
        : ALL_SPECIES;

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* 헤더 - PEMV2 스타일 */}
            <div className="bg-white shadow-sm border-b border-gray-100">
                <div className="p-4 flex items-center justify-between">
                    <button
                        className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 
                                 text-sm font-medium text-gray-700 transition-colors"
                        onClick={onBackToLobby}
                    >
                        ← 로비로
                    </button>
                    <div className="font-bold text-lg text-gray-800">
                        도감 ({filteredSpecies.length}/{ALL_SPECIES.length}종)
                    </div>
                    <div className="w-20" />
                </div>
                
                {/* 검색 바 */}
                <div className="px-4 pb-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="포켓몬 이름 또는 번호로 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border-2 border-gray-200 
                                     focus:border-blue-500 focus:ring-0 outline-none text-sm
                                     placeholder:text-gray-400"
                        />
                    </div>
                </div>
            </div>

            {/* 포켓몬 그리드 */}
            <div className="flex-1 overflow-auto p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {filteredSpecies.map((s) => {
                        const heightMeters = (s.height ?? 10) / 10;
                        const isLegendary = s.isLegendary;

                        return (
                            <div
                                key={s.id}
                                className={`
                                    bg-white rounded-2xl shadow-md border p-3 
                                    flex flex-col transition-all hover:shadow-lg hover:scale-[1.02]
                                    ${isLegendary 
                                        ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-white' 
                                        : 'border-gray-100'
                                    }
                                `}
                            >
                                {/* 헤더 */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs font-bold text-gray-500">
                                        #{s.id.toString().padStart(3, "0")}
                                    </div>
                                    {s.generation && (
                                        <div className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                            {s.generation}
                                        </div>
                                    )}
                                </div>

                                {/* 포켓몬 이미지 */}
                                <div className="flex items-center justify-center mb-2">
                                    <PokemonSprite species={s} size={72} />
                                </div>

                                {/* 이름 */}
                                <div className="font-bold text-sm text-center text-gray-800 mb-2">
                                    {s.name}
                                </div>

                                {/* 스탯 정보 */}
                                <div className="bg-gray-50 rounded-xl p-2 text-[10px] space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">체력</span>
                                        <span className="font-bold text-gray-700">{s.maxHp}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">공격</span>
                                        <span className="font-bold text-gray-700">{s.atk}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">방어</span>
                                        <span className="font-bold text-gray-700">{s.def}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">키</span>
                                        <span className="font-bold text-gray-700">{heightMeters.toFixed(1)}m</span>
                                    </div>
                                </div>

                                {/* 전설 배지 */}
                                {isLegendary && (
                                    <div className="mt-2 text-center">
                                        <span className="inline-block px-3 py-1 bg-gradient-to-r from-yellow-400 to-amber-500 
                                                       text-white text-[10px] font-bold rounded-full shadow-md">
                                            ⭐ 전설/환상
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
