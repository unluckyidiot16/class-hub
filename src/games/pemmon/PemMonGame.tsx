// src/games/pemmon/PemMonGame.tsx

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import type {
    QuizPackRow,
    QuizQuestionRow,
    PartnerState,
    SubmissionRow,
    TrainingState,
    ViewState,
} from "./pemmonTypes";
import { IntroView } from "./IntroView";
import { LobbyView } from "./LobbyView";
import { PvpView } from "./PvpView";
import { DexView } from "./DexView";
import { pickRandomEncounter } from "./exploreLogic";

type PemMonGameProps = {
    classId: string | null;
    roomId: string;
    studentId: string | null;
    pack: QuizPackRow | null;
};

export function PemMonGame({
                               classId,
                               roomId,
                               studentId,
                               pack,
                           }: PemMonGameProps) {
    const [view, setView] = useState<ViewState>("intro");
    const [trainerName, setTrainerName] = useState("");
    const [partner, setPartner] = useState<PartnerState | null>(null);
    const [coins, setCoins] = useState(0);

    const [opponents, setOpponents] = useState<SubmissionRow[]>([]);
    const [loadingOpponents, setLoadingOpponents] = useState(false);
    const [pvpEnemy, setPvpEnemy] = useState<SubmissionRow | null>(null);
    const [pvpLog, setPvpLog] = useState<string[]>([]);
    const [pvpResult, setPvpResult] = useState<
        "idle" | "fighting" | "win" | "lose"
    >("idle");

    const [questions, setQuestions] = useState<QuizQuestionRow[]>([]);
    const [training, setTraining] = useState<TrainingState>({ phase: "idle" });

    const hasKey = useMemo(
        () => !!classId && !!studentId,
        [classId, studentId],
    );

    /* ───────────────────────
       퀴즈 로딩
    ─────────────────────── */
    useEffect(() => {
        if (!pack?.id) {
            setQuestions([]);
            return;
        }

        let cancelled = false;

        const loadQuestions = async () => {
            const { data, error } = await supabase
                .from("quiz_questions")
                .select("*")
                .eq("pack_id", pack.id)
                .order("index_in_pack", { ascending: true });

            if (cancelled) return;

            if (error) {
                console.error("[PemMon] load questions error", error);
                setQuestions([]);
                return;
            }

            const normalized = (data ?? []).map((q: any) => ({
                id: q.id,
                pack_id: q.pack_id,
                text: q.text ?? "",
                options: (q.options ?? null) as string[] | null,
                answer_index:
                    typeof q.answer_index === "number"
                        ? q.answer_index
                        : null,
            })) as QuizQuestionRow[];

            setQuestions(normalized);
        };

        void loadQuestions();
        return () => {
            cancelled = true;
        };
    }, [pack?.id]);

    /* ───────────────────────
       로컬 세이브/로드
    ─────────────────────── */
    useEffect(() => {
        try {
            const raw = localStorage.getItem("pemmon_state");
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (saved.trainerName) setTrainerName(saved.trainerName);
            if (saved.coins != null) setCoins(saved.coins);
            if (saved.partner) setPartner(saved.partner);
            setView(saved.partner ? "lobby" : "intro");
        } catch (e) {
            console.error("failed to parse pemmon_state", e);
        }
    }, []);

    useEffect(() => {
        try {
            const payload = { trainerName, coins, partner };
            localStorage.setItem("pemmon_state", JSON.stringify(payload));
        } catch {
            // ignore
        }
    }, [trainerName, coins, partner]);

    /* ───────────────────────
       경험치 / 레벨업
    ─────────────────────── */
    const gainExp = (amount: number) => {
        if (!partner) return;
        let level = partner.level;
        let exp = partner.exp + amount;
        let maxHp = partner.maxHp;

        while (exp >= 100) {
            exp -= 100;
            level += 1;
            maxHp = Math.floor(maxHp * 1.1);
        }

        setPartner({ ...partner, level, exp, maxHp });
    };

    /* ───────────────────────
       훈련 통계 기록
    ─────────────────────── */
    const recordTrainingStats = async (total: number, correct: number) => {
        if (!hasKey || !classId || !studentId) return;

        try {
            const { data, error } = await supabase
                .from("pem_mon_submissions")
                .select(
                    "id, total_training_sessions, total_training_questions, total_training_correct",
                )
                .eq("class_id", classId)
                .eq("student_key", studentId)
                .maybeSingle();

            if (error) {
                console.error(
                    "[PemMon] recordTrainingStats select error",
                    error,
                );
                return;
            }
            if (!data) {
                // 아직 출전 데이터가 없으면 통계는 기록하지 않음
                return;
            }

            const nextSessions = (data.total_training_sessions ?? 0) + 1;
            const nextQuestions = (data.total_training_questions ?? 0) + total;
            const nextCorrect = (data.total_training_correct ?? 0) + correct;

            const { error: updateError } = await supabase
                .from("pem_mon_submissions")
                .update({
                    total_training_sessions: nextSessions,
                    total_training_questions: nextQuestions,
                    total_training_correct: nextCorrect,
                    last_training_at: new Date().toISOString(),
                })
                .eq("id", data.id);

            if (updateError) {
                console.error(
                    "[PemMon] recordTrainingStats update error",
                    updateError,
                );
            }
        } catch (e) {
            console.error("[PemMon] recordTrainingStats exception", e);
        }
    };

    /* ───────────────────────
       출전 데이터 업로드
    ─────────────────────── */
    const uploadSubmission = async () => {
        if (!hasKey) {
            alert("classId / studentId가 아직 준비되지 않았어요.");
            return;
        }
        if (!partner || !trainerName.trim()) {
            alert("트레이너 이름과 파트너 포켓몬을 먼저 설정해주세요.");
            return;
        }

        const payload = {
            class_id: classId!,
            room_id: roomId,
            student_key: studentId!,
            trainer_name: trainerName.trim(),
            partner_species: partner.species.id,
            partner_level: partner.level,
            partner_stats: {
                maxHp: partner.maxHp,
                atk: partner.species.atk,
                def: partner.species.def,
            },
            coins,
            monsters: null,
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
            .from("pem_mon_submissions")
            .upsert(payload, { onConflict: "class_id,student_key" });

        if (error) {
            console.error("[PemMon] uploadSubmission error", error);
            alert("출전 데이터를 저장하는 중 오류가 발생했어요.");
            return;
        }

        alert("출전 데이터가 서버에 저장되었어요! (선생님/친구가 볼 수 있어요)");
    };

    /* ───────────────────────
       PVP: 상대 목록
    ─────────────────────── */
    const fetchOpponents = async () => {
        if (!hasKey) return;
        setLoadingOpponents(true);
        const { data, error } = await supabase
            .from("pem_mon_submissions")
            .select("*")
            .eq("class_id", classId!)
            .neq("student_key", studentId!);

        setLoadingOpponents(false);

        if (error) {
            console.error("[PemMon] fetchOpponents error", error);
            alert("친구 목록을 불러오는 중 오류가 발생했어요.");
            return;
        }
        setOpponents((data || []) as SubmissionRow[]);
    };

    /* ───────────────────────
       PVP: 배틀 시뮬
    ─────────────────────── */
    const startPvpBattle = (enemy: SubmissionRow) => {
        if (!partner) return;

        setPvpEnemy(enemy);
        setPvpResult("fighting");
        setPvpLog([`VS ${enemy.trainer_name}의 포켓몬! 전투 시작!`]);

        let myHp = partner.maxHp;
        let enemyHp = enemy.partner_stats.maxHp;

        const myAtk = partner.species.atk;
        const myDef = partner.species.def;
        const enemyAtk = enemy.partner_stats.atk;
        const enemyDef = enemy.partner_stats.def;

        const log: string[] = [];

        let turn = 0;
        while (myHp > 0 && enemyHp > 0 && turn < 50) {
            const attackerIsMe = turn % 2 === 0;

            if (attackerIsMe) {
                const base = myAtk - enemyDef * 0.3;
                const dmg = Math.max(1, Math.floor(base + Math.random() * 8));
                enemyHp -= dmg;
                log.push(
                    `내 포켓몬의 공격! ${dmg} 데미지! (상대 HP ${Math.max(
                        enemyHp,
                        0,
                    )})`,
                );
            } else {
                const base = enemyAtk - myDef * 0.3;
                const dmg = Math.max(1, Math.floor(base + Math.random() * 8));
                myHp -= dmg;
                log.push(
                    `상대 포켓몬의 공격! ${dmg} 데미지! (내 HP ${Math.max(
                        myHp,
                        0,
                    )})`,
                );
            }

            turn += 1;
        }

        const win = myHp > enemyHp;
        if (win) {
            log.push("내 포켓몬 승리!");
            setPvpResult("win");
            setCoins((c) => c + 10);
            gainExp(20);
        } else {
            log.push("상대 포켓몬 승리...");
            setPvpResult("lose");
            gainExp(5);
        }

        setPvpLog(log.slice(-6));
    };

    /* ───────────────────────
       훈련(퀴즈) 관련
    ─────────────────────── */
    const startTraining = () => {
        if (!pack?.id) {
            alert(
                "이 방에는 아직 퀴즈팩이 연결되어 있지 않아서 훈련을 할 수 없어요.",
            );
            return;
        }
        const mcQuestions = questions.filter(
            (q) =>
                Array.isArray(q.options) &&
                q.options.length > 0 &&
                q.answer_index !== null &&
                q.answer_index >= 0 &&
                q.answer_index < q.options.length,
        );
        if (mcQuestions.length === 0) {
            alert("이 퀴즈팩에는 선택형 문제 데이터가 없어요.");
            return;
        }
        const shuffled = [...mcQuestions].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(5, shuffled.length));

        setTraining({
            phase: "quiz",
            questions: selected,
            index: 0,
            correctCount: 0,
            selectedIndex: null,
            isAnswered: false,
            isCorrect: null,
        });
    };

    const handleSelectOption = (optionIndex: number) => {
        if (training.phase !== "quiz") return;
        if (training.isAnswered) return;

        const current = training.questions[training.index];
        const isCorrect = current.answer_index === optionIndex;

        setTraining({
            ...training,
            selectedIndex: optionIndex,
            isAnswered: true,
            isCorrect,
            correctCount: training.correctCount + (isCorrect ? 1 : 0),
        });
    };

    const goNextQuestion = () => {
        if (training.phase !== "quiz") return;
        const nextIndex = training.index + 1;
        if (nextIndex >= training.questions.length) {
            const total = training.questions.length;
            const correct = training.correctCount;
            const expGain = correct * 10;
            const coinGain = correct * 2;

            if (expGain > 0) gainExp(expGain);
            if (coinGain > 0) setCoins((c) => c + coinGain);

            void recordTrainingStats(total, correct);

            setTraining({
                phase: "result",
                total,
                correct,
                expGain,
                coinGain,
            });
        } else {
            setTraining({
                ...training,
                index: nextIndex,
                selectedIndex: null,
                isAnswered: false,
                isCorrect: null,
            });
        }
    };

    const closeTraining = () => {
        setTraining({ phase: "idle" });
    };

    /* ───────────────────────
       View 분기
    ─────────────────────── */
    if (view === "intro") {
        return (
            <IntroView
                trainerName={trainerName}
                onChangeTrainerName={setTrainerName}
                onSelectStarter={(species) => {
                    if (!trainerName.trim()) {
                        alert("먼저 트레이너 이름을 입력해 주세요.");
                        return;
                    }
                    setPartner({
                        species,
                        level: 1,
                        exp: 0,
                        maxHp: species.maxHp,
                    });
                    setView("lobby");
                }}
            />
        );
    }

    if (view === "lobby" && partner) {
        return (
            <LobbyView
                trainerName={trainerName}
                partner={partner}
                coins={coins}
                pack={pack}
                questionsCount={questions.length}
                training={training}
                onUploadSubmission={uploadSubmission}
                onStartTraining={startTraining}
                onSelectOption={handleSelectOption}
                onNextQuestion={goNextQuestion}
                onCloseTraining={closeTraining}
                onStartExplore={() => {
                    const encounter = pickRandomEncounter();
                    if (!encounter) {
                        alert("아직 탐험에서 만날 포켓몬이 없어요.");
                        return;
                    }

                    // 일단은 발견 메시지 + 약간의 보상만 (나중에 포획/배틀 연결)
                    alert(
                        `탐험 성공! ${encounter.name} (키 ${
                            (encounter.height ?? 10) / 10
                        }m)를 발견했어요!`,
                    );
                    setCoins((c) => c + 2);
                }}
                onStartChallenge={() => {
                    gainExp(10);
                    setCoins((c) => c + 3);
                    alert("임시: 도전 승리! 경험치 +10, 코인 +3");
                }}
                onGoPvp={() => {
                    setView("pvp");
                    fetchOpponents();
                }}
                onGoDex={() => {
                    setView("dex");
                }}
            />
        );
    }


    if (view === "pvp" && partner) {
        return (
            <PvpView
                classId={classId}
                coins={coins}
                partner={partner}
                opponents={opponents}
                loadingOpponents={loadingOpponents}
                pvpEnemy={pvpEnemy}
                pvpLog={pvpLog}
                pvpResult={pvpResult}
                onBackToLobby={() => setView("lobby")}
                onRefreshOpponents={fetchOpponents}
                onStartBattle={startPvpBattle}
            />
        );
    }

    if (view === "dex") {
        return <DexView onBackToLobby={() => setView("lobby")} />;
    }


    return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 text-sm">
            초기화 오류가 발생했어요. 새로고침 후 다시 시도해 주세요.
        </div>
    );
}
