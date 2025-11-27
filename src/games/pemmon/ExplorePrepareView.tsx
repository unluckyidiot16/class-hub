// src/games/pemmon/ExplorePrepareView.tsx

import { ChevronLeft, Map, Sparkles } from "lucide-react";

type ExplorePrepareViewProps = {
    onBack: () => void;
    monsterBallCount: number;
    luckyCharmUses: number;
    repelUses: number;
    onStartExplore: () => void;
};

export function ExplorePrepareView({
                                       onBack,
                                       monsterBallCount,
                                       luckyCharmUses,
                                       repelUses,
                                       onStartExplore,
                                   }: ExplorePrepareViewProps) {
    return (
        <div className="w-full h-full flex flex-col bg-gradient-to-b from-green-50 to-white">
            {/* 헤더 - PEMV2 스타일 */}
            <div className="flex items-center gap-2 px-4 py-4 bg-white shadow-sm border-b border-green-100">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-2 rounded-xl hover:bg-green-50 transition-colors"
                >
                    <ChevronLeft size={20} className="text-gray-600" />
                </button>
                <h1 className="text-xl font-bold text-gray-800">탐험 준비</h1>
            </div>

            {/* 적용 아이템 카드 */}
            <div className="px-4 mt-4">
                <div className="bg-white rounded-3xl shadow-lg border border-green-100 px-5 py-4">
                    <div className="text-sm font-bold text-gray-600 mb-4 flex items-center gap-2">
                        <Sparkles size={16} className="text-yellow-500" />
                        현재 적용된 버프
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className={`
                            bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl px-4 py-4 
                            border ${luckyCharmUses > 0 ? 'border-green-300' : 'border-gray-200 opacity-50'}
                        `}>
                            <div className="text-3xl mb-2">🍀</div>
                            <div className="text-sm font-bold text-gray-800">
                                행운부적
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                {luckyCharmUses > 0 
                                    ? <span className="text-green-600 font-bold">{luckyCharmUses}회 남음</span>
                                    : <span>미적용</span>
                                }
                            </div>
                        </div>
                        <div className={`
                            bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl px-4 py-4
                            border ${repelUses > 0 ? 'border-purple-300' : 'border-gray-200 opacity-50'}
                        `}>
                            <div className="text-3xl mb-2">🚫</div>
                            <div className="text-sm font-bold text-gray-800">
                                기피제
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                {repelUses > 0 
                                    ? <span className="text-purple-600 font-bold">{repelUses}회 남음</span>
                                    : <span>미적용</span>
                                }
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 중앙 지도 아이콘 */}
            <div className="flex-1 flex flex-col items-center justify-center px-4">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-green-200 rounded-full blur-3xl opacity-40 animate-pulse"></div>
                    <div className="relative w-40 h-40 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 
                                  shadow-2xl flex flex-col items-center justify-center text-white">
                        <Map size={60} className="mb-2" />
                        <div className="text-xs font-bold opacity-90">
                            탐험 준비 완료!
                        </div>
                    </div>
                </div>
                
                {/* 몬스터볼 상태 */}
                <div className="bg-white rounded-2xl shadow-md px-6 py-3 border border-green-100">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">⚪</span>
                        <div>
                            <div className="text-xs text-gray-500">보유 중인 몬스터볼</div>
                            <div className="text-xl font-bold text-gray-800">
                                {monsterBallCount}개
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 하단 버튼 */}
            <div className="px-4 pb-6">
                <button
                    type="button"
                    onClick={onStartExplore}
                    className="w-full py-4 rounded-3xl bg-gradient-to-r from-green-500 to-emerald-600 
                             text-white text-lg font-bold shadow-xl active:scale-[0.98] transition-all
                             hover:from-green-600 hover:to-emerald-700"
                >
                    숲으로 떠나기
                </button>
            </div>
        </div>
    );
}
