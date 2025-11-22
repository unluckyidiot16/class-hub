// src/games/quizmon/QuizMonBattleSection.tsx
import type { ReactNode } from "react";
import { QuizMonGame } from "./QuizMonGame";
import type { QuizAnswerResult } from "./types";
import type { QuizPackJsonV1 } from "../../types/quizPackJson";
import type {
    QuizPackRow,
} from "../../pages/student/StudentPlayPackPage";

// src/games/quizmon/QuizMonBattleSection.tsx

type SessionRow = {
    id: string;
    status: "pending" | "running" | "ended";
    current_index: number | null;
};

type QuizMonBattleSectionMode = "class" | "practice";

type QuizMonBattleSectionProps = {
    /** 수업 모드 or 자습 모드 */
    mode?: QuizMonBattleSectionMode;

    /** 카드 헤더 타이틀 (기본: 모드에 따라 자동) */
    title?: string;

    /** 수업 모드에서만 의미 있음 */
    pack?: QuizPackRow | null;
    session?: SessionRow | null;

    /** 실제 퀴즈팩 JSON (준비 안 되었으면 null) */
    quizpack: QuizPackJsonV1 | null;
    quizLoading?: boolean;

    /** 에러 메시지 (있으면 상단에 표시) */
    errorMsg?: string | null;

    /** 공통 공용 속성 */
    roomId?: string | null;
    gameSessionId?: string | null;
    studentId?: string | null;

    /** quizmon_profile.id – 있으면 이 프로필의 파티(1~3번)로 전투 시작 */
    profileId?: string | null;

    /** 정답 이벤트 핸들러 */
    onQuizAnswer?: (result: QuizAnswerResult) => void;

    /** 배틀 종료 콜백 (정답/전체 수 요약) */
    onBattleEnd?: (summary: { correct: number; total: number }) => void;
};

export function QuizMonBattleSection(props: QuizMonBattleSectionProps) {
    const {
        mode = "class",
        title,
        pack,
        session,
        quizpack,
        quizLoading,
        errorMsg,
        roomId,
        gameSessionId,
        studentId,
        profileId,
        onQuizAnswer,
        onBattleEnd,
    } = props;

    let content: ReactNode = null;

    if (mode === "class") {
        if (!pack) {
            content = (
                <p>
                    이 방에는 아직 <strong>퀴즈팩</strong>이 연결되어 있지
                    않습니다.
                    <br />
                    선생님이 퀴즈팩을 선택하면 퀴즈몬 전투를 진행할 수
                    있어요.
                </p>
            );
        } else if (!session || session.status === "pending") {
            content = (
                <p>
                    선생님이 아직 <strong>퀴즈몬 게임</strong>을 시작하지
                    않았습니다.
                    <br />
                    수업이 시작되면 내 파트너가 전투에 참가합니다.
                </p>
            );
        } else if (session.status === "ended") {
            content = (
                <p>
                    이 수업의 퀴즈몬 게임이 종료되었습니다.
                    <br />
                    다음 수업을 기다리는 동안 로비에서 파트너를 관리해
                    보세요.
                </p>
            );
        } else if (quizLoading || !quizpack) {
            content = <p>퀴즈 데이터를 불러오는 중입니다…</p>;
        } else if (errorMsg) {
            content = (
                <p
                    className="form-message error"
                    style={{ marginTop: "0.5rem" }}
                >
                    {errorMsg}
                </p>
            );
        } else {
            // running + quizpack 준비 완료
            content = (
                <QuizMonGame
                    quizpack={quizpack}
                    onQuizAnswer={onQuizAnswer}
                    roomId={roomId ?? null}
                    gameSessionId={gameSessionId ?? null}
                    studentId={studentId ?? null}
                    profileId={profileId ?? null}
                    onBattleEnd={onBattleEnd}
                />
            );
        }
    } else {
        // 연습 모드
        if (quizLoading || !quizpack) {
            content = <p>연습용 퀴즈를 불러오는 중입니다…</p>;
        } else if (errorMsg) {
            content = (
                <p
                    className="form-message error"
                    style={{ marginTop: "0.5rem" }}
                >
                    {errorMsg}
                </p>
            );
        } else {
            content = (
                <QuizMonGame
                    quizpack={quizpack}
                    onQuizAnswer={onQuizAnswer}
                    roomId={roomId ?? null}
                    gameSessionId={gameSessionId ?? null}
                    studentId={studentId ?? null}
                    onBattleEnd={onBattleEnd}
                />
            );
        }
    }

    const headerTitle =
        title ?? (mode === "class" ? "전투 / 수업 상태" : "연습 배틀");

    return (
        <div>
            <h3 style={{ marginTop: 0 }}>{headerTitle}</h3>
            {content}
        </div>
    );
}
