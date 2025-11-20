// src/games/quizmon/QuizMonClassPanel.tsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import type {
    QuizPackRow,
    QuizQuestionRow,
} from "../../pages/student/StudentPlayPackPage";
import type {
    QuizPackJsonV1,
    QuizPackQuestionV1,
} from "../../types/quizPackJson";
import { QuizMonGame } from "./QuizMonGame";
import type { QuizAnswerResult } from "./types"; 
import { useQuizmonProfile } from "./useQuizmonProfile";

type SessionRow = {
    id: string;
    status: "pending" | "running" | "ended";
    current_index: number | null;
};

type QuizMonClassPanelProps = {
    roomId: string | null;
    pack: QuizPackRow | null;
    session: SessionRow | null;

    /** React 게임(학생 화면)에서만 사용: Supabase game_events 연동용 */
    gameSessionId?: string | null;
        studentId?: string | null;
    
        // ⭐ StudentRoomPage / TeacherRoomLivePage 쪽에서 넘겨줄 콜백
        onQuizAnswer?: (result: QuizAnswerResult) => void;
};
export function QuizMonClassPanel(props: QuizMonClassPanelProps) {
    const {
        roomId,
        pack,
        session,
        gameSessionId,
        studentId,
        onQuizAnswer,
    } = props;

    // 학생 화면에서만 의미 있음 (studentId가 null이면 내부에서 바로 return)
    const { applyRaidResult } = useQuizmonProfile({
        studentKey: studentId ?? null,
    });

    const [quizpack, setQuizpack] = useState<QuizPackJsonV1 | null>(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // 🎯 1) 퀴즈팩이 바뀔 때마다 quiz_questions → QuizPackJsonV1 로딩
    useEffect(() => {
        if (!pack?.id) {
            setQuizpack(null);
            return;
        }

        let cancelled = false;

        const loadQuestions = async () => {
            setLoading(true);
            setErrorMsg(null);

            const { data, error } = await supabase
                .from("quiz_questions")
                .select(
                    "id, pack_id, index_in_pack, prompt, options, answer_index",
                )
                .eq("pack_id", pack.id)
                .order("index_in_pack", { ascending: true });

            if (cancelled) return;

            if (error) {
                console.error(
                    "[QuizMonClassPanel] load quiz_questions error",
                    error,
                );
                setErrorMsg("퀴즈를 불러오는 중 오류가 발생했습니다.");
                setQuizpack(null);
                setLoading(false);
                return;
            }

            const rows = (data ?? []) as QuizQuestionRow[];

            const questions: QuizPackQuestionV1[] = rows.map((row, idx) => ({
                id: row.id,
                index:
                    typeof (row as any).index_in_pack === "number"
                        ? (row as any).index_in_pack
                        : idx,
                prompt: row.prompt ?? "",
                options: (row.options ?? []) as string[],
                answerIndex: row.answer_index ?? 0,
                difficulty: null,
                tags: null,
                explanation: null,
                type: "choice",
            }));

            const qp: QuizPackJsonV1 = {
                type: "quizpack",
                version: "v1",
                pack: {
                    id: pack.id,
                    title: pack.title,
                    subject: pack.subject,
                    grade: pack.grade,
                    description: null,
                },
                questions,
            };

            setQuizpack(qp);
            setLoading(false);
        };

        loadQuestions();

        return () => {
            cancelled = true;
        };
    }, [pack?.id]);

    // 🎯 2) 상태별 가드 (pack / session / loading…)

    if (!pack) {
        return (
            <p>
                이 방에는 아직 <strong>퀴즈팩</strong>이 연결되어 있지 않습니다.
                <br />
                선생님이 퀴즈팩을 선택하면 퀴즈몬 전투가 시작됩니다.
            </p>
        );
    }

    if (!session || session.status === "pending") {
        return (
            <p>
                선생님이 아직 <strong>퀴즈몬 게임</strong>을 시작하지 않았습니다.
                <br />
                수업이 시작되면 이 위치에 전투 화면이 표시됩니다.
            </p>
        );
    }

    if (session.status === "ended") {
        return <p>이 수업의 퀴즈몬 게임이 종료되었습니다.</p>;
    }

    // 여기까지 왔으면 session.status === "running"
    if (loading || !quizpack) {
        return <p>퀴즈 데이터를 불러오는 중입니다…</p>;
    }

    if (errorMsg) {
        return (
            <p className="form-message error" style={{ marginTop: "0.5rem" }}>
                {errorMsg}
            </p>
        );
    }

    // 🎯 3) 실제 퀴즈몬 전투 컴포넌트
    return (
        <div>
            <QuizMonGame
                quizpack={quizpack}
                onQuizAnswer={onQuizAnswer}
                // 👉 StudentRoomPage(학생 측)에서 내려온 경우에만 값이 채워짐
                roomId={roomId}
                gameSessionId={gameSessionId}
                studentId={studentId}
                // ⭐ 배틀 종료 시 내 몬스터 레벨업/EXP 반영
                onBattleEnd={
                    studentId
                        ? ({ correct, total }) => {
                            void applyRaidResult({ correct, total });
                        }
                        : undefined
                }
            />
        </div>
    );
}
