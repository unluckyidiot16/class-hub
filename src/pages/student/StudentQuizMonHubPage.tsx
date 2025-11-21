// src/pages/student/StudentQuizMonHubPage.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { ensurePlayStudentKey } from "../../utils/playStudentKey";
import { useQuizmonProfile } from "../../games/quizmon/useQuizmonProfile";
import { useQuizmonCollection } from "../../games/quizmon/useQuizmonCollection";
import { StarterSelectPanel } from "../../games/quizmon/StarterSelectPanel";
import {
    getMonsterSprite,
    getTrainerSprite,
} from "../../games/quizmon/assets";
import { QuizMonBattleSection } from "../../games/quizmon/QuizMonBattleSection";
import type {
    QuizPackJsonV1,
    QuizPackQuestionV1,
} from "../../types/quizPackJson";
import type {
    QuizPackRow,
    QuizQuestionRow,
} from "./StudentPlayPackPage";

type TabKey = "battle" | "gacha" | "collection" | "missions";

const LEVEL_CAP = 10;
const expNeededForLevel = (level: number) => 5 * level;

export default function StudentQuizMonHubPage() {
    const [activeTab, setActiveTab] = useState<TabKey>("battle");

    // ✅ StudentPlayPackPage와 같은 studentKey 재사용
    const studentKey = ensurePlayStudentKey();

    // --- 프로필 / 컬렉션 ---

    const {
        profile,
        loading: profileLoading,
        chooseStarter,
    } = useQuizmonProfile({
        classId: null,      // 연습 허브에서는 반 정보가 없으므로 null
        studentKey,
    });

    const {
        monsters = [],
        loading: collLoading,
    } = useQuizmonCollection({ profileId: profile?.id ?? null });

    // --- 연습용 퀴즈팩 목록/선택 상태 ---

    const [packs, setPacks] = useState<QuizPackRow[]>([]);
    const [packsLoading, setPacksLoading] = useState(false);
    const [packsError, setPacksError] = useState<string | null>(null);

    const [subjectFilter, setSubjectFilter] = useState<string>("all");
    const [gradeFilter, setGradeFilter] = useState<string>("all");

    const [selectedPack, setSelectedPack] = useState<QuizPackRow | null>(null);

    const [quizpack, setQuizpack] = useState<QuizPackJsonV1 | null>(null);
    const [quizLoading, setQuizLoading] = useState(false);
    const [quizError, setQuizError] = useState<string | null>(null);

    // 🔹 1) 연습용 퀴즈팩 목록 로딩
    useEffect(() => {
        let cancelled = false;

        const loadPacks = async () => {
            setPacksLoading(true);
            setPacksError(null);

            const { data, error } = await supabase
                .from("quiz_packs")
                .select("id, owner_id, title, subject, grade")
                .order("created_at", { ascending: false });

            if (cancelled) return;

            if (error) {
                console.error("[QuizMonHub] load quiz_packs error", error);
                setPacksError(
                    "연습용 퀴즈팩을 불러오는 중 오류가 발생했습니다.",
                );
                setPacks([]);
                setPacksLoading(false);
                return;
            }

            setPacks((data ?? []) as QuizPackRow[]);
            setPacksLoading(false);
        };

        void loadPacks();

        return () => {
            cancelled = true;
        };
    }, []);

    // 🔹 2) subject / grade 필터용 옵션
    const subjectOptions = useMemo(() => {
        const s = new Set<string>();
        for (const p of packs) {
            if (p.subject) s.add(p.subject);
        }
        return Array.from(s).sort();
    }, [packs]);

    const gradeOptions = useMemo(() => {
        const s = new Set<string>();
        for (const p of packs) {
            if (p.grade) s.add(p.grade);
        }
        return Array.from(s).sort();
    }, [packs]);

    const filteredPacks = useMemo(
        () =>
            packs.filter((p) => {
                if (subjectFilter !== "all" && p.subject !== subjectFilter) {
                    return false;
                }
                if (gradeFilter !== "all" && p.grade !== gradeFilter) {
                    return false;
                }
                return true;
            }),
        [packs, subjectFilter, gradeFilter],
    );

    // 🔹 3) 특정 퀴즈팩 선택 → quiz_questions 로딩 → QuizPackJsonV1 변환
    const handleChoosePack = async (pack: QuizPackRow) => {
        setSelectedPack(pack);
        setQuizpack(null);
        setQuizError(null);
        setQuizLoading(true);

        try {
            const { data, error } = await supabase
                .from("quiz_questions")
                .select(
                    "id, pack_id, index_in_pack, prompt, options, answer_index",
                )
                .eq("pack_id", pack.id)
                .order("index_in_pack", { ascending: true });

            if (error) {
                console.error(
                    "[QuizMonHub] load quiz_questions error",
                    error,
                );
                setQuizError("문항을 불러오는 중 오류가 발생했습니다.");
                setQuizLoading(false);
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
                answerIndex:
                    typeof row.answer_index === "number"
                        ? row.answer_index
                        : 0,
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
            setQuizLoading(false);
        } catch (e) {
            console.error("[QuizMonHub] handleChoosePack error", e);
            setQuizError("문항을 불러오는 중 알 수 없는 오류가 발생했습니다.");
            setQuizLoading(false);
        }
    };

    // --- 프로필 로딩/가드 ---

    if (profileLoading) {
        return (
            <section className="page student-quizmon">
                <h1>퀴즈몬 허브</h1>
                <p className="page-desc">프로필을 불러오는 중입니다…</p>
            </section>
        );
    }

    if (!profile) {
        return (
            <section className="page student-quizmon">
                <h1>퀴즈몬 허브</h1>
                <p className="page-desc">
                    아직 퀴즈몬 프로필이 생성되지 않았습니다.
                    <br />
                    수업 중 퀴즈몬이 실행된 후 다시 와 주세요.
                </p>
            </section>
        );
    }

    if (!profile.starter_chosen) {
        return (
            <section className="page student-quizmon">
                <h1>퀴즈몬 허브</h1>
                <p className="page-desc">
                    첫 번째 파트너 퀴즈몬을 선택해 주세요.
                    <br />
                    첫 번째 파트너를 선택하면 퀴즈로 얻은 보상으로
                    퀴즈몬을 키울 수 있어요.
                </p>
                <div className="card">
                    <StarterSelectPanel
                        onChooseStarter={(speciesId) =>
                            Promise.resolve(chooseStarter(speciesId))
                        }
                    />
                </div>
            </section>
        );
    }

    // --- 프로필/파트너/컬렉션 정보 계산 ---

    const partner = profile.partner ?? null;
    const totalMonsters = monsters.length;

    // 🔹 재화(코인) 읽기
    const coins = (profile as any).coins ?? 0;
    
    // trainer_skin 컬럼은 타입에 없으므로 any 캐스팅으로 안전하게 접근
    const trainerSkinKey =
        (profile as any).trainer_skin ??
        (profile as any).trainerSkin ??
        "default";
    const trainerSpriteUrl = getTrainerSprite(trainerSkinKey);

    // partner JSON은 v1 기준으로 speciesId(camelCase)를 쓰지만,
    // 과거/테스트 데이터에서는 species_id(snake_case)일 수도 있으니 둘 다 지원
    const partnerSpeciesId: string | null =
        partner
            ? ((partner as any).speciesId as string | undefined) ??
            ((partner as any).species_id as string | undefined) ??
            null
            : null;

    const partnerSpriteUrl = partnerSpeciesId
        ? getMonsterSprite(partnerSpeciesId)
        : null;

    // 표시용 파트너 이름 (닉네임 → name → speciesId → 기본 문자열)
    const partnerDisplayName =
        (partner
            ? ((partner as any).nickname as string | undefined) ??
            ((partner as any).name as string | undefined)
            : undefined) ??
        partnerSpeciesId ??
        "파트너 퀴즈몬";

    let expNeeded = 0;
    let expRatio = 0;

    if (partner) {
        const level = partner.level ?? 1;
        const exp = partner.exp ?? 0;
        expNeeded = expNeededForLevel(level);
        expRatio = Math.max(
            0,
            Math.min(1, expNeeded > 0 ? exp / expNeeded : 0),
        );
    }

    // --- 퀴즈팩 선택 UI ---

    const renderPackSelector = () => {
        return (
            <div className="card">
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "0.75rem",
                        marginBottom: "0.5rem",
                    }}
                >
                    <div>
                        <h3 style={{ margin: 0, fontSize: 16 }}>
                            연습용 퀴즈팩 선택
                        </h3>
                        <p
                            style={{
                                margin: 0,
                                marginTop: 4,
                                fontSize: 13,
                                color: "#9ca3af",
                            }}
                        >
                            과목/학년을 골라서 연습할 퀴즈팩을 선택하세요.
                        </p>
                    </div>
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                        marginBottom: "0.75rem",
                    }}
                >
                    <label style={{ fontSize: 13 }}>
                        과목{" "}
                        <select
                            value={subjectFilter}
                            onChange={(e) => setSubjectFilter(e.target.value)}
                        >
                            <option value="all">전체</option>
                            {subjectOptions.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label style={{ fontSize: 13 }}>
                        학년{" "}
                        <select
                            value={gradeFilter}
                            onChange={(e) => setGradeFilter(e.target.value)}
                        >
                            <option value="all">전체</option>
                            {gradeOptions.map((g) => (
                                <option key={g} value={g}>
                                    {g}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                {packsLoading ? (
                    <p style={{ fontSize: 13 }}>퀴즈팩을 불러오는 중…</p>
                ) : packsError ? (
                    <p
                        className="form-message error"
                        style={{ marginTop: "0.25rem" }}
                    >
                        {packsError}
                    </p>
                ) : filteredPacks.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#9ca3af" }}>
                        조건에 맞는 퀴즈팩이 없습니다.
                    </p>
                ) : (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fill, minmax(200px, 1fr))",
                            gap: "0.5rem",
                        }}
                    >
                        {filteredPacks.map((p) => {
                            const isActive =
                                selectedPack && selectedPack.id === p.id;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => void handleChoosePack(p)}
                                    className="card"
                                    style={{
                                        textAlign: "left",
                                        padding: "0.5rem 0.75rem",
                                        borderRadius: 8,
                                        border: isActive
                                            ? "1px solid #22c55e"
                                            : "1px solid #1f2937",
                                        backgroundColor: isActive
                                            ? "#022c22"
                                            : "#020617",
                                        cursor: "pointer",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: "#e5e7eb",
                                            marginBottom: 2,
                                        }}
                                    >
                                        {p.title}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: "#9ca3af",
                                        }}
                                    >
                                        {p.subject ?? "과목 없음"} ·{" "}
                                        {p.grade ?? "학년 없음"}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    // --- 탭 렌더링 ---

    const renderActiveTab = () => {
        if (activeTab === "battle") {
            return (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                    }}
                >
                    {renderPackSelector()}

                    {selectedPack ? (
                        <QuizMonBattleSection
                            mode="practice"
                            title="연습 배틀"
                            quizpack={quizpack}
                            quizLoading={quizLoading}
                            errorMsg={quizError}
                            profileId={profile?.id ?? null}
                        />
                    ) : (
                        <p
                            style={{
                                fontSize: 13,
                                color: "#9ca3af",
                            }}
                        >
                            위에서 연습할 퀴즈팩을 선택하면 아래에 퀴즈몬 연습
                            배틀이 열립니다.
                        </p>
                    )}
                </div>
            );
        }

        if (activeTab === "gacha") {
            return (
                <div style={{ paddingTop: "0.5rem" }}>
                    <p>
                        소환 기능은 곧 추가될 예정입니다.
                        <br />
                        수업에서 얻은 보상으로 퀴즈몬을 소환할 수 있도록
                        준비 중이에요.
                    </p>
                </div>
            );
        }

        if (activeTab === "collection") {
            return (
                <div style={{ paddingTop: "0.5rem" }}>
                    <h3 style={{ marginTop: 0 }}>내 퀴즈몬</h3>
                    {collLoading ? (
                        <p>컬렉션을 불러오는 중입니다…</p>
                    ) : totalMonsters === 0 ? (
                        <p>
                            아직 획득한 퀴즈몬이 없습니다.
                            <br />
                            수업에서 보상을 모은 뒤 소환을 통해 퀴즈몬을
                            모아보세요.
                        </p>
                    ) : (
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "repeat(auto-fill, minmax(220px, 1fr))",
                                gap: "0.75rem",
                            }}
                        >
                            {monsters.map((m) => {
                                const spriteUrl = getMonsterSprite(
                                    (m.species_id as string | undefined) ??
                                    null,
                                );

                                // nickname은 아직 타입에 없으므로 any로 안전하게 읽기
                                const nickname =
                                    (m as any).nickname as
                                        | string
                                        | undefined;

                                const displayName =
                                    nickname ??
                                    (m.species_id as string | undefined) ??
                                    "이름 없는 퀴즈몬";

                                return (
                                    <div
                                        key={m.id}
                                        className="card"
                                        style={{
                                            padding: "0.5rem",
                                            display: "flex",
                                            gap: "0.5rem",
                                            alignItems: "center",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 8,
                                                backgroundColor: "#020617",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                overflow: "hidden",
                                            }}
                                        >
                                            {spriteUrl ? (
                                                <img
                                                    src={spriteUrl}
                                                    alt={displayName}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit:
                                                            "contain",
                                                    }}
                                                />
                                            ) : (
                                                <div
                                                    style={{
                                                        width: 32,
                                                        height: 32,
                                                        borderRadius:
                                                            "999px",
                                                        backgroundColor:
                                                            "#111827",
                                                    }}
                                                />
                                            )}
                                        </div>
                                        <div>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    color: "#9ca3af",
                                                }}
                                            >
                                                {m.species_id}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 14,
                                                    fontWeight: 600,
                                                    color: "#e5e7eb",
                                                }}
                                            >
                                                {displayName}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    color: "#9ca3af",
                                                    marginTop: 2,
                                                }}
                                            >
                                                Lv. {m.level ?? 1}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            );
        }

        if (activeTab === "missions") {
            return (
                <div style={{ paddingTop: "0.5rem" }}>
                    <h3 style={{ marginTop: 0 }}>일일 미션</h3>
                    <p>
                        아직 미션 기능은 준비 중입니다.
                        <br />
                        나중에는 “퀴즈 10문제 풀기”, “연습 배틀 1회 클리어”
                        같은 미션을 클리어하면 보상을 주도록 확장할
                        예정입니다.
                    </p>
                </div>
            );
        }

        return null;
    };

    // --- 메인 렌더 ---

    return (
        <section className="page student-quizmon">
            <h1>퀴즈몬 허브</h1>
            <p className="page-desc">
                수업에서 얻은 보상으로 퀴즈몬을 키우고, 다양한 퀴즈팩으로
                연습해 보세요.
            </p>

            {/* 상단 트레이너 / 파트너 요약 */}
            <section
                className="card"
                style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: "1rem",
                    alignItems: "center",
                    marginBottom: "1rem",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "row",
                        gap: "0.75rem",
                        alignItems: "center",
                        flex: 1,
                    }}
                >
                    <div
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 999,
                            backgroundColor: "#020617",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {trainerSpriteUrl ? (
                            <img
                                src={trainerSpriteUrl}
                                alt="트레이너"
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                }}
                            />
                        ) : (
                            <div
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 999,
                                    backgroundColor: "#111827",
                                }}
                            />
                        )}
                    </div>
                    <div>
                        <div
                            style={{
                                fontSize: 13,
                                color: "#9ca3af",
                            }}
                        >
                            트레이너
                        </div>
                        <div
                            style={{
                                fontSize: 18,
                                fontWeight: 600,
                            }}
                        >
                            {((profile as any).nickname ??
                                (profile as any).display_name ??
                                (profile as any).name ??
                                "학생 트레이너")}
                        </div>
                        <div
                            style={{
                                fontSize: 12,
                                color: "#9ca3af",
                                marginTop: 2,
                            }}
                        >
                            보유 퀴즈몬: {totalMonsters}마리
                        </div>
                        <div
                            style={{
                                fontSize: 12,
                                color: "#9ca3af",
                                marginTop: 2,
                            }}
                        >
                            보유 코인: {coins.toLocaleString("ko-KR")}개
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        width: 1,
                        alignSelf: "stretch",
                        background:
                            "linear-gradient(to bottom, transparent, #1f2937, transparent)",
                    }}
                />

                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "row",
                        gap: "0.75rem",
                        alignItems: "center",
                    }}
                >
                    <div
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 16,
                            backgroundColor: "#020617",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {partnerSpriteUrl ? (
                            <img
                                src={partnerSpriteUrl}
                                alt={partnerDisplayName}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain",
                                }}
                            />
                        ) : (
                            <div
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 999,
                                    backgroundColor: "#111827",
                                }}
                            />
                        )}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div
                            style={{
                                fontSize: 13,
                                color: "#9ca3af",
                            }}
                        >
                            파트너
                        </div>
                        <div
                            style={{
                                fontSize: 16,
                                fontWeight: 600,
                                color: "#e5e7eb",
                            }}
                        >
                            {partnerDisplayName}
                        </div>
                        <div
                            style={{
                                fontSize: 12,
                                color: "#9ca3af",
                                marginTop: 2,
                            }}
                        >
                            Lv. {partner?.level ?? 1}
                        </div>
                        <div
                            style={{
                                marginTop: 4,
                                backgroundColor: "#111827",
                                borderRadius: 999,
                                overflow: "hidden",
                                height: 8,
                                width: "100%",
                            }}
                        >
                            <div
                                style={{
                                    width: `${expRatio * 100}%`,
                                    height: "100%",
                                    backgroundColor: "#22c55e",
                                    transition: "width 0.3s ease",
                                }}
                            />
                        </div>
                        {partner && partner.level >= LEVEL_CAP ? (
                            <div
                                style={{
                                    fontSize: 11,
                                    marginTop: 2,
                                    color: "#facc15",
                                }}
                            >
                                최대 레벨에 도달했습니다!
                            </div>
                        ) : (
                            <div
                                style={{
                                    fontSize: 11,
                                    marginTop: 2,
                                    color: "#9ca3af",
                                }}
                            >
                                EXP {partner?.exp ?? 0} / {expNeeded}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* 탭 + 내용 */}
            <section className="card">
                <div
                    style={{
                        display: "flex",
                        gap: "0.5rem",
                        marginBottom: "0.75rem",
                    }}
                >
                    <button
                        type="button"
                        className={
                            activeTab === "battle"
                                ? "tab-btn active"
                                : "tab-btn"
                        }
                        onClick={() => setActiveTab("battle")}
                    >
                        연습 배틀
                    </button>
                    <button
                        type="button"
                        className={
                            activeTab === "gacha"
                                ? "tab-btn active"
                                : "tab-btn"
                        }
                        onClick={() => setActiveTab("gacha")}
                    >
                        소환
                    </button>
                    <button
                        type="button"
                        className={
                            activeTab === "collection"
                                ? "tab-btn active"
                                : "tab-btn"
                        }
                        onClick={() => setActiveTab("collection")}
                    >
                        도감/컬렉션
                    </button>
                    <button
                        type="button"
                        className={
                            activeTab === "missions"
                                ? "tab-btn active"
                                : "tab-btn"
                        }
                        onClick={() => setActiveTab("missions")}
                    >
                        미션
                    </button>
                </div>

                {renderActiveTab()}
            </section>
        </section>
    );
}
