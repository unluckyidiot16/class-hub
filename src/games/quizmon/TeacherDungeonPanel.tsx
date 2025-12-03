// src/games/quizmon/TeacherDungeonPanel.tsx
import { useMemo } from "react";

export type DungeonEnemySummary = {
    id: string;
    label: string;
    description?: string;

    // 메타 정보 (UI 태그용)
    difficultyLabel: string;
    locationLabel: string;
    subjectLabel: string;

    // 기본 적 정보
    enemyCount: number;
    enemySpeciesIds: string[]; // 예: ["0001", "0002", ...] 또는 ["bulbasaur", ...]
    minEnemyLevel: number;
    maxEnemyLevel: number;
};

export type DungeonOverride = {
    enemyCount?: number;
    minLevel?: number;
    maxLevel?: number;
};

export type TeacherDungeonPanelProps = {
    /** dungeonEnemySets.ts 에서 뽑은 던전 요약 리스트 */
    dungeons: DungeonEnemySummary[];

    /** 현재 선택된 던전 ID (없으면 첫 번째가 자동 선택됨) */
    selectedDungeonId: string | null;

    /** 던전별 오버라이드 값(몬스터 수, 레벨 범위 등)을 저장하는 맵 */
    overridesByDungeonId: Record<string, DungeonOverride>;

    /** 던전을 선택했을 때 호출되는 콜백 */
    onSelectDungeon: (dungeonId: string) => void;

    /**
     * 교사가 슬라이더/인풋을 조정해서
     * enemyCount / minLevel / maxLevel 를 바꿨을 때 호출되는 콜백
     */
    onChangeOverride: (dungeonId: string, patch: DungeonOverride) => void;
};

/**
 * 교사용 던전 튜닝 패널
 *
 * - 왼쪽: 던전 목록 (난이도/위치/과목 태그 포함)
 * - 오른쪽: 선택된 던전의 적 수/레벨 범위 오버라이드 + 미리보기
 *
 * 실제 적용은 부모(TeacherRoomLivePage 등)에서
 * overridesByDungeonId → 선택된 던전 시작 시 사용하면 됨.
 */
export function TeacherDungeonPanel(props: TeacherDungeonPanelProps) {
    const {
        dungeons,
        selectedDungeonId,
        overridesByDungeonId,
        onSelectDungeon,
        onChangeOverride,
    } = props;

    const hasDungeons = dungeons.length > 0;

    // 선택된 던전이 없으면 첫 번째를 기본 선택으로 사용
    const effectiveSelectedDungeonId =
        selectedDungeonId ?? (hasDungeons ? dungeons[0].id : null);

    const selectedDungeon = useMemo(
        () =>
            dungeons.find((d) => d.id === effectiveSelectedDungeonId) ?? null,
        [dungeons, effectiveSelectedDungeonId],
    );

     const selectedOverride: DungeonOverride =
        (effectiveSelectedDungeonId &&
            overridesByDungeonId[effectiveSelectedDungeonId]) ||
        {};

    // 실제 UI에 보여줄 값 (기본값 + 오버라이드 적용)
    const effectiveEnemyCount =
        selectedOverride.enemyCount ?? selectedDungeon?.enemyCount ?? 1;

    const effectiveMinLevel =
        selectedOverride.minLevel ?? selectedDungeon?.minEnemyLevel ?? 1;

    const effectiveMaxLevel =
        selectedOverride.maxLevel ?? selectedDungeon?.maxEnemyLevel ?? 1;

    const handleEnemyCountChange = (value: number) => {
        if (!selectedDungeon) return;
        const safe = Math.max(1, Math.min(value, selectedDungeon.enemyCount));
        onChangeOverride(selectedDungeon.id, {
            ...selectedOverride,
            enemyCount: safe,
        });
    };

    const handleMinLevelChange = (value: number) => {
        if (!selectedDungeon) return;
        const safe = Math.max(1, Math.min(value, 100));
        onChangeOverride(selectedDungeon.id, {
            ...selectedOverride,
            minLevel: safe,
            // maxLevel이 minLevel 보다 작아지지 않도록 보정 (간단 버전)
            maxLevel: Math.max(safe, effectiveMaxLevel),
        });
    };

    const handleMaxLevelChange = (value: number) => {
        if (!selectedDungeon) return;
        const safe = Math.max(1, Math.min(value, 100));
        onChangeOverride(selectedDungeon.id, {
            ...selectedOverride,
            maxLevel: safe,
            // minLevel이 maxLevel 보다 커지지 않도록 보정
            minLevel: Math.min(effectiveMinLevel, safe),
        });
    };

    const handleResetOverrides = () => {
        if (!selectedDungeon) return;
        onChangeOverride(selectedDungeon.id, {
            enemyCount: undefined,
            minLevel: undefined,
            maxLevel: undefined,
        });
    };

    return (
        <div className="card">
            <h2>던전 메타 / 난이도 튜닝 (베타)</h2>
            <p className="hint">
                하드코딩된 던전 메타 데이터를 한눈에 보고, 이번 수업에서 사용할 적
                수/레벨 범위를 가볍게 조정할 수 있는 교사용 패널입니다.
                <br />
                (실제 적용은 부모 컴포넌트에서 이 값을 받아 던전 시작 시 사용하면 됩니다.)
            </p>

            {!hasDungeons ? (
                <p className="hint" style={{ marginTop: "0.5rem" }}>
                    등록된 던전 메타 데이터가 없습니다. dungeonEnemySets.ts에 던전을 먼저
                    정의해 주세요.
                </p>
            ) : (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.6fr)",
                        gap: "1rem",
                        marginTop: "0.75rem",
                    }}
                >
                    {/* 왼쪽: 던전 리스트 */}
                    <div>
                        <h3
                            style={{
                                fontSize: "0.95rem",
                                marginBottom: "0.4rem",
                            }}
                        >
                            던전 목록
                        </h3>
                        <ul
                            style={{
                                listStyle: "none",
                                padding: 0,
                                margin: 0,
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.25rem",
                            }}
                        >
                            {dungeons.map((d) => {
                                const isSelected = d.id === effectiveSelectedDungeonId;
                                return (
                                    <li key={d.id}>
                                        <button
                                            type="button"
                                            onClick={() => onSelectDungeon(d.id)}
                                            style={{
                                                width: "100%",
                                                textAlign: "left",
                                                padding: "0.4rem 0.55rem",
                                                borderRadius: "0.45rem",
                                                border: isSelected
                                                    ? "1px solid var(--accent)"
                                                    : "1px solid var(--border-subtle)",
                                                background: isSelected
                                                    ? "rgba(56, 189, 248, 0.12)"
                                                    : "rgba(15, 23, 42, 0.9)",
                                                cursor: "pointer",
                                                fontSize: "0.85rem",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    gap: "0.4rem",
                                                }}
                                            >
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div
                                                        style={{
                                                            fontWeight: 600,
                                                            whiteSpace: "nowrap",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                        }}
                                                    >
                                                        {d.label}
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: "0.75rem",
                                                            color: "var(--text-sub)",
                                                            marginTop: "0.1rem",
                                                            display: "flex",
                                                            flexWrap: "wrap",
                                                            gap: "0.25rem",
                                                        }}
                                                    >
                                                        <span>#{d.id}</span>
                                                        <span>· {d.locationLabel}</span>
                                                        <span>· {d.difficultyLabel}</span>
                                                        <span>· {d.subjectLabel}</span>
                                                    </div>
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: "0.75rem",
                                                        color: "var(--text-sub)",
                                                        textAlign: "right",
                                                    }}
                                                >
                                                    <div>적 {d.enemyCount}마리</div>
                                                    <div>
                                                        Lv.{d.minEnemyLevel}~
                                                        {d.maxEnemyLevel}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {/* 오른쪽: 선택된 던전 상세 & 튜닝 */}
                    <div>
                        <h3
                            style={{
                                fontSize: "0.95rem",
                                marginBottom: "0.4rem",
                            }}
                        >
                            선택된 던전 설정
                        </h3>

                        {!selectedDungeon ? (
                            <p className="hint">
                                던전을 하나 선택하면 상세 설정을 볼 수 있습니다.
                            </p>
                        ) : (
                            <>
                                <div
                                    style={{
                                        padding: "0.6rem 0.75rem",
                                        borderRadius: "0.6rem",
                                        border: "1px solid var(--border-subtle)",
                                        background: "rgba(15, 23, 42, 0.9)",
                                        marginBottom: "0.6rem",
                                        fontSize: "0.85rem",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontWeight: 600,
                                            marginBottom: "0.2rem",
                                        }}
                                    >
                                        {selectedDungeon.label}
                                    </div>
                                    {selectedDungeon.description && (
                                        <div
                                            style={{
                                                marginBottom: "0.25rem",
                                                color: "var(--text-sub)",
                                            }}
                                        >
                                            {selectedDungeon.description}
                                        </div>
                                    )}
                                    <div
                                        style={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: "0.4rem",
                                            fontSize: "0.8rem",
                                            color: "var(--text-sub)",
                                        }}
                                    >
                                        <span>위치: {selectedDungeon.locationLabel}</span>
                                        <span>· 난이도: {selectedDungeon.difficultyLabel}</span>
                                        <span>· 과목: {selectedDungeon.subjectLabel}</span>
                                        <span>
                      · 기본 적 수: {selectedDungeon.enemyCount}마리
                    </span>
                                    </div>
                                </div>

                                {/* 튜닝 폼 */}
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            gap: "0.5rem",
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <label
                                            className="form-field"
                                            style={{
                                                flex: "1 1 120px",
                                                minWidth: "120px",
                                                fontSize: "0.8rem",
                                            }}
                                        >
                                            <span>이번 수업에서 사용할 적 수</span>
                                            <input
                                                type="number"
                                                min={1}
                                                max={selectedDungeon.enemyCount}
                                                value={effectiveEnemyCount}
                                                onChange={(e) =>
                                                    handleEnemyCountChange(
                                                        Number(e.target.value) || 1,
                                                    )
                                                }
                                            />
                                            <span className="hint">
                        기본값: {selectedDungeon.enemyCount}마리
                      </span>
                                        </label>

                                        <label
                                            className="form-field"
                                            style={{
                                                flex: "1 1 120px",
                                                minWidth: "120px",
                                                fontSize: "0.8rem",
                                            }}
                                        >
                                            <span>최소 레벨</span>
                                            <input
                                                type="number"
                                                min={1}
                                                max={100}
                                                value={effectiveMinLevel}
                                                onChange={(e) =>
                                                    handleMinLevelChange(
                                                        Number(e.target.value) || 1,
                                                    )
                                                }
                                            />
                                            <span className="hint">
                        기본값: Lv.{selectedDungeon.minEnemyLevel}
                      </span>
                                        </label>

                                        <label
                                            className="form-field"
                                            style={{
                                                flex: "1 1 120px",
                                                minWidth: "120px",
                                                fontSize: "0.8rem",
                                            }}
                                        >
                                            <span>최대 레벨</span>
                                            <input
                                                type="number"
                                                min={1}
                                                max={100}
                                                value={effectiveMaxLevel}
                                                onChange={(e) =>
                                                    handleMaxLevelChange(
                                                        Number(e.target.value) || 1,
                                                    )
                                                }
                                            />
                                            <span className="hint">
                        기본값: Lv.{selectedDungeon.maxEnemyLevel}
                      </span>
                                        </label>
                                    </div>

                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            gap: "0.5rem",
                                            marginTop: "0.25rem",
                                        }}
                                    >
                                        <div className="hint" style={{ fontSize: "0.8rem" }}>
                                            * 이 값들은{" "}
                                            <strong>이번 수업에서만</strong> 사용할 임시 튜닝 값으로,
                                            실제 던전 메타 데이터(dungeonEnemySets.ts)는 그대로
                                            두고 싶을 때 사용하면 좋습니다.
                                        </div>
                                        <button
                                            type="button"
                                            className="secondary-btn"
                                            onClick={handleResetOverrides}
                                        >
                                            던전 기본값으로 되돌리기
                                        </button>
                                    </div>
                                </div>

                                {/* 적 풀 간단 프리뷰 */}
                                <div
                                    style={{
                                        marginTop: "0.75rem",
                                        paddingTop: "0.6rem",
                                        borderTop: "1px solid var(--border-subtle)",
                                    }}
                                >
                                    <h4
                                        style={{
                                            fontSize: "0.9rem",
                                            marginBottom: "0.35rem",
                                        }}
                                    >
                                        적 풀 미리보기
                                    </h4>
                                    {selectedDungeon.enemySpeciesIds.length === 0 ? (
                                        <p className="hint">
                                            이 던전에 연결된 적 풀 정보가 없습니다.
                                        </p>
                                    ) : (
                                        <p
                                            style={{
                                                fontSize: "0.8rem",
                                                color: "var(--text-sub)",
                                                whiteSpace: "normal",
                                            }}
                                        >
                                            {selectedDungeon.enemySpeciesIds.join(", ")}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default TeacherDungeonPanel;
