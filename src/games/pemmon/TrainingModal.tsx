// src/games/pemmon/TrainingModal.tsx

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

    if (state.phase === "result") {
        return (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
                <div className="w-full max-w-sm bg-white rounded-2xl p-4 shadow-lg">
                    <div className="text-lg font-bold mb-2 text-center">
                        훈련 결과
                    </div>
                    <div className="text-sm text-gray-700 mb-1 text-center">
                        정답 {state.correct} / {state.total} 문제
                    </div>
                    <div className="text-sm text-gray-700 mb-4 text-center">
                        경험치 +{state.expGain} · 코인 +{state.coinGain}
                    </div>
                    <button
                        className="w-full py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold"
                        onClick={onClose}
                    >
                        닫기
                    </button>
                </div>
            </div>
        );
    }

    const q = state.questions[state.index];
    const total = state.questions.length;
    const currentNo = state.index + 1;

    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-sm bg-white rounded-2xl p-4 shadow-lg flex flex-col gap-3">
                <div className="text-xs text-gray-400">
                    훈련 문제 {currentNo} / {total}
                </div>
                <div className="text-base font-bold text-gray-900 whitespace-pre-wrap">
                    {q.text}
                </div>
                <div className="mt-2 flex flex-col gap-2">
                    {q.options?.map((opt, idx) => {
                        const isSelected = state.selectedIndex === idx;
                        const isCorrectOpt = q.answer_index === idx;
                        let bg = "bg-gray-100";
                        let border = "border-transparent";
                        if (state.isAnswered) {
                            if (isCorrectOpt) {
                                bg = "bg-green-100";
                                border = "border-green-500";
                            } else if (isSelected && !isCorrectOpt) {
                                bg = "bg-red-100";
                                border = "border-red-500";
                            }
                        } else if (isSelected) {
                            bg = "bg-blue-100";
                            border = "border-blue-400";
                        }

                        return (
                            <button
                                key={idx}
                                className={`w-full text-left px-3 py-2 rounded-xl border ${bg} ${border} text-sm`}
                                onClick={() => onSelectOption(idx)}
                            >
                                {opt}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                        {state.isAnswered
                            ? state.isCorrect
                                ? "정답이에요! 🎉"
                                : "아쉬워요. 다시 도전해볼까요?"
                            : "정답이라고 생각하는 답을 눌러보세요."}
                    </div>
                    {state.isAnswered && (
                        <button
                            className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                            onClick={onNext}
                        >
                            {currentNo === total ? "결과 보기" : "다음 문제"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
