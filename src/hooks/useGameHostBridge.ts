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
        // gameId 는 지금은 안 쓰지만 나중 확장용으로 존재 가능
    } = params;

    useEffect(() => {
        // ✅ 훅 자체는 항상 호출, 내부에서만 조건 체크
        if (!gameSessionId || !roomId) {
            return;
        }

        function onMessage(ev: MessageEvent) {
            const msg = ev.data as GameToHostMessage;
            if (!msg || typeof msg !== "object") return;
            if (msg.sessionId !== gameSessionId) return;

            if (msg.type === "CH_REQUEST_QUIZPACK") {
                iframeRef.current?.contentWindow?.postMessage(
                    {
                        type: "CH_QUIZPACK_DATA",
                        sessionId: gameSessionId,
                        quizpack: quizpackJson,
                    },
                    "*",
                );
                return;
            }

            if (msg.type === "CH_REPORT_ANSWER") {
                void logGameEvent({
                    gameSessionId,
                    roomId,
                    studentId,
                    eventType: "answer",
                    payload: {
                        questionId: msg.questionId,
                        correct: msg.correct,
                        answerIndex: msg.answerIndex,
                        timeMs: msg.timeMs ?? null,
                    },
                }).catch(console.error);
            } else if (msg.type === "CH_REPORT_SUMMARY") {
                void logGameEvent({
                    gameSessionId,
                    roomId,
                    studentId,
                    eventType: "summary",
                    payload: msg.summary,
                }).catch(console.error);
            }
        }

        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [iframeRef, gameSessionId, roomId, quizpackJson, studentId]);
}
