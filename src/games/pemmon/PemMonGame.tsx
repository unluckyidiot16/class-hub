// src/games/pemmon/PemMonGame.tsx

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../../lib/supabaseClient";

type PemMonGameProps = {
    classId: string | null;
    roomId: string;
    /** StudentRoomPage → StudentGamePanel → 여기로 전달되는 학생 식별자 */
    studentId: string | null;
};

// 간단한 포켓몬 스펙 (나중에 8~9세대 추가 가능)
type Species = {
    id: number;
    name: string;
    maxHp: number;
    atk: number;
    def: number;
};

// 스타팅 3종만 일단 사용
const STARTERS: Species[] = [
    { id: 1, name: "이상해씨", maxHp: 45, atk: 49, def: 49 },
    { id: 4, name: "파이리", maxHp: 39, atk: 52, def: 43 },
    { id: 7, name: "꼬부기", maxHp: 44, atk: 48, def: 65 },
];

type PartnerState = {
    species: Species;
    level: number;
    exp: number;
    maxHp: number;
};

type SubmissionRow = {
    id: string;
    class_id: string;
    student_key: string;
    trainer_name: string;
    partner_species: number;
    partner_level: number;
    partner_stats: {
        maxHp: number;
        atk: number;
        def: number;
    };
    coins: number;
    updated_at: string;
};

type ViewState = "intro" | "lobby" | "pvp";

export function PemMonGame({ classId, roomId, studentId }: PemMonGameProps) {
    const [view, setView] = useState<ViewState>("intro");
    const [trainerName, setTrainerName] = useState("");
    const [partner, setPartner] = useState<PartnerState | null>(null);
    const [coins, setCoins] = useState(0);

    // PVP 상대 목록
    const [opponents, setOpponents] = useState<SubmissionRow[]>([]);
    const [loadingOpponents, setLoadingOpponents] = useState(false);

    // PVP 배틀 상태
    const [pvpEnemy, setPvpEnemy] = useState<SubmissionRow | null>(null);
    const [pvpLog, setPvpLog] = useState<string[]>([]);
    const [pvpResult, setPvpResult] = useState<"idle" | "fighting" | "win" | "lose">("idle");

    // 로컬 세이브/로드
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

    const hasKey = useMemo(
        () => !!classId && !!studentId,
        [classId, studentId],
    );

    /**
     * 경험치/레벨업 로직 (간단 버전)
     */
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

    /**
     * 출전 데이터 업로드 (upsert)
     * - 같은 class_id + student_key 조합이면 항상 덮어쓰기 → 중복 업로드 방지
     */
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
            student_key: studentId!, // StudentRoomPage에서 만든 키
            trainer_name: trainerName.trim(),
            partner_species: partner.species.id,
            partner_level: partner.level,
            partner_stats: {
                maxHp: partner.maxHp,
                atk: partner.species.atk,
                def: partner.species.def,
            },
            coins,
            monsters: null, // TODO: 나중에 보유 몬스터 전체를 넣고 싶으면 여기에
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

    /**
     * 같은 반 친구들의 출전 데이터 목록 불러오기
     */
    const fetchOpponents = async () => {
        if (!hasKey) return;
        setLoadingOpponents(true);
        const { data, error } = await supabase
            .from("pem_mon_submissions")
            .select("*")
            .eq("class_id", classId!)
            .neq("student_key", studentId!); // 나 자신은 제외

        setLoadingOpponents(false);

        if (error) {
            console.error("[PemMon] fetchOpponents error", error);
            alert("친구 목록을 불러오는 중 오류가 발생했어요.");
            return;
        }
        setOpponents((data || []) as SubmissionRow[]);
    };

    /**
     * 간단 PVP 배틀 시뮬레이션
     * - 서버에는 아무것도 안 쓰고, 클라이언트에서만 계산
     */
    const startPvpBattle = (enemy: SubmissionRow) => {
        if (!partner) return;

        setPvpEnemy(enemy);
        setPvpResult("fighting");
        setPvpLog([`VS ${enemy.trainer_name}의 포켓몬! 전투 시작!`]);

        // 간단 턴 배틀 (동기 시뮬레이션)
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

        setPvpLog(log.slice(-6)); // 최근 6줄만
    };

    /**
     * 화면 렌더링
     */

    // 0) 입장 / 스타팅 선택 화면
    if (view === "intro") {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-b from-blue-100 to-white">
                <h1 className="text-2xl font-bold mb-4 text-blue-800">
                    포켓몬 맞춤법 탐험대
                </h1>
                <input
                    className="w-full max-w-xs p-3 border rounded-xl mb-4"
                    placeholder="트레이너 이름"
                    value={trainerName}
                    onChange={(e) => setTrainerName(e.target.value)}
                />
                <p className="mb-2 text-gray-600 text-sm">
                    파트너 포켓몬을 선택하세요
                </p>
                <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-4">
                    {STARTERS.map((s) => (
                        <button
                            key={s.id}
                            className="bg-white rounded-xl shadow p-2 flex flex-col items-center hover:bg-blue-50"
                            onClick={() => {
                                if (!trainerName.trim()) {
                                    alert(
                                        "먼저 트레이너 이름을 입력해 주세요.",
                                    );
                                    return;
                                }
                                setPartner({
                                    species: s,
                                    level: 1,
                                    exp: 0,
                                    maxHp: s.maxHp,
                                });
                                setView("lobby");
                            }}
                        >
                            <div className="w-12 h-12 bg-gray-100 rounded-full mb-1 flex items-center justify-center text-xl">
                                {s.id === 1
                                    ? "🌱"
                                    : s.id === 4
                                        ? "🔥"
                                        : "💧"}
                            </div>
                            <div className="text-xs font-bold">{s.name}</div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // 1) 로비 화면 (메인 메뉴)
    if (view === "lobby" && partner) {
        return (
            <div className="flex flex-col h-full bg-gray-50">
                <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
                    <div>
                        <div className="text-xs opacity-80">트레이너</div>
                        <div className="text-lg font-bold">
                            {trainerName || "이름 없음"}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs opacity-80">코인</div>
                        <div className="text-lg font-bold">🪙 {coins}</div>
                    </div>
                </div>

                <div className="p-4 bg-white border-b">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs text-gray-400">
                                파트너
                            </div>
                            <div className="font-bold text-gray-800">
                                {partner.species.name} (Lv.{partner.level})
                            </div>
                            <div className="text-xs text-gray-500">
                                HP {partner.maxHp} / ATK {partner.species.atk} /
                                DEF {partner.species.def}
                            </div>
                        </div>
                        <button
                            className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs flex items-center gap-1"
                            onClick={uploadSubmission}
                        >
                            <span>⬆️</span>
                            출전 데이터 업로드
                        </button>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-2 gap-3 p-4">
                    <MenuCard
                        icon="📖"
                        title="훈련"
                        desc="퀴즈로 경험치"
                        onClick={() => {
                            // TODO: PEM 국어/수학 퀴즈 로직 연결
                            gainExp(20);
                            alert("임시: 훈련 완료! 경험치 +20");
                        }}
                    />
                    <MenuCard
                        icon="🗺️"
                        title="탐험"
                        desc="포켓몬 발견"
                        onClick={() => {
                            // TODO: 탐험/포획 로직 연결
                            setCoins((c) => c + 5);
                            alert("임시: 탐험 완료! 코인 +5");
                        }}
                    />
                    <MenuCard
                        icon="⚔️"
                        title="도전"
                        desc="PVE 배틀"
                        onClick={() => {
                            // TODO: PVE 배틀 화면 연결
                            gainExp(10);
                            setCoins((c) => c + 3);
                            alert("임시: 도전 승리! 경험치 +10, 코인 +3");
                        }}
                    />
                    <MenuCard
                        icon="🛒"
                        title="상점"
                        desc="아이템 구매"
                        onClick={() => {
                            // TODO: 상점 UI 연결
                            alert("상점은 이후 업데이트 예정!");
                        }}
                    />
                    <MenuCard
                        icon="👥"
                        title="대전 (PVP)"
                        desc="친구와 대결"
                        onClick={() => {
                            setView("pvp");
                            fetchOpponents();
                        }}
                    />
                </div>
            </div>
        );
    }

    // 2) PVP 화면
    if (view === "pvp" && partner) {
        return (
            <div className="flex flex-col h-full bg-slate-900 text-white">
                <div className="p-3 flex items-center justify-between border-b border-slate-700">
                    <button
                        className="px-3 py-1 bg-slate-700 rounded-full text-xs"
                        onClick={() => setView("lobby")}
                    >
                        ← 돌아가기
                    </button>
                    <div className="text-xs text-slate-300">
                        {classId
                            ? `CLASS: ${classId.slice(0, 4)}...`
                            : "CLASS: -"}
                    </div>
                </div>

                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <div>
                        <div className="text-xs text-slate-400">내 포켓몬</div>
                        <div className="font-bold">
                            {partner.species.name} (Lv.{partner.level})
                        </div>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                        🪙 {coins} 코인
                    </div>
                </div>

                {/* 상대 선택 영역 */}
                <div className="flex-1 flex flex-col md:flex-row">
                    <div className="flex-1 p-4 border-r border-slate-800 overflow-auto">
                        <div className="flex items-center justify-between mb-2">
                            <div className="font-bold text-sm">
                                출전한 친구들
                            </div>
                            <button
                                className="text-xs px-2 py-1 bg-slate-700 rounded-full"
                                onClick={fetchOpponents}
                                disabled={loadingOpponents}
                            >
                                새로고침
                            </button>
                        </div>
                        {loadingOpponents && (
                            <div className="text-xs text-slate-400">
                                불러오는 중...
                            </div>
                        )}
                        {opponents.length === 0 && !loadingOpponents && (
                            <div className="text-xs text-slate-500">
                                아직 출전한 친구가 없어요. (친구들에게 업로드
                                버튼을 눌러달라고 해보세요!)
                            </div>
                        )}
                        <div className="mt-2 space-y-2">
                            {opponents.map((o) => (
                                <button
                                    key={o.id}
                                    className={`w-full text-left p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs ${
                                        pvpEnemy?.id === o.id
                                            ? "ring-2 ring-yellow-400"
                                            : ""
                                    }`}
                                    onClick={() => startPvpBattle(o)}
                                >
                                    <div className="font-bold text-sm">
                                        {o.trainer_name} 님의 포켓몬
                                    </div>
                                    <div className="text-slate-300">
                                        종:{o.partner_species} / Lv.
                                        {o.partner_level}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                        HP {o.partner_stats.maxHp} · ATK{" "}
                                        {o.partner_stats.atk} · DEF{" "}
                                        {o.partner_stats.def}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1">
                                        업데이트:{" "}
                                        {new Date(
                                            o.updated_at,
                                        ).toLocaleTimeString()}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 배틀 로그 영역 */}
                    <div className="flex-1 p-4 flex flex-col">
                        <div className="font-bold text-sm mb-2">
                            배틀 로그
                        </div>
                        <div className="flex-1 bg-black/40 rounded-xl p-3 text-xs overflow-auto border border-slate-700">
                            {pvpLog.length === 0 && (
                                <div className="text-slate-500">
                                    왼쪽에서 대전할 친구를 선택하세요.
                                </div>
                            )}
                            {pvpLog.map((l, idx) => (
                                <div key={idx} className="mb-1">
                                    {l}
                                </div>
                            ))}
                        </div>

                        {pvpResult !== "idle" && (
                            <div className="mt-3 text-center">
                                {pvpResult === "win" ? (
                                    <div className="text-yellow-300 font-bold">
                                        승리! 경험치 +20 / 코인 +10
                                    </div>
                                ) : (
                                    <div className="text-red-300 font-bold">
                                        패배... 경험치 +5
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // 예외적으로 partner가 null인데 lobby/pvp로 온 경우 방어
    return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 text-sm">
            초기화 오류가 발생했어요. 새로고침 후 다시 시도해 주세요.
        </div>
    );
}

/** 메뉴 카드 작은 컴포넌트 */
function MenuCard(props: {
    icon: ReactNode;
    title: string;
    desc: string;
    onClick: () => void;
}) {
    return (
        <button
            className="bg-white rounded-2xl shadow p-3 flex flex-col justify-between hover:bg-gray-50 active:scale-95 transition"
            onClick={props.onClick}
        >
            <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center mb-2 text-lg">
                {props.icon}
            </div>
            <div>
                <div className="text-sm font-bold">{props.title}</div>
                <div className="text-[11px] text-gray-500">
                    {props.desc}
                </div>
            </div>
        </button>
    );
}
