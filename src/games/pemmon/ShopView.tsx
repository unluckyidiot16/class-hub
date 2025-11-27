// src/games/pemmon/ShopView.tsx

import { ChevronLeft } from "lucide-react";

export type ShopItem = {
    id: string;
    name: string;
    desc: string;
    price: number;
    badge?: string;
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
        <div className="w-full h-full flex flex-col bg-gradient-to-b from-purple-50 to-white">
            {/* 헤더 - PEMV2 스타일 */}
            <div className="flex items-center gap-2 px-4 py-4 bg-white shadow-sm border-b border-purple-100">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-2 rounded-xl hover:bg-purple-50 transition-colors"
                >
                    <ChevronLeft size={20} className="text-gray-600" />
                </button>
                <h1 className="text-xl font-bold text-gray-800">
                    포켓샵
                </h1>
            </div>

            {/* 내 지갑 - PEMV2 스타일 카드 */}
            <div className="px-4 mt-4">
                <div className="bg-white rounded-2xl px-5 py-4 shadow-lg border border-purple-100 flex justify-between items-center">
                    <div className="text-sm font-bold text-gray-500">
                        내 지갑
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">🪙</span>
                        <span className="text-2xl font-bold text-yellow-500">
                            {coins}
                        </span>
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
                            className="w-full bg-white rounded-2xl px-5 py-4 shadow-md border border-gray-100
                                     flex items-center justify-between active:scale-[0.98] transition-all
                                     hover:shadow-lg hover:border-purple-200 group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 
                                              flex items-center justify-center text-2xl shadow-sm
                                              group-hover:from-purple-200 group-hover:to-purple-100 transition-colors">
                                    {item.emoji || "📦"}
                                </div>
                                <div className="text-left">
                                    <div className="text-base font-bold text-gray-800">
                                        {item.name}
                                    </div>
                                    <div className="text-xs text-purple-600 mt-1 font-medium">
                                        {item.desc}
                                    </div>
                                </div>
                            </div>
                            <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 
                                          text-white text-sm font-bold shadow-md
                                          group-hover:from-purple-600 group-hover:to-purple-700 transition-all">
                                {item.badge || `${item.price}원`}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
