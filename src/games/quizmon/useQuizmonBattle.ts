// // src/games/quizmon/useQuizmonBattle.ts
// import { useEffect, useMemo, useState } from "react";
// import type {
//     BattleState,
//     Move,
//     QuizAnswerResult,
//     QuizQuestionLite,
//     Monster,
// } from "./types";
// import type { QuizPackJsonV1 } from "../../types/quizPackJson";
// import { quizPackToLiteQuestions } from "./quizSource";
// import { createInitialBattleState } from "./mockData";
//
// /** QuizMon 배틀 훅 옵션 */
// export type UseQuizmonBattleOptions = {
//     quizpack: QuizPackJsonV1;
//
//     // 클래스 레이드용 메타
//     roomId?: string | null;
//     gameSessionId?: string | null;
//     studentId?: string | null;
//
//     /** quizmon_profile.id - 있으면 프로필 파티 기준으로 전투 시작/리셋 */
//     profileId?: string | null;
//
//     /** 퀴즈 한 문제 풀 때마다 상위로 전달 (기존 QuizMonGame props 그대로) */
//     onQuizAnswer?: (result: QuizAnswerResult) => void;
//
//     /** 배틀 종료 시 한 번만 호출되는 콜백 (기존 onBattleEnd 그대로) */
//     onBattleEnd?: (summary: { correct: number; total: number }) => void;
//
//     /**
//      * (선택) 프로필 파티 기준으로 배틀 상태를 리셋하는 함수
//      * - 지금 QuizMonGame 안에 있는 resetBattleWithProfileParty 를
//      *   나중에 여기로 옮기거나, 이 콜백으로 넘겨서 사용할 수 있음
//      */
//     onResetWithProfileParty?: (profileId: string) => Promise<BattleState> | BattleState;
// };
//
// /** 훅에서 바깥으로 뱉어줄 값들 */
// export type UseQuizmonBattleResult = {
//     // 🔹 배틀 상태 & 퀴즈
//     state: BattleState;
//     questions: QuizQuestionLite[];
//
//     // 🔹 현재 출전 중인 몬스터 (우리 / 적)
//     playerMon: Monster;
//     enemyMon: Monster;
//
//     // 🔹 전투 통계
//     battleStats: { correct: number; total: number };
//     accuracyPercent: number | null;
//     battleFinished: boolean;
//     canSelectMove: boolean;
//
//     // 🔹 액션 핸들러
//     handleSelectMove: (move: Move) => void;
//     handleAnswer: (optionIndex: number) => void;
//     handleReset: () => void;
// };
//
// // 간단 셔플 유틸 (QuizMonGame 파일 상단 shuffleArray와 같은 역할)
// function shuffleArray<T>(arr: T[]): T[] {
//     const copy = [...arr];
//     for (let i = copy.length - 1; i > 0; i--) {
//         const j = Math.floor(Math.random() * (i + 1));
//         [copy[i], copy[j]] = [copy[j], copy[i]];
//     }
//     return copy;
// }
//
// /**
//  * QuizMon 배틀 전용 상태 + 로직 훅
//  * - 기존 QuizMonGame 안에 있던 전투 관련 state / handler를
//  *   차츰 이쪽으로 옮겨 올 예정
//  */
// export function useQuizmonBattle(
//     options: UseQuizmonBattleOptions,
// ): UseQuizmonBattleResult {
//     const {
//         quizpack,
//         onQuizAnswer,
//         onBattleEnd,
//         roomId,
//         gameSessionId,
//         studentId,
//         profileId,
//         onResetWithProfileParty,
//     } = options;
//
//     // 1) 전투 상태
//     const [state, setState] = useState<BattleState>(() =>
//         createInitialBattleState(),
//     );
//     const [questionIndex, setQuestionIndex] = useState(0);
//     const [questionOrder, setQuestionOrder] = useState<number[]>([]);
//
//     // 이번 배틀 퀴즈 통계
//     const [battleStats, setBattleStats] = useState({ correct: 0, total: 0 });
//     const [hasReportedEnd, setHasReportedEnd] = useState(false);
//
//     // 2) 퀴즈 소스: quizpackJson → Lite 배열
//     const questions: QuizQuestionLite[] = useMemo(
//         () => quizPackToLiteQuestions(quizpack),
//         [quizpack],
//     );
//
//     // quizpack이 바뀌면 문제 순서 셔플
//     useEffect(() => {
//         if (!questions.length) {
//             setQuestionOrder([]);
//             setQuestionIndex(0);
//             return;
//         }
//         const indices = questions.map((_, idx) => idx);
//         setQuestionOrder(shuffleArray(indices));
//         setQuestionIndex(0);
//     }, [questions]);
//
//     // 현재 출전 중인 몬스터 (간단 파생값)
//     const playerMon: Monster =
//         state.player.monsters[state.player.activeIndex] ??
//         state.player.monsters[0];
//     const enemyMon: Monster =
//         state.enemy.monsters[state.enemy.activeIndex] ??
//         state.enemy.monsters[0];
//
//     // 배틀 종료 여부
//     const battleFinished =
//         state.player.monsters.every((m) => m.hp <= 0) ||
//         state.enemy.monsters.every((m) => m.hp <= 0);
//
//     // 기술 선택 가능 여부
//     const canSelectMove =
//         state.phase !== "finished" &&
//         questions.length > 0 &&
//         playerMon &&
//         enemyMon &&
//         playerMon.hp > 0 &&
//         enemyMon.hp > 0;
//
//     // 정답률 %
//     const accuracyPercent =
//         battleStats.total > 0
//             ? Math.round((battleStats.correct / battleStats.total) * 100)
//             : null;
//
//     /**
//      * 다음 문제 한 개를 꺼내는 유틸
//      * - 기존 QuizMonGame 의 getNextQuestion 로직(보기 셔플 포함)을
//      *   나중에 그대로 이쪽으로 옮기면 됨
//      */
//     const getNextQuestion = (): QuizQuestionLite | null => {
//         if (!questions.length || !questionOrder.length) return null;
//
//         const orderIdx = questionIndex % questionOrder.length;
//         const baseIdx = questionOrder[orderIdx];
//         const baseQuestion = questions[baseIdx];
//         if (!baseQuestion) return null;
//
//         // TODO: QuizMonGame 의 getNextQuestion 처럼
//         //  - 보기(option) 인덱스 셔플
//         //  - answerIndex 재계산
//         //  로직을 그대로 이관
//         return baseQuestion;
//     };
//
//     /**
//      * 기술 선택 핸들러
//      * - 기존 QuizMonGame 의 handleSelectMove 로직을 이쪽으로 옮기면 됨
//      */
//     const handleSelectMove = (move: Move) => {
//         // TODO:
//         // 1) phase / HP 가드
//         // 2) getNextQuestion() 호출
//         // 3) state.pendingPlayerMove / pendingEnemyMove 세팅
//         // 4) phase 를 "quiz" 로 전환, questionStartedAt 기록
//         //    → 기존 QuizMonGame 의 handleSelectMove 를 그대로 복붙 후
//         //       setState, getNextQuestion, setQuestionIndex 사용 부분만 경로 맞추면 됨.
//     };
//
//     /**
//      * 퀴즈 답변 핸들러
//      * - 기존 QuizMonGame 의 handleAnswer 로직을 이쪽으로 옮기면 됨
//      */
//     const handleAnswer = (optionIndex: number) => {
//         // TODO:
//         // 1) phase !== "quiz" / currentQuestion null 가드
//         // 2) QuizAnswerResult 생성 (timeMs 포함)
//         // 3) setBattleStats 로 correct / total 업데이트
//         // 4) options.onQuizAnswer?.(quizResult) 호출
//         // 5) logGameEvent(...) 로 Supabase game_events 기록
//         //    (roomId, gameSessionId, studentId 사용)
//         // 6) calcQuizMod / calcHitChance / calcDamage / rollHit /
//         //    applyAbilityDamageModifier / applyDamageToMonster 사용해서
//         //    BattleState 갱신
//         //    → 이 부분은 그대로 setState(prev => { ... }) 블록을 복사해서
//         //       state, playerMon, enemyMon 참조만 맞춰주면 됨.
//         //
//         // 7) 레이드 데미지(raidDamage) / battleMode 관련 처리는
//         //    필요 시 options 쪽으로 빼거나, 나중에 mode 인자를 추가해서 확장.
//     };
//
//     /**
//      * 배틀 리셋 핸들러
//      * - v1 에서는 createInitialBattleState 사용
//      * - 프로필 파티 기준 리셋은 onResetWithProfileParty / profileId 사용
//      */
//     const handleReset = () => {
//         // 프로필 파티 기반 리셋을 외부에서 처리하고 싶으면
//         // onResetWithProfileParty 를 사용
//         if (profileId && onResetWithProfileParty) {
//             const next = onResetWithProfileParty(profileId);
//             if (next instanceof Promise) {
//                 void next.then((resolved) => {
//                     setState(resolved);
//                     setBattleStats({ correct: 0, total: 0 });
//                     setHasReportedEnd(false);
//                     setQuestionIndex(0);
//                 });
//             } else {
//                 setState(next);
//                 setBattleStats({ correct: 0, total: 0 });
//                 setHasReportedEnd(false);
//                 setQuestionIndex(0);
//             }
//             return;
//         }
//
//         // 기본: mock 상태로 리셋
//         setState(createInitialBattleState());
//         setBattleStats({ correct: 0, total: 0 });
//         setHasReportedEnd(false);
//         setQuestionIndex(0);
//         // questionOrder 는 quizpack useEffect 에서 다시 셔플됨
//     };
//
//     // 배틀이 끝난 시점에 한 번만 onBattleEnd 호출
//     useEffect(() => {
//         if (!onBattleEnd) return;
//         if (state.phase !== "finished") return;
//         if (hasReportedEnd) return;
//         if (battleStats.total <= 0) return; // 한 문제도 풀지 않았다면 스킵
//
//         onBattleEnd({ ...battleStats });
//         setHasReportedEnd(true);
//     }, [state.phase, battleStats, onBattleEnd, hasReportedEnd]);
//
//     return {
//         state,
//         questions,
//         playerMon,
//         enemyMon,
//         battleStats,
//         accuracyPercent,
//         battleFinished,
//         canSelectMove,
//         handleSelectMove,
//         handleAnswer,
//         handleReset,
//     };
// }
