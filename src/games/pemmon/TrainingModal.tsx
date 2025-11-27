// src/games/pemmon/TrainingModal.tsx

import { CheckCircle, XCircle, Trophy } from "lucide-react";
import type { TrainingState } from "./pemmonTypes";

type TrainingModalProps = {
    state: TrainingState;
    onSelectOption: (index: number) => void;
    onNext: () => void;
    onClose: () => void;
};

export function TrainingModal({
                                  state,
                                  onSelectOption,
                                  onNext,
                                  onClose,
                              }: TrainingModalProps) {
    if (state.phase === "idle") return null;

    // 결과 화면 - PEMV2 스타일
    if (state.phase === "result") {
        const successRate = Math.round((state.correct / state.total) * 100);
        const isExcellent = successRate >= 80;
        const isGood = successRate >= 60 && successRate < 80;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
                <div className="w-full max-w-sm mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden animate-slideUp">
                    {/* 헤더 배경 */}
                    <div className={`
                        h-32 flex items-center justify-center
                        ${isExcellent ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                          isGood ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                          'bg-gradient-to-br from-gray-400 to-gray-600'}
                    `}>
                        <Trophy size={64} className="text-white animate-bounce" />
                    </div>

                    {/* 콘텐츠 */}
                    <div className="p-6 text-center">
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">
                            훈련 완료!
                        </h2>
                        
                        {/* 점수 표시 */}
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-4 mb-4">
                            <div className="text-3xl font-bold text-gray-800 mb-1">
                                {state.correct} / {state.total}
                            </div>
                            <div className="text-sm text-gray-600">
                                정답률 {successRate}%
                            </div>
                        </div>

                        {/* 보상 표시 */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="bg-green-50 rounded-xl p-3">
                                <div className="text-2xl mb-1">✨</div>
                                <div className="text-xs text-gray-600">경험치</div>
                                <div className="text-lg font-bold text-green-600">
                                    +{state.expGain}
                                </div>
                            </div>
                            <div className="bg-yellow-50 rounded-xl p-3">
                                <div className="text-2xl mb-1">🪙</div>
                                <div className="text-xs text-gray-600">코인</div>
                                <div className="text-lg font-bold text-yellow-600">
                                    +{state.coinGain}
                                </div>
                            </div>
                        </div>

                        {/* 닫기 버튼 */}
                        <button
                            className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 
                                     text-white font-bold shadow-lg active:scale-[0.98] transition-all
                                     hover:from-blue-600 hover:to-blue-700"
                            onClick={onClose}
                        >
                            확인
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 퀴즈 화면
    const q = state.questions[state.index];
    const total = state.questions.length;
    const currentNo = state.index + 1;
    const progress = (currentNo / total) * 100;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden animate-slideUp">
                {/* 헤더 */}
                <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold text-gray-600">
                            훈련 문제
                        </div>
                        <div className="text-sm text-gray-500">
                            {currentNo} / {total}
                        </div>
                    </div>
                    {/* 진행바 */}
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* 문제 */}
                <div className="px-6 pt-6 pb-4">
                    <div className="text-lg font-bold text-gray-800 text-center mb-6 min-h-[60px] flex items-center justify-center">
                        {q.text}
                    </div>

                    {/* 보기 */}
                    <div className="grid grid-cols-2 gap-3">
                        {q.options?.map((opt, idx) => {
                            const isSelected = state.selectedIndex === idx;
                            const isCorrectOpt = q.answer_index === idx;
                            const showResult = state.isAnswered;

                            let buttonClass = "bg-gray-50 hover:bg-blue-50 text-gray-700 border-2 border-gray-200 hover:border-blue-300";
                            
                            if (showResult) {
                                if (isCorrectOpt) {
                                    buttonClass = "bg-green-500 text-white border-2 border-green-500 scale-105 shadow-lg";
                                } else if (isSelected && !isCorrectOpt) {
                                    buttonClass = "bg-red-100 text-red-600 border-2 border-red-300";
                                } else {
                                    buttonClass = "bg-gray-100 text-gray-400 border-2 border-gray-200";
                                }
                            } else if (isSelected) {
                                buttonClass = "bg-blue-100 text-blue-700 border-2 border-blue-400";
                            }

                            return (
                                <button
                                    key={idx}
                                    className={`
                                        px-4 py-3 rounded-2xl font-medium text-sm transition-all
                                        ${buttonClass}
                                        ${!showResult ? 'active:scale-[0.98] cursor-pointer' : ''}
                                    `}
                                    onClick={() => !showResult && onSelectOption(idx)}
                                    disabled={showResult}
                                >
                                    {opt}
                                </button>
                            );
                        })}
                    </div>

                    {/* 피드백 메시지 */}
                    {state.isAnswered && (
                        <div className="mt-6 text-center animate-fadeIn">
                            {state.isCorrect ? (
                                <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
                                    <CheckCircle size={24} />
                                    <span className="font-bold text-lg">정답입니다!</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2 text-red-600 mb-4">
                                    <XCircle size={24} />
                                    <span className="font-bold text-lg">틀렸어요</span>
                                </div>
                            )}

                            {/* 다음 버튼 */}
                            <button
                                className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 
                                         text-white font-bold shadow-lg active:scale-[0.98] transition-all
                                         hover:from-blue-600 hover:to-blue-700"
                                onClick={onNext}
                            >
                                {currentNo === total ? "결과 보기" : "다음 문제"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// 애니메이션 스타일 (tailwind.config.js에 추가 필요)
// @keyframes fadeIn {
//   from { opacity: 0; }
//   to { opacity: 1; }
// }
// @keyframes slideUp {
//   from { transform: translateY(20px); opacity: 0; }
//   to { transform: translateY(0); opacity: 1; }
// }
