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
        <div className="w-full h-full flex flex-col bg-slate-50">
            {/* 헤더 - PEMV2 스타일 */}
            <div className="flex items-center gap-2 px-4 py-4 bg-white shadow-sm border-b border-gray-100">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                >
                    <ChevronLeft size={20} className="text-gray-600" />
                </button>
                <h1 className="text-xl font-bold text-gray-800">훈련장</h1>
            </div>

            {/* 컨텐츠 */}
            <div className="flex-1 px-6 pt-8 pb-6">
                <div className="space-y-4 max-w-lg mx-auto">
                    {/* 국어 카드 */}
                    <button
                        type="button"
                        onClick={onStartKorean}
                        className="group relative overflow-hidden w-full p-8 bg-white rounded-3xl 
                                 shadow-lg border-2 border-pink-100 hover:border-pink-300 
                                 transition-all text-left active:scale-[0.98]"
                    >
                        <div className="absolute right-0 top-0 w-32 h-32 bg-pink-50 rounded-full 
                                      translate-x-8 -translate-y-8 group-hover:bg-pink-100 transition-colors"></div>
                        
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-800">
                                    국어 훈련
                                </h3>
                                <p className="text-sm text-gray-500 mt-2">
                                    맞춤법을 배워요
                                </p>
                            </div>
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-100 to-pink-50 
                                          flex items-center justify-center text-3xl shadow-md
                                          group-hover:from-pink-200 group-hover:to-pink-100 transition-colors">
                                가
                            </div>
                        </div>
                    </button>

                    {/* 수학 카드 */}
                    <button
                        type="button"
                        onClick={onStartMath}
                        className="group relative overflow-hidden w-full p-8 bg-white rounded-3xl 
                                 shadow-lg border-2 border-blue-100 hover:border-blue-300 
                                 transition-all text-left active:scale-[0.98]"
                    >
                        <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-full 
                                      translate-x-8 -translate-y-8 group-hover:bg-blue-100 transition-colors"></div>
                        
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-800">
                                    수학 훈련
                                </h3>
                                <p className="text-sm text-gray-500 mt-2">
                                    계산 연습을 해요
                                </p>
                            </div>
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 
                                          flex items-center justify-center text-3xl shadow-md
                                          group-hover:from-blue-200 group-hover:to-blue-100 transition-colors">
                                7×
                            </div>
                        </div>
                    </button>

                    {/* 안내 메시지 */}
                    <div className="mt-8 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
                            <span className="text-2xl">⭐</span>
                            <span className="text-sm text-gray-600 font-medium">
                                문제를 맞히면 경험치를 얻어요!
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
