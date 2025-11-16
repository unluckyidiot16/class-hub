// src/games/gameRegistry.ts
export type GameId = "qdd" | "line-battle" | "quizmon" | string;

export type GameDefinition = {
    id: GameId;
    name: string;
    // 실제 iframe으로 띄울 URL
    url: string;
    // 이 게임이 요구하는 퀴즈 타입 등 (추후 확장)
    requiresQuizPack: boolean;
    // 향후 "라운드 단위 리포팅 지원" 같은 플래그도 추가 가능
};

export const GAME_REGISTRY: GameDefinition[] = [
    {
        id: "qdd",
        name: "Quiz Dice Defense",
        url: "https://unluckyidiot16.github.io/WebGames/QuizDiceDefense/QDD.html",
        requiresQuizPack: true,
    },
    // 앞으로 추가될 다른 게임들...
];

export function getGameDefinition(id: GameId): GameDefinition | undefined {
    return GAME_REGISTRY.find(g => g.id === id);
}
