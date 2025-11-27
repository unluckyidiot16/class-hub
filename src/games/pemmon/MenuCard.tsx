// src/games/pemmon/MenuCard.tsx
import type { ReactNode } from "react";

type MenuCardProps = {
    icon: ReactNode;
    title: string;
    desc: string;
    onClick: () => void;
};

export function MenuCard({ icon, title, desc, onClick }: MenuCardProps) {
    return (
        <button
            className="bg-white rounded-2xl shadow p-3 flex flex-col justify-between hover:bg-gray-50 active:scale-95 transition"
            onClick={onClick}
        >
            <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center mb-2 text-lg">
                {icon}
            </div>
            <div>
                <div className="text-sm font-bold">{title}</div>
                <div className="text-[11px] text-gray-500">{desc}</div>
            </div>
        </button>
    );
}
