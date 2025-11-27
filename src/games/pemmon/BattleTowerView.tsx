// src/games/pemmon/BattleTowerView.tsx

import { ChevronLeft, Sword, Trophy } from "lucide-react";
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
        <div className="w-full h-full flex flex-col bg-gradient-to-b from-red-50 to-white">
            {/* 헤더 - PEMV2 스타일 */}
            <div className="flex items-center gap-2 px-4 py-4 bg-white shadow-sm border-b border-red-100">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-2 rounded-xl hover:bg-red-50 transition-colors"
                >
                    <ChevronLeft size={20} className="text-gray-600" />
                </button>
                <h1 className="text-xl font-bold text-gray-800">
                    배틀 타워
                </h1>
            </div>

            {/* 중앙 콘텐츠 */}
            <div className="flex-1 flex flex-col items-center justify-center px-6">
                {/* 배틀 아이콘 */}
                <div className="mb-6 relative">
                    <div className="absolute inset-0 bg-red-200 rounded-full blur-2xl opacity-30 animate-pulse"></div>
                    <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-red-400 to-red-600 
                                  shadow-2xl flex items-center justify-center">
                        <Sword size={56} className="text-white transform rotate-45" />
                    </div>
                </div>

                {/* 파트너 카드 */}
                <div className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-sm border border-red-100">
                    <div className="flex items-center justify-center mb-4">
                        <div className="w-24 h-24 bg-gradient-to-b from-red-50 to-white rounded-2xl 
                                      shadow-inner border border-red-100 flex items-center justify-center">
                            <PokemonSprite species={partner.species} size={80} />
                        </div>
                    </div>
                    
                    <div className="text-center mb-4">
                        <div className="text-2xl font-bold text-gray-800 mb-1">
                            {partner.species.name}
                        </div>
                        <div className="text-sm text-gray-500 font-medium">
                            Lv.{partner.level} 파트너
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl p-4 mb-4">
                        <div className="flex justify-around text-sm">
                            <div className="text-center">
                                <div className="text-gray-500 text-xs mb-1">체력</div>
                                <div className="font-bold text-gray-800">{partner.maxHp}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-gray-500 text-xs mb-1">공격</div>
                                <div className="font-bold text-gray-800">{partner.species.atk || 50}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-gray-500 text-xs mb-1">방어</div>
                                <div className="font-bold text-gray-800">{partner.species.def || 50}</div>
                            </div>
                        </div>
                    </div>

                    <div className="text-center text-sm text-gray-600 mb-4">
                        <Trophy className="inline-block mr-1 text-yellow-500" size={16} />
                        자동 배틀 시뮬레이션
                    </div>
                </div>
            </div>

            {/* 하단 버튼 */}
            <div className="px-4 pb-6">
                <button
                    type="button"
                    onClick={onStartBattle}
                    className="w-full py-4 rounded-3xl bg-gradient-to-r from-red-500 to-red-600 
                             text-white font-bold text-lg shadow-xl active:scale-[0.98] transition-all
                             hover:from-red-600 hover:to-red-700"
                >
                    배틀 시작!
                </button>
            </div>
        </div>
    );
}
