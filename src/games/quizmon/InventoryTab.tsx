// src/games/quizmon/InventoryTab.tsx
import type { QuizmonProfileRow } from "./types";

type InventoryTabProps = {
    profile: QuizmonProfileRow | null;
    xpDustCount: number;
    rareCandyCount: number;
    onBuyExpDust: (quantity?: number) => Promise<void>;
    pokeBallCount?: number;
    greatBallCount?: number;
    ultraBallCount?: number;
};

export function InventoryTab(props: InventoryTabProps) {
    const {
        profile,
        xpDustCount,
        rareCandyCount,
        onBuyExpDust,
        pokeBallCount = 0,
        greatBallCount = 0,
        ultraBallCount = 0,
    } = props;

    const gold = profile?.gold ?? 0;
    const gems = profile?.gems ?? 0;
    const shards = profile?.star_shards ?? 0;

    return (
        <div className="flex flex-col gap-4 text-slate-100">
            <div className="rounded-2xl bg-slate-900/70 border border-slate-700 px-5 py-4 flex items-center justify-between">
                <div className="space-y-1">
                    <div className="text-sm text-slate-300">보유 재화</div>
                    <div className="flex gap-4 text-sm font-medium">
                        <span>Gold: {gold}</span>
                        <span>Gems: {gems}</span>
                        <span>Shards: {shards}</span>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl bg-slate-900/70 border border-slate-700 px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-semibold text-slate-100">
                            강화 아이템 (Exp Dust / 레어 캔디)
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                            Xp Dust와 레어 캔디를 사용해 포켓몬의 레벨을 올릴 수 있습니다.
                        </div>
                    </div>
                    <div className="text-xs text-slate-300">
                        Xp Dust x {xpDustCount} · 레어 캔디 x {rareCandyCount}
                    </div>
                </div>

                <div className="rounded-xl bg-slate-800/80 px-4 py-3 flex items-center justify-between">
                    <div className="text-xs text-slate-300">
                        Xp Dust 1개를 Gold 10개로 구매합니다. (MVP용 단일 상품)
                    </div>
                    <button
                        className="px-3 py-1.5 rounded-full bg-amber-400 text-slate-900 text-xs font-semibold hover:bg-amber-300 disabled:opacity-60"
                        onClick={() => onBuyExpDust(1)}
                        disabled={gold < 10}
                    >
                        Exp Dust 1개 구매
                    </button>
                </div>
            </div>
            {/* 🔹 포획 아이템 (포켓볼) 섹션 */}
                        <div className="rounded-2xl bg-slate-900/70 border border-slate-700 px-5 py-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-slate-100">
                                        포획 아이템 (포켓볼)
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        포켓볼을 사용해 조우한 포켓몬을 포획할 수 있습니다.
                                    </div>
                                </div>
                                <div className="text-xs text-slate-300 text-right space-y-0.5">
                                    <div>포켓볼 x {pokeBallCount}</div>
                                    <div>슈퍼볼 x {greatBallCount}</div>
                                    <div>하이퍼볼 x {ultraBallCount}</div>
                                </div>
                            </div>
                        </div>
        </div>
    );
}
