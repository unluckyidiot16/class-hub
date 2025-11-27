// src/games/gameRegistry.ts
import type { ComponentType } from "react";
import type { QuizPackRow } from "../pages/student/StudentPlayPackPage";
import { buildQddUrlForPack } from "../utils/qddLink";
// ✅ 새로 추가
import { QuizMonClassPanel } from "./quizmon/QuizMonClassPanel";
import { PemMonGame } from "./pemmon/PemMonGame";


// 🔥 quizmon 추가
export type GameKey = "quiz-only" | "qdd" | "pixel" | "quizmon"  | "pem";

export type GameMode = "builtin-quiz" | "iframe" | "react-component";

type BaseSpec = {
    key: GameKey;
    label: string;
};

export type GameSpec =
    | (BaseSpec & {
    mode: "builtin-quiz";
})
    | (BaseSpec & {
    mode: "iframe";
    buildUrl: (ctx: { pack: QuizPackRow; roomId: string }) => string;
})
    | (BaseSpec & {
    mode: "react-component";
    component: ComponentType<any>;
});

export const GAME_REGISTRY: Record<GameKey, GameSpec> = {
    "quiz-only": {
        key: "quiz-only",
        label: "기본 퀴즈",
        mode: "builtin-quiz",
    },
    qdd: {
        key: "qdd",
        label: "퀴즈 다이스 디펜스",
        mode: "iframe",
        buildUrl: ({ pack, roomId }) => {
            const base = buildQddUrlForPack({
                id: pack.id,
                title: pack.title,
            });

            const safeBase =
                base ||
                "https://unluckyidiot16.github.io/WebGames/QuizDiceDefense/QDD.html";

            const extra = new URLSearchParams();
            extra.set("roomId", roomId);
            extra.set("packId", pack.id);

            const hasQuery = safeBase.includes("?");
            const sep = hasQuery ? "&" : "?";

            return `${safeBase}${sep}${extra.toString()}`;
        },
    },

    pixel: {
        key: "pixel",
        label: "픽셀 미니 퀴즈",
        mode: "iframe",
        buildUrl: ({ pack, roomId }) => {
            const base =
                "https://unluckyidiot16.github.io/WebGames/Pixel/Pixel.html";
            const params = new URLSearchParams();

            if (pack?.id) params.set("packId", pack.id);
            if (roomId) params.set("roomId", roomId);

            const qs = params.toString();
            return qs ? `${base}?${qs}` : base;
        },
    },

    // ✅ 새로 추가: 퀴즈몬 Class
    quizmon: {
        key: "quizmon",
        label: "퀴즈몬 Class",
        mode: "react-component",
        component: QuizMonClassPanel,
    },

    // pem: {
    //     key: "pem",
    //     label: "PEM 포켓몬 육성",
    //     mode: "iframe",
    //     buildUrl: ({ pack, roomId }) => {
    //         const base =
    //             "https://unluckyidiot16.github.io/WebGames/PEM/PEM.html";
    //         const params = new URLSearchParams();
    //
    //         // 🔸 pack은 지금은 안 써도 되지만, 나중을 위해 남겨둬도 됨
    //         if (pack?.id) params.set("packId", pack.id);
    //         if (roomId) params.set("roomId", roomId);
    //
    //         const qs = params.toString();
    //         return qs ? `${base}?${qs}` : base;
    //     },
    // },
    
    pem: {
        key: "pem",
        label: "포켓몬 맞춤법 탐험대",
        mode: "react-component",
        component: PemMonGame,
    },
};

export function getGameDefinition(key: GameKey): GameSpec | undefined {
    return GAME_REGISTRY[key];
}
