// src/games/pemmon/IntroView.tsx

import type { Species } from "./pemmonTypes";

const STARTERS: Species[] = [
    { id: 1, name: "이상해씨", maxHp: 45, atk: 49, def: 49 },
    { id: 4, name: "파이리", maxHp: 39, atk: 52, def: 43 },
    { id: 7, name: "꼬부기", maxHp: 44, atk: 48, def: 65 },
];

type IntroViewProps = {
    trainerName: string;
    onChangeTrainerName: (name: string) => void;
    onSelectStarter: (species: Species) => void;
};

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
                        <div className="w-12 h-12 bg-gray-100 rounded-full mb-1 flex items-center justify-center text-xl">
                            {s.id === 1 ? "🌱" : s.id === 4 ? "🔥" : "💧"}
                        </div>
                        <div className="text-xs font-bold">{s.name}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}
