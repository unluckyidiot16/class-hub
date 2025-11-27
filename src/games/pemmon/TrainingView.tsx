// src/games/pemmon/TrainingView.tsx

import { ChevronLeft } from "lucide-react";

type TrainingViewProps = {
    onBack: () => void;
    onStartKorean: () => void;
    onStartMath: () => void;
};

export function TrainingView({
                                 onBack,
                                 onStartKorean,
                                 onStartMath,
                             }: TrainingViewProps) {
    return (
        <div className="w-full h-full flex flex-col bg-[#f6f8fb]">
            {/* 헤더 */}
            <div className="flex items-center gap-2 px-4 py-4 bg-white shadow-sm">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-1 rounded-full hover:bg-slate-100"
                >
                    <ChevronLeft size={20} />
                </button>
                <h1 className="text-lg font-bold text-slate-800">훈련장</h1>
            </div>

            {/* 컨텐츠 */}
            <div className="flex-1 px-4 pt-4 pb-6">
                <div className="space-y-3">
                    {/* 국어 */}
                    <button
                        type="button"
                        onClick={onStartKorean}
                        className="w-full bg-white rounded-3xl border-2 border-pink-200 px-5 py-4 text-left shadow-sm active:scale-[0.98] transition flex items-center justify-between"
                    >
                        <div>
                            <div className="text-base font-bold text-slate-900">
                                국어 훈련
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                맞춤법을 배워요
                            </div>
                        </div>
                        <div className="w-14 h-14 rounded-full bg-pink-50 flex items-center justify-center text-2xl">
                            가
                        </div>
                    </button>

                    {/* 수학 */}
                    <button
                        type="button"
                        onClick={onStartMath}
                        className="w-full bg-white rounded-3xl border-2 border-blue-200 px-5 py-4 text-left shadow-sm active:scale-[0.98] transition flex items-center justify-between"
                    >
                        <div>
                            <div className="text-base font-bold text-slate-900">
                                수학 훈련
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                계산 연습을 해요
                            </div>
                        </div>
                        <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-2xl">
                            7×
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
