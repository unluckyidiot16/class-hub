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
        // 세션/방/학생 식별자가 준비 안 됐으면 아직 브리지 안 열기
        if (!gameSessionId || !roomId || !studentId) return;

        function handleMessage(ev: MessageEvent) {
            // 내 iframe이 아직 없으면 무시
            if (!iframeRef.current) return;
            // 다른 iframe / 윈도우에서 온 메시지는 무시
            if (ev.source !== iframeRef.current.contentWindow) return;

            const msg = ev.data as GameToHostMessage;
            if (!msg || typeof msg !== "object" || !("type" in msg)) return;

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

                void logGameEvent({
                    gameSessionId,
                    roomId,
                    studentId,
                    eventType: "answer",
                    payload,
                });
            } else if (msg.type === "CH_REPORT_SUMMARY") {
                const payload = {
                    ...baseMeta,
                    kind: "summary",
                    summary: msg.summary,
                };

                void logGameEvent({
                    gameSessionId,
                    roomId,
                    studentId,
                    eventType: "summary",
                    payload,
                });
            }
            // CH_REQUEST_QUIZPACK는 필요해지면 여기서 처리
        }

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [iframeRef, gameId, gameSessionId, roomId, quizpackJson, studentId]);
}
