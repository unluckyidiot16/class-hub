// src/games/gameRegistry.ts

export type GameKey = "quiz-only" | "qdd" | "line-battle"; // 점점 늘릴 예정

export type GameSpec =
    | {
    key: GameKey;
    label: string;
    mode: "builtin-quiz"; // 기존 문제 카드
}
    | {
    key: GameKey;
    label: string;
    mode: "iframe";       // QDD처럼 외부 HTML 임베드
    buildUrl: (ctx: {
        pack: { id: string; title: string | null };
        roomId: string;
    }) => string;
}
    | {
    key: GameKey;
    label: string;
    mode: "react-component"; // LineBattle 같은 내부 게임
    component: React.ComponentType<any>;
};

export const GAME_REGISTRY: Record<GameKey, GameSpec> = {
    "quiz-only": {
        key: "quiz-only",
        label: "기본 퀴즈",
        mode: "builtin-quiz",
    },
    qdd: {
        key: "qdd",
        label: "다이스 퀴즈 디펜스",
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
                // pack.title → Eng5_9 같이 파일명으로 쓰는 기본 플랜
                const slug =
                    (pack.title || "").trim() || "quizpack";
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

    // line-battle, quiz-rpg 등은 뒤에 추가
};
