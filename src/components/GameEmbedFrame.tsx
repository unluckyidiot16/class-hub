// src/components/GameEmbedFrame.tsx
import React, { useEffect, useRef } from "react";
import { getGameDefinition } from "../games/gameRegistry";
import { useGameHostBridge } from "../hooks/useGameHostBridge";

type Props = {
    gameId: string;
    gameSessionId: string;
    roomId: string;
    quizpackJson: any;     // 이미 ClassHub에서 로드된 퀴즈팩
    studentId: string;     // 현재 학생 식별자
};

export const GameEmbedFrame: React.FC<Props> = ({
                                                    gameId,
                                                    gameSessionId,
                                                    roomId,
                                                    quizpackJson,
                                                    studentId,
                                                }) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    useGameHostBridge({
        iframeRef,
        gameId,
        gameSessionId,
        roomId,
        quizpackJson,
        studentId,
    });

    const def = getGameDefinition(gameId);
    if (!def) return <div>알 수 없는 게임 ID: {gameId}</div>;

    // mode=embed, session, gameId를 쿼리로 전달
    const src = `${def.url}?mode=embed&session=${gameSessionId}&game=${gameId}`;

    return (
        <iframe
            ref={iframeRef}
            src={src}
            style={{ width: "100%", height: "100%", border: "none" }}
            allow="fullscreen"
        />
    );
};
