// src/games/quizmon/captureSession.ts
import type { QuizAnswerResult } from "./types";
import type { CaptureBallId } from "./captureConfig";
import { CAPTURE_BALL_CONFIG } from "./captureConfig";

export type CaptureSessionState = {
    ballId: CaptureBallId;
    baseRate: number;      // 종+볼 기준 기본 포획률
    currentRate: number;   // 현재 포획률
    streak: number;        // 연속 정답 수
    questionsAnswered: number;
    maxQuestions: number;
};

export function createCaptureSession(params: {
    ballId: CaptureBallId;
    baseRate: number;
}): CaptureSessionState {
    const meta = CAPTURE_BALL_CONFIG[params.ballId];
    return {
        ballId: params.ballId,
        baseRate: params.baseRate,
        currentRate: params.baseRate,
        streak: 0,
        questionsAnswered: 0,
        maxQuestions: meta.maxQuestions,
    };
}

// 포획률 계산: base * (1 + k * streak)
function calcRate(
    baseRate: number,
    ballId: CaptureBallId,
    streak: number,
): number {
    const k = CAPTURE_BALL_CONFIG[ballId].streakK;
    const raw = baseRate * (1 + k * streak);
    return Math.min(0.95, Math.max(0.05, raw));
}

/**
 * ✅ 퀴즈 1문제 결과를 반영해서 세션 상태를 업데이트
 * - capture 모드에서 handleAnswer 안에서 이 함수만 호출해도 됨
 */
export function applyCaptureAnswer(
    session: CaptureSessionState,
    quizResult: QuizAnswerResult,
): CaptureSessionState {
    const correct = quizResult.correct;
    const nextQuestions = session.questionsAnswered + 1;

    const nextStreak = correct ? session.streak + 1 : 0;
    const nextRate = calcRate(
        session.baseRate,
        session.ballId,
        nextStreak,
    );

    return {
        ...session,
        streak: nextStreak,
        currentRate: nextRate,
        questionsAnswered: nextQuestions,
    };
}

export function isCaptureSessionFinished(
    session: CaptureSessionState,
): boolean {
    return session.questionsAnswered >= session.maxQuestions;
}

// 실제 포획 시도 (랜덤)
export function rollCapture(session: CaptureSessionState): boolean {
    const r = Math.random(); // 0~1
    return r < session.currentRate;
}
