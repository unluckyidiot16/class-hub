// src/games/pemmon/LobbyView.tsx
import { useState, type ReactNode } from "react";
import {
    BookOpen,
    Map,
    Sword,
    ShoppingBag,
    Users,
    Settings,
    Send,
} from "lucide-react";
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

/* ───────────────────────
   메뉴 카드 컴포넌트 (PEMV2 스타일)
─────────────────────── */
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
            className={`${colorClass} text-white p-5 rounded-[1.5rem] shadow-lg shadow-gray-200 active:scale-95 transition-all group overflow-hidden relative flex flex-col justify-between h-32`}
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
                <div className="font-bold text-lg leading-tight">{title}</div>
                <div className="text-xs opacity-80 font-medium mt-1">
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
            <div className="w-full max-w-sm rounded-[2rem] bg-[#f6f8fb] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* 헤더 */}
                <div className="flex items-center gap-2 px-6 py-5 bg-white shadow-sm">
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                    >
                        ←
                    </button>
                    <h1 className="text-xl font-bold text-slate-800">
                        훈련장
                    </h1>
                </div>

                {/* 컨텐츠 */}
                <div className="px-6 pt-6 pb-8 space-y-4">
                    {/* 국어 */}
                    <button
                        type="button"
                        onClick={onStartKorean}
                        className="w-full bg-white rounded-3xl border-2 border-pink-100 hover:border-pink-300 px-6 py-5 text-left shadow-sm active:scale-[0.98] transition flex items-center justify-between group relative overflow-hidden"
                    >
                        <div className="relative z-10">
                            <div className="text-lg font-bold text-slate-900">
                                국어 훈련
                            </div>
                            <div className="text-sm text-slate-500 mt-1">
                                맞춤법을 배워요
                            </div>
                        </div>
                        <div className="w-16 h-16 rounded-full bg-pink-50 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                            가
                        </div>
                    </button>

                    {/* 수학 */}
                    <button
                        type="button"
                        onClick={onStartMath}
                        className="w-full bg-white rounded-3xl border-2 border-blue-100 hover:border-blue-300 px-6 py-5 text-left shadow-sm active:scale-[0.98] transition flex items-center justify-between group relative overflow-hidden"
                    >
                        <div className="relative z-10">
                            <div className="text-lg font-bold text-slate-900">
                                수학 훈련
                            </div>
                            <div className="text-sm text-slate-500 mt-1">
                                계산 연습을 해요
                            </div>
                        </div>
                        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                            7×
                        </div>
                    </button>
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
                                 // pack,
                             }: TrainingQuizOverlayProps) {
    if (training.phase !== "quiz") return null;

    const current = training.questions[training.index];
    const progress = `${training.index + 1} / ${training.questions.length}`;

return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 h-full">
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                    <span className="text-gray-400 font-bold text-sm">
                        문제 {progress}
                    </span>
                <button
                    onClick={onClose}
                    className="bg-gray-200 text-gray-500 px-3 py-1 rounded-full text-xs font-bold"
                >
                    그만하기
                </button>
            </div>
            <div className="bg-white p-8 rounded-[2rem] shadow-sm min-h-[160px] flex items-center justify-center text-center border-2 border-slate-100">
                <h2 className="text-2xl font-bold text-gray-800 leading-snug break-keep whitespace-pre-wrap">
                    {current.text}
                </h2>
            </div>
        </div>

        <div className="flex-1 px-6 pb-6 overflow-y-auto">
            <div className="grid grid-cols-1 gap-3">
                {(current.options ?? []).map((opt, idx) => {
                    const isSelected = training.selectedIndex === idx;
                    const isCorrect =
                        training.isAnswered &&
                        current.answer_index === idx;
                    const isWrong =
                        training.isAnswered &&
                        isSelected &&
                        !isCorrect;

                    let styleClass = "bg-white text-gray-700 border-2 border-slate-100 hover:border-blue-200";
                    if (isCorrect) {
                        styleClass = "bg-green-500 text-white border-green-500 ring-4 ring-green-200 scale-[1.02]";
                    } else if (isWrong) {
                        styleClass = "bg-rose-500 text-white border-rose-500 ring-4 ring-rose-200";
                    } else if (isSelected) {
                        styleClass = "bg-blue-500 text-white border-blue-500";
                    } else if (training.isAnswered) {
                        styleClass = "bg-gray-100 text-gray-400 border-transparent opacity-60";
                    }

                    return (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => onSelectOption(idx)}
                            className={`w-full text-center px-4 py-5 rounded-2xl text-lg font-bold shadow-sm active:scale-[0.98] transition-all ${styleClass}`}
                            disabled={training.isAnswered}
                        >
                            {opt}
                        </button>
                    );
                })}
            </div>
        </div>

        {/* 하단 다음 버튼 (정답 확인 후 표시) */}
        {training.isAnswered && (
            <div className="p-6 bg-white border-t border-gray-100 pb-8">
                <button
                    type="button"
                    onClick={onNextQuestion}
                    className="w-full py-4 rounded-2xl bg-blue-600 text-white text-lg font-bold shadow-xl active:scale-[0.98] transition"
                >
                    {training.index + 1 === training.questions.length
                        ? "결과 보기"
                        : "다음 문제"}
                </button>
            </div>
        )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white p-6">
            <div className="w-full max-w-sm text-center flex flex-col items-center">
                <div className="text-6xl mb-6 animate-bounce">🏆</div>
                <h2 className="text-3xl font-bold mb-2 text-gray-800">
                    훈련 완료!
                </h2>
                <div className="text-gray-500 mb-8">
                    총 <span className="text-blue-600 font-bold text-2xl mx-1">{training.correct}</span> 문제를 맞혔어요
                </div>

                <div className="bg-gradient-to-r from-green-400 to-green-600 p-1 rounded-3xl w-full shadow-lg mb-8">
                    <div className="bg-white rounded-[1.3rem] p-6">
                        <div className="flex justify-around items-center">
                            <div>
                                <p className="text-gray-400 font-bold text-xs mb-1 uppercase">Exp</p>
                                <p className="text-3xl font-bold text-slate-800">+{training.expGain}</p>
                            </div>
                            <div className="w-px h-10 bg-gray-200"></div>
                            <div>
                                <p className="text-gray-400 font-bold text-xs mb-1 uppercase">Coin</p>
                                <p className="text-3xl font-bold text-yellow-500">+{training.coinGain}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-4 rounded-2xl bg-blue-600 text-white text-lg font-bold shadow-xl hover:bg-blue-700 active:scale-95 transition-all"
                >
                    확인
                </button>
            </div>
        </div>
    );
}

/* ───────────────────────
   메인 로비 뷰 (PEMV2 스타일)
─────────────────────── */

export function LobbyView({
                              // trainerName,
                              partner,
                              coins,
                              pack,
                              // questionsCount,
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

    // 퀴즈팩 이름이 너무 길면 자르기 위한 로직 (옵션)
    const packLabel = pack ? pack.title : "퀴즈팩 없음";

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 pb-20 relative">
            {/* 상단 파트너 카드 (PEMV2 메인 카드) */}
            <div className="bg-blue-600 p-6 pt-10 rounded-b-[2.5rem] shadow-xl relative overflow-hidden text-white z-10">
                {/* 장식용 원형 빛 (V2 스타일) */}
                <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/10 rounded-full blur-2xl" />

                <div className="flex items-center gap-5 relative z-10">
                    {/* 파트너 아이콘 Container */}
                    <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center shadow-inner border-2 border-white/30 backdrop-blur-sm shrink-0">
                        {/* PokemonSprite를 V2 느낌으로 렌더링. height 기반 스케일링을 모방하기 위해 약간 크게 렌더링 */}
                        <PokemonSprite species={partner.species} size={80} variant="avatar" />
                    </div>

                    {/* 정보 영역 */}
                    <div className="flex-1 min-w-0">
                        <div className="text-blue-100 text-sm font-bold mb-0.5">
                            LV.{partner.level} 파트너
                        </div>
                        <div className="text-3xl font-bold tracking-tight truncate leading-tight">
                            {partner.species.name}
                        </div>

                        {/* 경험치 바 (V2 스타일: glow 효과) */}
                        <div className="mt-3 h-3 bg-blue-900/40 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
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

            {/* 내 지갑 (PEMV2 Floating Card) */}
            <div className="mx-6 -mt-6 bg-white p-4 rounded-2xl shadow-lg flex justify-between items-center relative z-20">
                <div className="flex flex-col">
                    <span className="text-gray-400 font-bold text-xs ml-1 mb-0.5">내 지갑</span>
                    <span className="text-slate-500 text-[10px] ml-1 truncate max-w-[120px]">
                        {packLabel}
                    </span>
                </div>
                <span className="text-2xl font-bold text-yellow-500 mr-1 flex items-center gap-1">
                    <span className="text-lg">🪙</span>
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
                {/* 기존 기능 유지를 위해 PVP 추가 (디자인은 V2 스타일 적용) */}
                <MenuCard
                    title="대전 (PVP)"
                    desc="친구와 대결"
                    icon={<Users size={28} />}
                    colorClass="bg-indigo-500"
                    onClick={onGoPvp}
                />
            </div>

            {/* 하단 네비게이션 (PEMV2 스타일) */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-2 flex justify-around pb-6 pt-3 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-30">
                <button
                    onClick={onGoDex}
                    className="flex flex-col items-center text-gray-400 hover:text-blue-600 transition-colors w-16"
                >
                    <Settings size={24} />
                    <span className="text-[10px] font-bold mt-1">도감/설정</span>
                </button>
                <button
                    onClick={onUploadSubmission}
                    className="flex flex-col items-center text-blue-600 w-16"
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
                        onStartTraining(); // App 레벨에서 현재 subject 처리 필요할 수 있음
                    }}
                    onStartMath={() => {
                        setShowTrainingMenu(false);
                        onStartTraining();
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