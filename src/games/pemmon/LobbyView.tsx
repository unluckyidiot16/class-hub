// src/games/pemmon/LobbyView.tsx
import { useState, type ReactNode } from "react";
import { BookOpen, Map, Sword, ShoppingBag, Users, Settings, Send, Trophy, CheckCircle, XCircle } from "lucide-react";
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
            className={`${colorClass} text-white p-5 rounded-3xl shadow-lg active:scale-[0.98] 
                      transition-all group overflow-hidden relative flex flex-col gap-3
                      hover:shadow-xl`}
        >
            {/* 뒤쪽 큰 아이콘 실루엣 */}
            <div className="absolute right-[-20px] bottom-[-20px] opacity-10 scale-150 
                          group-hover:scale-125 transition-transform">
                {icon}
            </div>

            {/* 앞쪽 작은 아이콘 */}
            <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm w-min relative z-10">
                {icon}
            </div>

            <div className="relative z-10 text-left">
                <div className="font-bold text-lg">{title}</div>
                <div className="text-xs opacity-90 font-medium">
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 rounded-3xl bg-slate-50 shadow-2xl overflow-hidden animate-fadeInUp">
                {/* 헤더 */}
                <div className="flex items-center gap-2 px-4 py-4 bg-white shadow-sm border-b border-gray-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                        <span className="text-lg">←</span>
                    </button>
                    <h1 className="text-xl font-bold text-gray-800">
                        훈련장
                    </h1>
                </div>

                {/* 컨텐츠 */}
                <div className="px-6 pt-6 pb-8">
                    <div className="space-y-4">
                        {/* 국어 */}
                        <button
                            type="button"
                            onClick={onStartKorean}
                            className="group w-full bg-white rounded-3xl border-2 border-pink-100 
                                     px-5 py-5 text-left shadow-md active:scale-[0.98] transition-all 
                                     flex items-center justify-between hover:border-pink-300 hover:shadow-lg"
                        >
                            <div>
                                <div className="text-lg font-bold text-gray-800">
                                    국어 훈련
                                </div>
                                <div className="text-sm text-gray-500 mt-1">
                                    맞춤법을 배워요
                                </div>
                            </div>
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-100 to-pink-50 
                                          flex items-center justify-center text-3xl shadow-md
                                          group-hover:from-pink-200 group-hover:to-pink-100 transition-colors">
                                가
                            </div>
                        </button>

                        {/* 수학 */}
                        <button
                            type="button"
                            onClick={onStartMath}
                            className="group w-full bg-white rounded-3xl border-2 border-blue-100 
                                     px-5 py-5 text-left shadow-md active:scale-[0.98] transition-all 
                                     flex items-center justify-between hover:border-blue-300 hover:shadow-lg"
                        >
                            <div>
                                <div className="text-lg font-bold text-gray-800">
                                    수학 훈련
                                </div>
                                <div className="text-sm text-gray-500 mt-1">
                                    계산 연습을 해요
                                </div>
                            </div>
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 
                                          flex items-center justify-center text-3xl shadow-md
                                          group-hover:from-blue-200 group-hover:to-blue-100 transition-colors">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden">
                {/* 헤더 */}
                <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-gray-600">
                            {pack ? pack.title : "연결된 퀴즈팩 없음"}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                        >
                            닫기
                        </button>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        진행도: {progress}
                    </div>
                </div>

                {/* 본문 */}
                <div className="px-6 pt-6 pb-6">
                    <div className="mb-6">
                        <div className="text-lg font-bold text-gray-800 whitespace-pre-wrap text-center">
                            {current.text}
                        </div>
                    </div>

                    {/* 보기 */}
                    <div className="grid grid-cols-2 gap-3">
                        {current.options?.map((opt, idx) => {
                            const isSelected = training.selectedIndex === idx;
                            const isCorrectOption =
                                current.answer_index !== null &&
                                current.answer_index === idx;
                            const showResult = training.isAnswered;

                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() =>
                                        !showResult && onSelectOption(idx)
                                    }
                                    disabled={showResult}
                                    className={`
                                        px-4 py-3 rounded-2xl font-medium text-sm transition-all
                                        ${
                                        !showResult
                                            ? "bg-gray-50 hover:bg-blue-50 text-gray-700 border-2 border-gray-200 hover:border-blue-300 active:scale-[0.98]"
                                            : isCorrectOption
                                                ? "bg-green-500 text-white border-2 border-green-500 scale-105 shadow-lg"
                                                : isSelected
                                                    ? "bg-red-100 text-red-600 border-2 border-red-300"
                                                    : "bg-gray-100 text-gray-400 border-2 border-gray-200"
                                    }
                                    `}
                                >
                                    {opt}
                                </button>
                            );
                        })}
                    </div>

                    {/* 피드백 메시지 */}
                    {training.isAnswered && (
                        <div className="mt-4 text-center">
                            {training.isCorrect ? (
                                <div className="flex items-center justify-center gap-2 text-green-600">
                                    <CheckCircle size={20} />
                                    <span className="font-bold">
                                        정답입니다!
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2 text-red-600">
                                    <XCircle size={20} />
                                    <span className="font-bold">
                                        틀렸어요
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 다음 버튼 */}
                    {training.isAnswered && (
                        <button
                            type="button"
                            onClick={onNextQuestion}
                            className="w-full mt-4 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 
                                     text-white font-bold active:scale-[0.98] transition-all
                                     hover:from-blue-600 hover:to-blue-700 shadow-lg"
                        >
                            {training.index < training.questions.length - 1
                                ? "다음 문제"
                                : "결과 보기"}
                        </button>
                    )}
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

function TrainingResultOverlay({ training, onClose }: TrainingResultOverlayProps) {
    if (training.phase !== "result") return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-sm mx-4 bg-white rounded-3xl shadow-2xl p-6 text-center">
                <Trophy size={80} className="text-yellow-400 mx-auto mb-4 animate-bounce" />
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    훈련 완료!
                </h2>
                
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-4 mb-4">
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">정답</span>
                            <span className="font-bold text-gray-800">
                                {training.correct}/{training.total}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">경험치</span>
                            <span className="font-bold text-green-600">
                                +{training.expGain}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">코인</span>
                            <span className="font-bold text-yellow-600">
                                +{training.coinGain}
                            </span>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 
                             text-white font-bold active:scale-[0.98] transition-all
                             hover:from-blue-600 hover:to-blue-700 shadow-lg"
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
            {/* 상단 파트너 카드 (PEMV2 스타일) */}
            <div className="bg-blue-600 p-6 pt-8 rounded-b-[2.5rem] shadow-xl relative overflow-hidden text-white">
                {/* 장식용 원형 빛 */}
                <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/10 rounded-full blur-2xl" />

                <div className="flex items-center gap-4 relative z-10">
                    {/* 파트너 아이콘 */}
                    <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center 
                                  shadow-inner border-2 border-white/30 backdrop-blur-sm">
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
                        <div className="mt-2 h-3 bg-blue-900/40 rounded-full overflow-hidden backdrop-blur-sm 
                                      border border-white/10">
                            <div
                                className="bg-yellow-400 h-full transition-all duration-500 
                                         shadow-[0_0_10px_rgba(250,204,21,0.5)]"
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

            {/* 내 지갑 + 퀴즈팩 정보 */}
            <div className="mx-6 -mt-4 bg-white p-3 rounded-2xl shadow-lg flex justify-between items-center relative z-20">
                <div className="flex flex-col gap-[2px] ml-2">
                    <span className="text-gray-500 font-bold text-sm">내 지갑</span>
                    <span className="text-[10px] text-gray-400">{quizPackLabel}</span>
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

            {/* 하단 네비게이션 */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-2 
                          flex justify-around pb-4 pt-3 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
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
                        onStartTraining();
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
