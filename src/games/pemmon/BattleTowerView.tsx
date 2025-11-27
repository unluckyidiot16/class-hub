// src/games/pemmon/BattleTowerView.tsx

import { ChevronLeft } from "lucide-react";
import type { PartnerState } from "./pemmonTypes";
import { PokemonSprite } from "./PokemonSprite";

type BattleTowerViewProps = {
    partner: PartnerState;
    onBack: () => void;
    onStartBattle: () => void;
};

export function BattleTowerView({
                                    partner,
                                    onBack,
                                    onStartBattle,
                                }: BattleTowerViewProps) {
    return (
        <div className="w-full h-full flex flex-col bg-[#fff5f6]">
            {/* 헤더 */}
            <div className="flex items-center gap-2 px-4 py-4 bg-[#fff5f6]">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-1 rounded-full hover:bg-rose-100"
                >
                    <ChevronLeft size={20} />
                </button>
                <h1 className="text-lg font-bold text-slate-800">
                    배틀 타워
                </h1>
            </div>

            {/* 중앙 카드 */}
            <div className="flex-1 flex flex-col items-center justify-start pt-8 px-6">
                <div className="w-40 h-40 rounded-full bg-white shadow-lg flex items-center justify-center mb-5">
                    <PokemonSprite species={partner.species} size={96} />
                </div>
                <div className="text-xl font-extrabold text-slate-800 mb-2">
                    배틀 시뮬레이션
                </div>
                <div className="text-sm text-slate-500 mb-6 text-center">
                    파트너가 자동으로 싸웁니다
                </div>
            </div>

            <div className="px-4 pb-6">
                <button
                    type="button"
                    onClick={onStartBattle}
                    className="w-full py-4 rounded-3xl bg-[#f97373] text-white font-bold text-base shadow-md active:scale-[0.98] transition"
                >
                    배틀 시작!
                </button>
            </div>
        </div>
    );
}
