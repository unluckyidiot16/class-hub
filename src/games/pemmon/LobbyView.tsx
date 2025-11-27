// src/games/pemmon/LobbyView.tsx

import type {
    PartnerState,
    QuizPackRow,
    TrainingState,
} from "./pemmonTypes";
import { TrainingModal } from "./TrainingModal";
import { MenuCard } from "./MenuCard";

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
    return (
        <div className="relative flex flex-col h-full bg-gray-50">
            <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
                <div>
                    <div className="text-xs opacity-80">트레이너</div>
                    <div className="text-lg font-bold">
                        {trainerName || "이름 없음"}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xs opacity-80">코인</div>
                    <div className="text-lg font-bold">🪙 {coins}</div>
                </div>
            </div>

            <div className="p-4 bg-white border-b">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs text-gray-400">파트너</div>
                        <div className="font-bold text-gray-800">
                            {partner.species.name} (Lv.{partner.level})
                        </div>
                        <div className="text-xs text-gray-500">
                            HP {partner.maxHp} / ATK {partner.species.atk} / DEF{" "}
                            {partner.species.def}
                        </div>
                        {pack && (
                            <div className="mt-1 text-[11px] text-gray-400">
                                퀴즈팩: {pack.title}{" "}
                                {questionsCount > 0
                                    ? `(${questionsCount}문제)`
                                    : "(문제 로딩 중 또는 0문제)"}
                            </div>
                        )}
                    </div>
                    <button
                        className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs flex items-center gap-1"
                        onClick={onUploadSubmission}
                    >
                        <span>⬆️</span>
                        출전 데이터 업로드
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-3 p-4">
                <MenuCard
                    icon="📖"
                    title="훈련"
                    desc="퀴즈로 경험치"
                    onClick={onStartTraining}
                />
                <MenuCard
                    icon="🗺️"
                    title="탐험"
                    desc="포켓몬 발견"
                    onClick={onStartExplore}
                />
                <MenuCard
                    icon="⚔️"
                    title="도전"
                    desc="PVE 배틀"
                    onClick={onStartChallenge}
                />
                <MenuCard
                    icon="🛒"
                    title="상점"
                    desc="아이템 구매"
                    onClick={() => {
                        alert("상점은 이후 업데이트 예정!");
                    }}
                />
                <MenuCard
                    icon="👥"
                    title="대전 (PVP)"
                    desc="친구와 대결"
                    onClick={onGoPvp}
                />
                <MenuCard
                    icon="📚"
                    title="도감"
                    desc="포켓몬 목록"
                    onClick={onGoDex}
                />
            </div>

            {training.phase !== "idle" && (
                <TrainingModal
                    state={training}
                    onSelectOption={onSelectOption}
                    onNext={onNextQuestion}
                    onClose={onCloseTraining}
                />
            )}
        </div>
    );
}
