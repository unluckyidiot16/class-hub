// src/games/gameRegistry.ts
import type { ComponentType } from "react";
import type { QuizPackRow } from "../pages/student/StudentPlayPackPage";
import { buildQddUrlForPack } from "../utils/qddLink";

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
            // 기본 QDD URL 생성 (pack=슬러그 or qp=...)
            const base = buildQddUrlForPack({
                id: pack.id,
                title: pack.title,
            });

            // 혹시 title이 비어있어서 null이 나오면 안전하게 폴백
            const safeBase =
                base ||
                "https://unluckyidiot16.github.io/WebGames/QuizDiceDefense/QDD.html";

            // 방/팩 메타 정보 추가 (QDD가 필요하면 활용)
            const extra = new URLSearchParams();
            extra.set("roomId", roomId);
            extra.set("packId", pack.id);

            const hasQuery = safeBase.includes("?");
            const sep = hasQuery ? "&" : "?";

            return `${safeBase}${sep}${extra.toString()}`;
        },
    },
};

export function getGameDefinition(key: GameKey): GameSpec | undefined {
    return GAME_REGISTRY[key];
}
