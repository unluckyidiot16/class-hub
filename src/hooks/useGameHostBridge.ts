// src/hooks/useGameHostBridge.ts
import { useEffect } from "react";
import { logGameEvent } from "../api/gameSessions";

type HostBridgeParams = {
    iframeRef: React.RefObject<HTMLIFrameElement | null>; // ✅ null 허용
    gameId: string;
    gameSessionId: string;
    roomId: string;
    quizpackJson: any;
    studentId: string;
};

type GameToHostMessage =
    | {
    type: "CH_REQUEST_QUIZPACK";
    sessionId: string;
}
    | {
    type: "CH_REPORT_ANSWER";
    sessionId: string;
    questionId: string;
    correct: boolean;
    answerIndex: number;
    timeMs?: number;
}
    | {
    type: "CH_REPORT_SUMMARY";
    sessionId: string;
    summary: any;
};

export function useGameHostBridge(params: HostBridgeParams) {
    const {
        iframeRef,
        gameSessionId,
        roomId,
        quizpackJson,
        studentId,
        // ...
    } = params;

    useEffect(() => {
        if (!iframeRef.current) return;
        if (!gameSessionId || !roomId || !studentId) return;  // ✅ 가드

        function handleMessage(ev: MessageEvent<GameToHostMessage>) {
            const msg = ev.data;
            if (!msg || typeof msg !== "object") return;

            if (msg.type === "CH_REPORT_ANSWER") {
                logGameEvent({
                    gameSessionId,
                    roomId,
                    studentId,
                    eventType: "answer",
                    payload: {
                        questionId: msg.questionId,
                        answerIndex: msg.answerIndex,
                        correct: msg.correct,
                        timeMs: msg.timeMs ?? null,
                    },
                });
            }

            if (msg.type === "CH_REPORT_SUMMARY") {
                logGameEvent({
                    gameSessionId,
                    roomId,
                    studentId,
                    eventType: "summary",
                    payload: msg.summary,
                });
            }

            // CH_REQUEST_QUIZPACK 처리 등...
        }

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [iframeRef, gameSessionId, roomId, quizpackJson, studentId]);
}
