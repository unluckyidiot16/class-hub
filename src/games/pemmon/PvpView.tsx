// src/games/pemmon/PvpView.tsx

import type { PartnerState, SubmissionRow } from "./pemmonTypes";

type PvpViewProps = {
    classId: string | null;
    coins: number;
    partner: PartnerState;
    opponents: SubmissionRow[];
    loadingOpponents: boolean;
    pvpEnemy: SubmissionRow | null;
    pvpLog: string[];
    pvpResult: "idle" | "fighting" | "win" | "lose";
    onBackToLobby: () => void;
    onRefreshOpponents: () => void;
    onStartBattle: (enemy: SubmissionRow) => void;
};

export function PvpView({
                            classId,
                            coins,
                            partner,
                            opponents,
                            loadingOpponents,
                            pvpEnemy,
                            pvpLog,
                            pvpResult,
                            onBackToLobby,
                            onRefreshOpponents,
                            onStartBattle,
                        }: PvpViewProps) {
    return (
        <div className="flex flex-col h-full bg-slate-900 text-white">
            <div className="p-3 flex items-center justify-between border-b border-slate-700">
                <button
                    className="px-3 py-1 bg-slate-700 rounded-full text-xs"
                    onClick={onBackToLobby}
                >
                    ← 돌아가기
                </button>
                <div className="text-xs text-slate-300">
                    {classId ? `CLASS: ${classId.slice(0, 4)}...` : "CLASS: -"}
                </div>
            </div>

            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <div>
                    <div className="text-xs text-slate-400">내 포켓몬</div>
                    <div className="font-bold">
                        {partner.species.name} (Lv.{partner.level})
                    </div>
                </div>
                <div className="text-right text-xs text-slate-400">
                    🪙 {coins} 코인
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row">
                <div className="flex-1 p-4 border-r border-slate-800 overflow-auto">
                    <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-sm">출전한 친구들</div>
                        <button
                            className="text-xs px-2 py-1 bg-slate-700 rounded-full"
                            onClick={onRefreshOpponents}
                            disabled={loadingOpponents}
                        >
                            새로고침
                        </button>
                    </div>
                    {loadingOpponents && (
                        <div className="text-xs text-slate-400">
                            불러오는 중...
                        </div>
                    )}
                    {opponents.length === 0 && !loadingOpponents && (
                        <div className="text-xs text-slate-500">
                            아직 출전한 친구가 없어요. (친구들에게 업로드
                            버튼을 눌러달라고 해보세요!)
                        </div>
                    )}
                    <div className="mt-2 space-y-2">
                        {opponents.map((o) => (
                            <button
                                key={o.id}
                                className={`w-full text-left p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs ${
                                    pvpEnemy?.id === o.id
                                        ? "ring-2 ring-yellow-400"
                                        : ""
                                }`}
                                onClick={() => onStartBattle(o)}
                            >
                                <div className="font-bold text-sm">
                                    {o.trainer_name} 님의 포켓몬
                                </div>
                                <div className="text-slate-300">
                                    종:{o.partner_species} / Lv.
                                    {o.partner_level}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    HP {o.partner_stats.maxHp} · ATK{" "}
                                    {o.partner_stats.atk} · DEF{" "}
                                    {o.partner_stats.def}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-1">
                                    업데이트:{" "}
                                    {new Date(
                                        o.updated_at,
                                    ).toLocaleTimeString()}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 p-4 flex flex-col">
                    <div className="font-bold text-sm mb-2">배틀 로그</div>
                    <div className="flex-1 bg-black/40 rounded-xl p-3 text-xs overflow-auto border border-slate-700">
                        {pvpLog.length === 0 && (
                            <div className="text-slate-500">
                                왼쪽에서 대전할 친구를 선택하세요.
                            </div>
                        )}
                        {pvpLog.map((l, idx) => (
                            <div key={idx} className="mb-1">
                                {l}
                            </div>
                        ))}
                    </div>

                    {pvpResult !== "idle" && (
                        <div className="mt-3 text-center">
                            {pvpResult === "win" ? (
                                <div className="text-yellow-300 font-bold">
                                    승리! 경험치 +20 / 코인 +10
                                </div>
                            ) : (
                                <div className="text-red-300 font-bold">
                                    패배... 경험치 +5
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
