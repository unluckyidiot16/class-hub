// src/games/pemmon/ExplorePrepareView.tsx

import { ChevronLeft, Map } from "lucide-react";

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
        <div className="w-full h-full flex flex-col bg-[#e9f9ee]">
            {/* 헤더 */}
            <div className="flex items-center gap-2 px-4 py-4 bg-[#e9f9ee]">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-1 rounded-full hover:bg-green-100"
                >
                    <ChevronLeft size={20} />
                </button>
                <h1 className="text-lg font-bold text-slate-800">탐험 준비</h1>
            </div>

            {/* 적용 아이템 */}
            <div className="px-4">
                <div className="bg-white rounded-3xl shadow-sm px-5 py-4 mb-4">
                    <div className="text-xs font-bold text-slate-500 mb-3">
                        현재 적용된 아이템
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#f3faf6] rounded-2xl px-3 py-3 flex flex-col justify-between">
                            <div className="text-2xl mb-1">🍀</div>
                            <div className="text-sm font-bold text-slate-800">
                                행운부적
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                {luckyCharmUses}회 남음
                            </div>
                        </div>
                        <div className="bg-[#f3faf6] rounded-2xl px-3 py-3 flex flex-col justify-between">
                            <div className="text-2xl mb-1">🚫🐛</div>
                            <div className="text-sm font-bold text-slate-800">
                                기피제
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                {repelUses}회 남음
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 지도 아이콘 + 볼 개수 */}
            <div className="px-4 flex-1 flex flex-col items-center mt-2">
                <div className="w-40 h-40 rounded-full bg-[#d3f2dd] flex flex-col items-center justify-center text-green-700 shadow-inner mb-3">
                    <Map size={56} />
                    <div className="text-xs mt-2 opacity-80">
                        몬스터를 찾아볼까요?
                    </div>
                </div>
                <div className="text-xs text-slate-500 mb-6">
                    몬스터볼:{" "}
                    <span className="font-bold text-slate-700">
                        {monsterBallCount}개
                    </span>
                </div>
            </div>

            {/* 버튼 */}
            <div className="px-4 pb-6">
                <button
                    type="button"
                    onClick={onStartExplore}
                    className="w-full py-4 rounded-3xl bg-green-500 text-white text-base font-bold shadow-md active:scale-[0.98] transition"
                >
                    숲으로 떠나기
                </button>
            </div>
        </div>
    );
}
