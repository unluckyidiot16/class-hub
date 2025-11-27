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

// 스타터 후보 (1세대 3종 기준, 필요하면 id 배열만 수정)
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
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#e5f0ff] to-[#f5f7fb]">
            <div className="w-full max-w-md px-6 py-10 flex flex-col items-center">
                {/* 타이틀 */}
                <h1 className="text-2xl md:text-3xl font-extrabold text-[#1d4ed8] mb-2 text-center">
                    포켓몬 맞춤법 탐험대
                </h1>
                <div className="bg-[#facc15] px-3 py-1 rounded-full text-[#854d0e] text-xs font-extrabold mb-8 shadow-sm">
                    PokéAPI ver.
                </div>

                {/* 카드 */}
                <div className="w-full bg-white rounded-3xl shadow-xl px-6 py-7">
                    <label className="block text-lg font-bold mb-2 text-gray-700">
                        트레이너 이름
                    </label>
                    <input
                        className="w-full p-4 text-lg border-2 border-gray-200 rounded-2xl mb-6 focus:border-blue-500 focus:ring-0 outline-none placeholder:text-gray-400 transition"
                        placeholder="이름을 입력하세요"
                        value={trainerName}
                        onChange={(e) =>
                            onChangeTrainerName(e.target.value)
                        }
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
                                        alert(
                                            "먼저 트레이너 이름을 입력해 주세요.",
                                        );
                                        return;
                                    }
                                    onSelectStarter(s);
                                }}
                                className="flex flex-col items-center p-3 bg-gray-50 rounded-2xl shadow-sm border-2 border-transparent hover:border-blue-400 hover:bg-blue-50/60 active:scale-95 transition-all"
                            >
                                <PokemonSprite species={s} size={80} />
                                <div className="font-bold text-sm text-gray-800 mt-2">
                                    {s.name}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
