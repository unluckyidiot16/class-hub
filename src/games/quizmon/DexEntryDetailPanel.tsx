// src/games/quizmon/DexEntryDetailPanel.tsx

import { SpriteAnimation } from "./SpriteAnimation";


export type DexSpeciesStats = {
    hp: number;
    atk: number;
    def: number;
    spAtk?: number;
    spDef?: number;
    spd: number;
};

export type DexMoveInfo = {
    id: string;
    name: string;
    description : string;
    elementLabel: string; // 예: "불꽃", "물", "풀"
    elementColor?: string; // 배지 색 (선택)
    categoryLabel: string; // 예: "물리", "특수", "보조"
    power?: number | null;
    accuracy?: number | null;
    learnMethodLabel: string; // 예: "레벨업", "기술머신", "특수"
    learnAt?: number | null; // 레벨, TM 번호 등
    learnAtLabel?:string | null;
};

export type DexAbilityInfo = {
    id: string;
    name: string;
    description: string;
    rarityLabel: string; // "기본", "희귀" 등
};

export type DexEntryDetailProps = {
    /** 예: "리프테일" */
    name: string;
    /** 예: "#001" 또는 "poke-0001" */
    code: string;
    /** 예: "풀 / 비행" */
    elementLabel: string;
    /** 타입/속성 배지 색 (선택) */
    elementColor?: string;
    /** 도감 일러스트 / 공식 스프라이트 */
    spriteUrl?: string;
    /** 도감 스프라이트 시트 JSON (있으면 애니메이션) */
    spriteJsonUrl?: string;
    /** flavor text / 간단 설명 (선택) */
    flavorText?: string;

    stats: DexSpeciesStats;
    moves: DexMoveInfo[];
    abilities: DexAbilityInfo[];

    /** 이 종을 가장 처음 얻은 날짜 (없으면 null) */
    firstObtainedAt?: string | null;

    /** 닫기/뒤로가기용 콜백 (선택) */
    onClose?: () => void;
};

export function DexEntryDetailPanel(props: DexEntryDetailProps) {
    const {
        name,
        code,
        elementLabel,
        elementColor = "#22c55e",
        spriteUrl,
        spriteJsonUrl,
        flavorText,
        stats,
        moves,
        abilities,
        firstObtainedAt,
        onClose,
    } = props;

    const firstDateLabel =
        firstObtainedAt != null
            ? new Date(firstObtainedAt).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "short",
                day: "numeric",
            })
            : null;

    const statEntries: { key: keyof DexSpeciesStats; label: string }[] = [
        { key: "hp", label: "HP" },
        { key: "atk", label: "공격" },
        { key: "def", label: "방어" },
        { key: "spAtk", label: "특공" },
        { key: "spDef", label: "특방" },
        { key: "spd", label: "스피드" },
    ];

    const maxStatValue = Math.max(
        1,
        ...statEntries
            .map((s) => stats[s.key] ?? 0)
            .filter((v) => typeof v === "number"),
    );

    return (
        <div
            className="card"
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                minHeight: 0,
            }}
        >
            {/* 헤더: 이름 + 타입 + 닫기 버튼 */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: "0.8rem",
                            color: "var(--text-sub)",
                            marginBottom: "0.15rem",
                        }}
                    >
                        {code}
                    </div>
                    <h2
                        style={{
                            margin: 0,
                            fontSize: "1.15rem",
                        }}
                    >
                        {name}
                    </h2>
                    <div
                        style={{
                            marginTop: "0.35rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.4rem",
                        }}
                    >
                        <span
                            style={{
                                fontSize: "0.8rem",
                                padding: "0.1rem 0.45rem",
                                borderRadius: 999,
                                backgroundColor: elementColor,
                                color: "#0b1120",
                                fontWeight: 600,
                            }}
                        >
                            {elementLabel}
                        </span>
                        {firstDateLabel && (
                            <span
                                style={{
                                    fontSize: "0.75rem",
                                    color: "var(--text-sub)",
                                }}
                            >
                                첫 획득: {firstDateLabel}
                            </span>
                        )}
                    </div>
                </div>
                {onClose && (
                    <button
                        type="button"
                        className="secondary-btn"
                        onClick={onClose}
                    >
                        닫기
                    </button>
                )}
            </div>

            {/* 상단: 스프라이트 + 플레버 텍스트 */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(120px, 140px) minmax(0, 1fr)",
                    gap: "0.75rem",
                    alignItems: "stretch",
                }}
            >
                <div
                    style={{
                        width: 160,
                        height: 160,
                        borderRadius: 24,
                        background:
                            "radial-gradient(circle at 30% 20%, rgba(148,163,253,0.45), rgba(15,23,42,0.95))",
                        border: "1px solid rgba(30,64,175,0.7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0.75rem",
                        overflow: "hidden",          // ✅ 추가
                    }}
                >
                    {spriteUrl && spriteJsonUrl ? (
                        <SpriteAnimation
                            key={spriteJsonUrl}          // 종 바뀔 때 리셋
                            jsonUrl={spriteJsonUrl}
                            imageUrlOverride={spriteUrl}
                            fps={12}                     // 전투랑 비슷하게
                            style={{
                                transform: "scale(1.8)",      // 크기 필요하면 숫자만 조절
                                transformOrigin: "bottom center",
                                imageRendering: "pixelated",
                            }}
                        />
                    ) : spriteUrl ? (
                        <div
                            style={{
                                width: 144,
                                height: 144,
                                backgroundImage: `url(${spriteUrl})`,
                                backgroundRepeat: "no-repeat",
                                backgroundPosition: "center",
                                backgroundSize: "350% 350%",
                                imageRendering: "pixelated",
                                borderRadius: 24,
                            }}
                        />
                    ) : (
                        <div
                            style={{
                                fontSize: "0.8rem",
                                color: "var(--text-sub)",
                            }}
                        >
                            도감 이미지 준비 중
                        </div>
                    )}
                </div>

                <div
                    style={{
                        fontSize: "0.85rem",
                        color: "var(--text-sub)",
                        whiteSpace: "pre-wrap",
                    }}
                >
                    {flavorText ?? "아직 설명이 준비되지 않았습니다."}
                </div>
            </div>

            {/* 기본 스탯 */}
            <div>
                <h3
                    style={{
                        fontSize: "0.95rem",
                        marginBottom: "0.35rem",
                    }}
                >
                    기본 스탯
                </h3>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                    }}
                >
                    {statEntries.map(({ key, label }) => {
                        const value = stats[key];
                        if (value == null) return null;

                        const ratio = Math.max(
                            0.05,
                            Math.min(1, value / maxStatValue),
                        );

                        return (
                            <div
                                key={key}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.4rem",
                                    fontSize: "0.8rem",
                                }}
                            >
                                <span
                                    style={{
                                        width: 40,
                                        color: "var(--text-sub)",
                                    }}
                                >
                                    {label}
                                </span>
                                <div
                                    style={{
                                        flex: 1,
                                        height: 8,
                                        borderRadius: 999,
                                        backgroundColor:
                                            "var(--border-subtle)",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${ratio * 100}%`,
                                            height: "100%",
                                            background:
                                                "linear-gradient(90deg,#22c55e,#a3e635)",
                                            transition:
                                                "width 0.25s ease-out",
                                        }}
                                    />
                                </div>
                                <span
                                    style={{
                                        width: 32,
                                        textAlign: "right",
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {value}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 배울 수 있는 기술 리스트 */}
            <div>
                <h3
                    style={{
                        fontSize: "0.95rem",
                        marginBottom: "0.35rem",
                    }}
                >
                    배틀에서 사용하는 기술 / 잠재 기술
                </h3>
                {moves.length === 0 ? (
                    <p className="hint" style={{ fontSize: "0.8rem" }}>
                        아직 등록된 기술 정보가 없습니다.
                    </p>
                ) : (
                    <div
                        style={{
                            maxHeight: 180,
                            overflow: "auto",
                            borderRadius: "0.5rem",
                            border: "1px solid var(--border-subtle)",
                        }}
                    >
                        <table
                            className="simple-table"
                            style={{
                                fontSize: "0.8rem",
                                minWidth: "100%",
                            }}
                        >
                            <thead>
                            <tr>
                                <th>기술</th>
                                <th>속성</th>
                                <th>분류</th>
                                <th>위력</th>
                                <th>명중</th>
                                <th>습득</th>
                            </tr>
                            </thead>
                            <tbody>
                            {moves.map((m) => (
                                <tr key={m.id}>
                                    <td>{m.name}</td>
                                    <td>
                                            <span
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    padding:
                                                        "0.05rem 0.35rem",
                                                    borderRadius: 999,
                                                    backgroundColor:
                                                        m.elementColor ??
                                                        "rgba(148,163,184,0.2)",
                                                }}
                                            >
                                                {m.elementLabel}
                                            </span>
                                    </td>
                                    <td>{m.categoryLabel}</td>
                                    <td
                                        style={{
                                            textAlign: "right",
                                            fontVariantNumeric:
                                                "tabular-nums",
                                        }}
                                    >
                                        {m.power ?? "-"}
                                    </td>
                                    <td
                                        style={{
                                            textAlign: "right",
                                            fontVariantNumeric:
                                                "tabular-nums",
                                        }}
                                    >
                                        {m.accuracy != null
                                            ? `${m.accuracy}%`
                                            : "-"}
                                    </td>
                                    <td>
                                        {m.learnMethodLabel}
                                        {m.learnAt != null &&
                                            ` ${m.learnAt}`}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 특성 리스트 */}
            <div>
                <h3
                    style={{
                        fontSize: "0.95rem",
                        marginBottom: "0.35rem",
                    }}
                >
                    가질 수 있는 특성
                </h3>
                {abilities.length === 0 ? (
                    <p className="hint" style={{ fontSize: "0.8rem" }}>
                        아직 등록된 특성 정보가 없습니다.
                    </p>
                ) : (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.4rem",
                        }}
                    >
                        {abilities.map((a) => (
                            <div
                                key={a.id}
                                style={{
                                    padding: "0.4rem 0.5rem",
                                    borderRadius: "0.5rem",
                                    border: "1px solid var(--border-subtle)",
                                    backgroundColor:
                                        "rgba(15,23,42,0.7)",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        marginBottom: "0.2rem",
                                    }}
                                >
                                    <strong
                                        style={{
                                            fontSize: "0.85rem",
                                        }}
                                    >
                                        {a.name}
                                    </strong>
                                    <span
                                        style={{
                                            fontSize: "0.75rem",
                                            padding: "0.05rem 0.4rem",
                                            borderRadius: 999,
                                            border: "1px solid rgba(148,163,184,0.6)",
                                            color: "var(--text-sub)",
                                        }}
                                    >
                                        {a.rarityLabel}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        fontSize: "0.8rem",
                                        color: "var(--text-sub)",
                                        whiteSpace: "pre-wrap",
                                    }}
                                >
                                    {a.description}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
