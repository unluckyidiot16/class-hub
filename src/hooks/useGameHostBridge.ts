// src/hooks/useGameHostBridge.ts
import { useEffect } from "react";
import { logGameEvent } from "../api/gameSessions";

type HostBridgeParams = {
    iframeRef: React.RefObject<HTMLIFrameElement | null>;
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
        gameId,
        gameSessionId,
        roomId,
        quizpackJson,
        studentId,
    } = params;

    useEffect(() => {
        if (!iframeRef.current) return;
        if (!gameSessionId || !roomId || !studentId) return;

        function handleMessage(ev: MessageEvent<GameToHostMessage>) {
            const msg = ev.data;
            if (!msg || typeof msg !== "object") return;

            // ✅ 공통 메타
            const baseMeta = {
                gameId,
                packId: quizpackJson?.pack?.id ?? null,
                studentId,
            };

            if (msg.type === "CH_REPORT_ANSWER") {
                const { questionId, correct, answerIndex, timeMs } = msg;

                const payload = {
                    ...baseMeta,
                    kind: "answer",
                    questionId,
                    correct,
                    answerIndex,
                    timeMs: timeMs ?? null,
                };

                console.log("[HostBridge] logGameEvent params", {
                    gameSessionId,
                    roomId,
                    studentId,
                    payload,
                });

                void logGameEvent({
                    gameSessionId: gameSessionId,
                    roomId: roomId,
                    studentId: studentId,
                    eventType: "answer",
                    payload,
                });
            }


            if (msg.type === "CH_REPORT_SUMMARY") {
                const payload = {
                    ...baseMeta,
                    kind: "summary",
                    summary: msg.summary,
                };

                void logGameEvent({
                    gameSessionId: gameSessionId,
                    roomId: roomId,
                    studentId: studentId,
                    eventType: "summary",
                    payload,
                });
            }

            // CH_REQUEST_QUIZPACK 는 필요 시 나중에 처리
        }

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [iframeRef, gameId, gameSessionId, roomId, quizpackJson, studentId]);
}
