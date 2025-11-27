// src/games/pemmon/MenuCard.tsx
import type { ReactNode } from "react";

type MenuCardProps = {
    icon: ReactNode;
    title: string;
    desc: string;
    colorClass?: string;  // 색상 클래스 옵션 추가
    onClick: () => void;
};

export function MenuCard({ 
    icon, 
    title, 
    desc, 
    colorClass = "bg-gradient-to-br from-blue-500 to-blue-600",  // 기본값
    onClick 
}: MenuCardProps) {
    // colorClass가 단순 색상인 경우와 그라데이션인 경우 모두 처리
    const isGradient = colorClass.includes("gradient");
    const baseColorClass = isGradient ? colorClass : `${colorClass}`;
    
    return (
        <button
            type="button"
            onClick={onClick}
            className={`${baseColorClass} text-white p-5 rounded-3xl shadow-lg active:scale-[0.98] 
                      transition-all group overflow-hidden relative flex flex-col gap-3
                      hover:shadow-xl transform hover:-translate-y-0.5`}
        >
            {/* 뒤쪽 큰 아이콘 실루엣 - PEMV2 스타일 */}
            <div className="absolute right-[-20px] bottom-[-20px] opacity-10 scale-150 
                          group-hover:scale-125 transition-transform duration-300">
                {icon}
            </div>

            {/* 앞쪽 작은 아이콘 - 더 부드러운 효과 */}
            <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm w-min relative z-10
                          group-hover:bg-white/25 transition-colors">
                {icon}
            </div>

            {/* 텍스트 영역 */}
            <div className="relative z-10 text-left">
                <div className="font-bold text-lg tracking-tight">{title}</div>
                <div className="text-xs opacity-90 font-medium mt-0.5">
                    {desc}
                </div>
            </div>

            {/* 호버 시 나타나는 빛 효과 */}
            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/5 
                          opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </button>
    );
}

// PEMV2 스타일에 맞춘 미리 정의된 색상 테마
export const MenuCardColors = {
    green: "bg-gradient-to-br from-green-500 to-emerald-600",
    orange: "bg-gradient-to-br from-orange-500 to-amber-600", 
    red: "bg-gradient-to-br from-red-500 to-rose-600",
    purple: "bg-gradient-to-br from-purple-500 to-violet-600",
    blue: "bg-gradient-to-br from-blue-500 to-indigo-600",
    pink: "bg-gradient-to-br from-pink-500 to-rose-500",
    cyan: "bg-gradient-to-br from-cyan-500 to-teal-600",
    yellow: "bg-gradient-to-br from-yellow-400 to-orange-500",
} as const;
