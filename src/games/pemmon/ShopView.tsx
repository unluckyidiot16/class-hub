// src/games/pemmon/ShopView.tsx

import { ChevronLeft } from "lucide-react";

export type ShopItem = {
    id: string;
    name: string;
    desc: string;
    price: number;
    badge?: string; // "10원" 같은 표시용
    emoji?: string;
};

type ShopViewProps = {
    onBack: () => void;
    coins: number;
    items: ShopItem[];
    onBuy: (itemId: string) => void;
};

export function ShopView({
                             onBack,
                             coins,
                             items,
                             onBuy,
                         }: ShopViewProps) {
    return (
        <div className="w-full h-full flex flex-col bg-[#f6ecff]">
            {/* 헤더 */}
            <div className="flex items-center gap-2 px-4 py-4 bg-[#f6ecff]">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-1 rounded-full hover:bg-purple-100"
                >
                    <ChevronLeft size={20} />
                </button>
                <h1 className="text-lg font-bold text-slate-800">
                    포켓상점
                </h1>
            </div>

            {/* 내 지갑 */}
            <div className="px-4 mt-1">
                <div className="bg-white rounded-3xl px-4 py-3 shadow-sm flex justify-between items-center">
                    <div className="text-xs text-slate-500 font-bold">
                        내 지갑
                    </div>
                    <div className="flex items-center gap-1 text-xl font-bold text-yellow-500">
                        <span className="text-sm">🪙</span>
                        {coins}
                    </div>
                </div>
            </div>

            {/* 아이템 리스트 */}
            <div className="flex-1 px-4 pt-4 pb-6 overflow-auto">
                <div className="space-y-3">
                    {items.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onBuy(item.id)}
                            className="w-full bg-white rounded-3xl px-4 py-3 shadow-sm flex items-center justify-between active:scale-[0.99] transition"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-xl">
                                    {item.emoji ?? "⭕️"}
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-bold text-slate-900">
                                        {item.name}
                                    </div>
                                    <div className="text-xs text-purple-500 mt-1">
                                        {item.desc}
                                    </div>
                                </div>
                            </div>
                            <div className="px-3 py-1 rounded-full bg-purple-50 text-[11px] text-purple-600 font-bold">
                                {item.badge ?? `${item.price}원`}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
