// src/components/GameEmbedFrame.tsx
import { useRef } from "react";

type Props = {
    gameId: string;
    gameSessionId: string;
    roomId: string;
    quizpackJson: unknown;
    studentId: string;
};

export function GameEmbedFrame(props: Props) {
    const { gameId, gameSessionId, roomId, studentId } = props;

    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    // 아직 실제 게임 전송/브리지는 구현 안 했으므로 디버그 로그만 남김
    if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug("[GameEmbedFrame stub]", {
            gameId,
            gameSessionId,
            roomId,
            studentId,
        });
    }

    // TODO: 실제 gameRegistry / useGameHostBridge 연동은 나중에 구현
    return (
        <div
            style={{
                width: "100%",
                height: 400,
                border: "1px dashed #ccc",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                color: "#666",
            }}
        >
            GameEmbedFrame placeholder (gameId: {gameId})
            <iframe
                ref={iframeRef}
                style={{ display: "none" }}
                title="game-placeholder"
            />
        </div>
    );
}
