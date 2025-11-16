// src/api/gameSessions.ts

export type GameEventLog = {
    gameSessionId: string;
    roomId: string;
    studentId: string;
    eventType: "answer" | "summary" | string;
    payload: unknown;
};

/**
 * 게임 세션 이벤트 로그용 스텁 함수.
 * 나중에 Supabase / 서버로 실제 로그를 보내고 싶을 때
 * 이 함수 안을 구현하면 됩니다.
 */
export async function logGameEvent(event: GameEventLog): Promise<void> {
    if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug("[logGameEvent stub]", event);
    }
    // 현재는 아무 작업도 하지 않음
}
