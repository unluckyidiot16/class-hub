// src/games/pemmon/IntroView.tsx

import type { Species } from "./pemmonTypes";
import speciesData from "./pemmonSpecies.json";
import { PokemonSprite } from "./PokemonSprite";

type IntroViewProps = {
    trainerName: string;
    onChangeTrainerName: (name: string) => void;
    onSelectStarter: (species: Species) => void;
};

// JSON → 타입캐스팅
const ALL_SPECIES = speciesData as Species[];

// 스타팅 후보 (id 기반: 1,4,7 + 8세대/9세대 스타터 예시)
const STARTER_IDS = [1, 4, 7, 810, 813, 816];
const STARTERS: Species[] = ALL_SPECIES.filter((s) =>
    STARTER_IDS.includes(s.id),
);

export function IntroView({
                              trainerName,
                              onChangeTrainerName,
                              onSelectStarter,
                          }: IntroViewProps) {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-b from-blue-100 to-white">
            <h1 className="text-2xl font-bold mb-4 text-blue-800">
                포켓몬 맞춤법 탐험대
            </h1>
            <input
                className="w-full max-w-xs p-3 border rounded-xl mb-4"
                placeholder="트레이너 이름"
                value={trainerName}
                onChange={(e) => onChangeTrainerName(e.target.value)}
            />
            <p className="mb-2 text-gray-600 text-sm">
                파트너 포켓몬을 선택하세요
            </p>
            <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-4">
                {STARTERS.map((s) => (
                    <button
                        key={s.id}
                        className="bg-white rounded-xl shadow p-2 flex flex-col items-center hover:bg-blue-50"
                        onClick={() => onSelectStarter(s)}
                    >
                        <PokemonSprite species={s} size={64} />
                        <div className="text-xs font-bold mt-1">{s.name}</div>
                        <div className="text-[10px] text-gray-500">
                            HP {s.maxHp} · ATK {s.atk} · DEF {s.def}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
