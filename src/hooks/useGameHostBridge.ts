// src/hooks/useGameHostBridge.ts
import { useEffect } from "react";
import { logGameEvent } from "../../api/gameSessions";

type HostBridgeParams = {
    iframeRef: React.RefObject<HTMLIFrameElement>;
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
    const { iframeRef, gameSessionId, roomId, quizpackJson, studentId } = params;

    useEffect(() => {
        function onMessage(ev: MessageEvent) {
            const msg = ev.data as GameToHostMessage;
            if (!msg || typeof msg !== "object") return;
            if (msg.sessionId !== gameSessionId) return; // 다른 세션 무시

            // 1) 퀴즈팩 요청 응답
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

            // 2) 정답/요약 이벤트 로깅
            if (msg.type === "CH_REPORT_ANSWER") {
                logGameEvent({
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
                logGameEvent({
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
