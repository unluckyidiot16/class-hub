// src/games/gameRegistry.ts
import type { ComponentType } from "react";
import type { QuizPackRow } from "../pages/student/StudentPlayPackPage";

export type GameKey = "quiz-only" | "qdd";

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
            const env = import.meta.env as any;
            const base: string =
                env.VITE_QDD_HTML_URL ||
                "https://unluckyidiot16.github.io/WebGames/QuizDiceDefense/QDD.html";

            const qpTemplate = env.VITE_QDD_QP_TEMPLATE as
                | string
                | undefined;

            let url = base;
            const hasQueryAlready = url.includes("?");

            if (qpTemplate) {
                const qpRaw = qpTemplate.replace(
                    "{packId}",
                    encodeURIComponent(pack.id)
                );
                url += `${hasQueryAlready ? "&" : "?"}qp=${encodeURIComponent(
                    qpRaw
                )}`;
            } else {
                const slug = (pack.title || "").trim() || "quizpack";
                url += `${hasQueryAlready ? "&" : "?"}pack=${encodeURIComponent(
                    slug
                )}`;
            }

            const extra = new URLSearchParams();
            extra.set("roomId", roomId);
            extra.set("packId", pack.id);

            return `${url}&${extra.toString()}`;
        },
    },
};

export function getGameDefinition(key: GameKey): GameSpec | undefined {
    return GAME_REGISTRY[key];
}
