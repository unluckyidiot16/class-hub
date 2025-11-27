// src/games/pemmon/LobbyView.tsx
import { useState, type ReactNode } from "react";
import { BookOpen, Map, Sword, ShoppingBag, Users, Settings, Send } from "lucide-react";
import type {
    PartnerState,
    QuizPackRow,
    TrainingState,
} from "./pemmonTypes";
import { PokemonSprite } from "./PokemonSprite";

type LobbyViewProps = {
    trainerName: string;
    partner: PartnerState;
    coins: number;
    pack: QuizPackRow | null;
    questionsCount: number;
    training: TrainingState;
    onUploadSubmission: () => void;
    onStartTraining: () => void;
    onSelectOption: (index: number) => void;
    onNextQuestion: () => void;
    onCloseTraining: () => void;
    onStartExplore: () => void;
    onStartChallenge: () => void;
    onGoPvp: () => void;
    onGoDex: () => void;
};

type MenuCardProps = {
    icon: ReactNode;
    title: string;
    desc: string;
    colorClass: string;
    onClick: () => void;
};

function MenuCard({
                      icon,
                      title,
                      desc,
                      colorClass,
                      onClick,
                  }: MenuCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`${colorClass} text-white p-5 rounded-[1.5rem] shadow-lg active:scale-95 transition-all group overflow-hidden relative flex flex-col gap-3`}
        >
            {/* 뒤쪽 큰 아이콘 실루엣 */}
            <div className="absolute right-[-20px] bottom-[-20px] opacity-20 scale-150 group-hover:scale-125 transition-transform">
                {icon}
            </div>

            {/* 앞쪽 작은 아이콘 */}
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm w-min relative z-10">
                {icon}
            </div>

            <div className="relative z-10 text-left">
                <div className="font-bold text-lg">{title}</div>
                <div className="text-xs opacity-80 font-medium">
                    {desc}
                </div>
            </div>
        </button>
    );
}

/* ───────────────────────
   훈련장: 과목 선택 오버레이
─────────────────────── */
type TrainingMenuOverlayProps = {
    onClose: () => void;
    onStartKorean: () => void;
    onStartMath: () => void;
};

function TrainingMenuOverlay({
                                 onClose,
                                 onStartKorean,
                                 onStartMath,
                             }: TrainingMenuOverlayProps) {
    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md mx-4 rounded-3xl bg-[#f6f8fb] shadow-2xl overflow-hidden">
                {/* 헤더 */}
                <div className="flex items-center gap-2 px-4 py-4 bg-white shadow-sm">
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-slate-100"
                    >
                        ←
                    </button>
                    <h1 className="text-lg font-bold text-slate-800">
                        훈련장
                    </h1>
                </div>

                {/* 컨텐츠 */}
                <div className="px-4 pt-4 pb-6">
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
        </div>
    );
}

/* ───────────────────────
   퀴즈 오버레이
─────────────────────── */
type TrainingQuizOverlayProps = {
    training: TrainingState;
    onSelectOption: (idx: number) => void;
    onNextQuestion: () => void;
    onClose: () => void;
    pack: QuizPackRow | null;
};

function TrainingQuizOverlay({
                                 training,
                                 onSelectOption,
                                 onNextQuestion,
                                 onClose,
                                 pack,
                             }: TrainingQuizOverlayProps) {
    if (training.phase !== "quiz") return null;

    const current = training.questions[training.index];
    const progress = `${training.index + 1} / ${training.questions.length}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden">
                {/* 헤더 */}
                <div className="px-4 py-3 border-b flex items-center justify-between bg-slate-50">
                    <div className="text-xs font-semibold text-slate-500">
                        {pack ? pack.title : "연결된 퀴즈팩 없음"}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-xs text-slate-400 hover:text-slate-600"
                    >
                        닫기
                    </button>
                </div>

                {/* 본문 */}
                <div className="px-5 pt-4 pb-5">
                    <div className="flex justify-between items-center mb-2 text-xs text-slate-500">
                        <span>훈련 문제</span>
                        <span>{progress}</span>
                    </div>
                    <div className="mb-4">
                        <div className="text-sm font-bold text-slate-900 whitespace-pre-wrap">
                            {current.text}
                        </div>
                    </div>

                    {/* 보기 */}
                    <div className="space-y-2 mb-4">
                        {(current.options ?? []).map((opt, idx) => {
                            const isSelected = training.selectedIndex === idx;
                            const isCorrect =
                                training.isAnswered &&
                                current.answer_index === idx;
                            const isWrong =
                                training.isAnswered &&
                                isSelected &&
                                !isCorrect;

                            let border = "border-slate-200";
                            let bg = "bg-slate-50";
                            if (isCorrect) {
                                border = "border-emerald-400";
                                bg = "bg-emerald-50";
                            } else if (isWrong) {
                                border = "border-rose-400";
                                bg = "bg-rose-50";
                            } else if (isSelected) {
                                border = "border-blue-400";
                                bg = "bg-blue-50";
                            }

                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => onSelectOption(idx)}
                                    className={`w-full text-left px-3 py-2 rounded-2xl border ${border} ${bg} text-sm active:scale-[0.99] transition`}
                                    disabled={training.isAnswered}
                                >
                                    {opt}
                                </button>
                            );
                        })}
                    </div>

                    {/* 하단 버튼 */}
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={onNextQuestion}
                            className="px-4 py-2 rounded-2xl bg-blue-500 text-white text-sm font-bold disabled:bg-slate-300 disabled:text-slate-100 active:scale-[0.98] transition"
                            disabled={!training.isAnswered}
                        >
                            {training.index + 1 === training.questions.length
                                ? "결과 보기"
                                : "다음 문제"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ───────────────────────
   결과 오버레이
─────────────────────── */
type TrainingResultOverlayProps = {
    training: TrainingState;
    onClose: () => void;
};

function TrainingResultOverlay({
                                   training,
                                   onClose,
                               }: TrainingResultOverlayProps) {
    if (training.phase !== "result") return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-xs mx-4 bg-white rounded-3xl shadow-2xl px-5 py-6 text-center">
                <div className="text-lg font-extrabold text-slate-900 mb-1">
                    훈련 완료!
                </div>
                <div className="text-xs text-slate-500 mb-4">
                    수고했어요. 결과를 확인해 볼까요?
                </div>
                <div className="bg-slate-50 rounded-2xl px-4 py-3 mb-4 text-sm text-slate-700 space-y-1">
                    <div>
                        정답:{" "}
                        <span className="font-bold">
                            {training.correct}/{training.total}
                        </span>
                    </div>
                    <div>
                        경험치:{" "}
                        <span className="font-bold">+{training.expGain}</span>
                    </div>
                    <div>
                        코인:{" "}
                        <span className="font-bold">+{training.coinGain}</span>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3 rounded-2xl bg-blue-500 text-white text-sm font-bold active:scale-[0.98] transition"
                >
                    돌아가기
                </button>
            </div>
        </div>
    );
}

/* ───────────────────────
   메인 로비 뷰 (PEMV2 스타일)
─────────────────────── */

export function LobbyView({
                              trainerName,
                              partner,
                              coins,
                              pack,
                              questionsCount,
                              training,
                              onUploadSubmission,
                              onStartTraining,
                              onSelectOption,
                              onNextQuestion,
                              onCloseTraining,
                              onStartExplore,
                              onStartChallenge,
                              onGoPvp,
                              onGoDex,
                          }: LobbyViewProps) {
    const xpRatio = Math.max(0, Math.min(1, partner.exp / 100 || 0));
    const [showTrainingMenu, setShowTrainingMenu] = useState(false);

    const quizPackLabel = pack
        ? `${pack.title} · ${questionsCount}문제`
        : "연결된 퀴즈팩 없음";

    return (
        <div className="flex flex-col h-full bg-gray-50 pb-20 relative">
            {/* 상단 파트너 카드 (PEMV2 메인 카드와 동일한 스타일) */}
            <div className="bg-blue-600 p-6 pt-8 rounded-b-[2.5rem] shadow-xl relative overflow-hidden text-white">
                {/* 장식용 원형 빛 */}
                <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/10 rounded-full blur-2xl" />

                <div className="flex items-center gap-4 relative z-10">
                    {/* 파트너 아이콘 */}
                    <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center shadow-inner border-2 border-white/30">
                        <PokemonSprite species={partner.species} size={80} variant="avatar" />
                    </div>

                    {/* 정보 영역 */}
                    <div className="flex-1">
                        <div className="text-xs text-blue-100/90 font-semibold mb-1">
                            트레이너 {trainerName || "이름 없음"}
                        </div>
                        <div className="text-blue-100 text-sm font-bold">
                            LV.{partner.level} 파트너
                        </div>
                        <div className="text-2xl font-bold tracking-tight">
                            {partner.species.name}
                        </div>

                        {/* 경험치 바 */}
                        <div className="mt-2 h-3 bg-blue-900/40 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
                            <div
                                className="bg-yellow-400 h-full transition-all duration-500 shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                                style={{ width: `${xpRatio * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[11px] mt-1 text-blue-100/80 font-mono">
                            <span>HP {partner.maxHp}</span>
                            <span>XP {partner.exp}/100</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 내 지갑 + 퀴즈팩 정보 (PEMV2 '내 지갑' 카드 + 퀴즈팩 라벨만 추가) */}
            <div className="mx-6 -mt-4 bg-white p-3 rounded-2xl shadow-lg flex justify-between items-center relative z-20">
                <div className="flex flex-col gap-[2px] ml-2">
                    <span className="text-gray-500 font-bold text-sm">내 지갑</span>
                    <span className="text-[10px] text-slate-400">{quizPackLabel}</span>
                </div>
                <span className="text-xl font-bold text-yellow-500 mr-2 flex items-center gap-1">
                    <span className="text-sm">🪙</span>
                    {coins}
                </span>
            </div>

            {/* 메뉴 그리드 */}
            <div className="p-6 grid grid-cols-2 gap-4 mt-2">
                <MenuCard
                    title="훈련하기"
                    desc="국어 · 수학 연습"
                    icon={<BookOpen size={28} />}
                    colorClass="bg-green-500"
                    onClick={() => setShowTrainingMenu(true)}
                />
                <MenuCard
                    title="탐험하기"
                    desc="포켓몬 잡기"
                    icon={<Map size={28} />}
                    colorClass="bg-orange-500"
                    onClick={onStartExplore}
                />
                <MenuCard
                    title="도전하기"
                    desc="배틀 & 코인"
                    icon={<Sword size={28} />}
                    colorClass="bg-red-500"
                    onClick={onStartChallenge}
                />
                <MenuCard
                    title="상점"
                    desc="아이템 구매"
                    icon={<ShoppingBag size={28} />}
                    colorClass="bg-purple-500"
                    onClick={() => {
                        alert("상점은 곧 업데이트될 예정이에요!");
                    }}
                />
                <MenuCard
                    title="대전 (PVP)"
                    desc="친구와 대결"
                    icon={<Users size={28} />}
                    colorClass="bg-indigo-500"
                    onClick={onGoPvp}
                />
            </div>

            {/* 하단 네비게이션 (PEMV2와 동일한 구조) */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-2 flex justify-around pb-4 pt-3 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                <button
                    onClick={onGoDex}
                    className="flex flex-col items-center text-gray-400 hover:text-blue-600 transition-colors"
                >
                    <Settings size={24} />
                    <span className="text-[10px] font-bold mt-1">도감/파트너</span>
                </button>
                <button
                    onClick={onUploadSubmission}
                    className="flex flex-col items-center text-blue-600"
                >
                    <div className="bg-blue-100 p-2 rounded-full mb-1">
                        <Send size={20} />
                    </div>
                    <span className="text-[10px] font-bold">선생님께</span>
                </button>
            </div>

            {/* 훈련 과목 선택 오버레이 */}
            {showTrainingMenu && training.phase === "idle" && (
                <TrainingMenuOverlay
                    onClose={() => setShowTrainingMenu(false)}
                    onStartKorean={() => {
                        setShowTrainingMenu(false);
                        onStartTraining(); // subject: "ko"는 상위에서 확장
                    }}
                    onStartMath={() => {
                        setShowTrainingMenu(false);
                        onStartTraining(); // subject: "math"도 동일
                    }}
                />
            )}

            {/* 퀴즈 / 결과 오버레이 */}
            {training.phase === "quiz" && (
                <TrainingQuizOverlay
                    training={training}
                    onSelectOption={onSelectOption}
                    onNextQuestion={onNextQuestion}
                    onClose={onCloseTraining}
                    pack={pack}
                />
            )}
            {training.phase === "result" && (
                <TrainingResultOverlay
                    training={training}
                    onClose={onCloseTraining}
                />
            )}
        </div>
    );
}
