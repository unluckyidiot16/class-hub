// src/games/pemmon/IntroView.tsx

import type { Species } from "./pemmonTypes";
import speciesData from "./pemmonSpecies.json";
import { PokemonSprite } from "./PokemonSprite";

type IntroViewProps = {
    trainerName: string;
    onChangeTrainerName: (name: string) => void;
    onSelectStarter: (species: Species) => void;
};

// 전체 포켓몬 JSON → 타입 캐스팅
const ALL_SPECIES = speciesData as Species[];

// 스타터 후보 (1세대 3종 기준)
const STARTER_IDS = [1, 4, 7];
const STARTERS: Species[] = ALL_SPECIES.filter((s) =>
    STARTER_IDS.includes(s.id),
);

export function IntroView({
                              trainerName,
                              onChangeTrainerName,
                              onSelectStarter,
                          }: IntroViewProps) {
    return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-blue-100 to-white p-4">
            <div className="w-full max-w-md">
                {/* 타이틀 */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-blue-800 mb-2">
                        포켓몬 맞춤법 탐험대
                    </h1>
                    <div className="inline-block bg-yellow-400 px-4 py-1 rounded-full text-yellow-900 text-xs font-bold shadow-md">
                        PokéAPI ver.
                    </div>
                </div>

                {/* 메인 카드 - PEMV2 스타일 */}
                <div className="bg-white rounded-3xl shadow-xl p-6">
                    <label className="block text-lg font-bold mb-3 text-gray-700">
                        트레이너 이름
                    </label>
                    <input
                        className="w-full p-4 text-xl border-2 border-gray-200 rounded-2xl mb-6 
                                 focus:border-blue-500 focus:ring-0 outline-none placeholder:text-gray-400 
                                 transition-all"
                        placeholder="이름을 입력하세요"
                        value={trainerName}
                        onChange={(e) => onChangeTrainerName(e.target.value)}
                    />

                    <p className="text-md font-bold mb-4 text-center text-gray-600">
                        함께할 파트너를 골라주세요
                    </p>

                    <div className="grid grid-cols-3 gap-3">
                        {STARTERS.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                    if (!trainerName.trim()) {
                                        alert("먼저 트레이너 이름을 입력해 주세요.");
                                        return;
                                    }
                                    onSelectStarter(s);
                                }}
                                className="group flex flex-col items-center p-3 bg-gray-50 rounded-2xl 
                                         shadow-sm border-2 border-transparent 
                                         hover:border-blue-400 hover:bg-blue-50 hover:shadow-md
                                         active:scale-95 transition-all"
                            >
                                <div className="relative">
                                    <div className="absolute inset-0 bg-blue-200 rounded-full blur-xl opacity-0 
                                                  group-hover:opacity-30 transition-opacity"></div>
                                    <PokemonSprite species={s} size={80} />
                                </div>
                                <div className="font-bold text-sm text-gray-800 mt-2">
                                    {s.name}
                                </div>
                                <div className="text-[10px] text-gray-500 font-medium">
                                    타입: {s.type1}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
