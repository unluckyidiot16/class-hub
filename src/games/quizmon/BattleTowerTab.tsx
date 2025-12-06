// src/games/quizmon/BattleTowerTab.tsx
import type { QuizmonProfileRow } from "./types";
import { getMonsterIcon } from "./assets";

export type TowerFloorMonster = {
    speciesId: string;
    level?: number | null;
};

export type TowerFloor = {
    id: string;
    floor: number;                // 1층, 2층 ...
    name?: string;
    recommendedRating?: number;
    cleared?: boolean;
    locked?: boolean;
    monsters: TowerFloorMonster[]; // 1~3칸
    dungeonId?: string;
};

export type BattleTowerTabProps = {
    profile: QuizmonProfileRow | null;
    floors: TowerFloor[];
    onSelectFloor?: (floor: TowerFloor) => void;
};

function FloorCard(props: {
    floor: TowerFloor;
    onClick?: () => void;
}) {
    const { floor } = props;
    const monsters = floor.monsters.slice(0, 3);

    const label =
        floor.floor === 1
            ? "1층"
            : `${floor.floor}층`;

    const disabled = floor.locked;

    return (
        <button
            type="button"
            onClick={props.onClick}
            disabled={disabled}
            style={{
                width: "100%",
                opacity: disabled ? 0.4 : 1,
                cursor: disabled ? "default" : "pointer",
                borderRadius: 16,
                padding: "10px 14px",
                border: "1px solid rgba(148,163,184,0.6)",
                background:
                    "linear-gradient(90deg, rgba(15,23,42,0.95), rgba(30,64,175,0.7))",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
            }}
        >
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    alignItems: "flex-start",
                }}
            >
                <div
                    style={{
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: "#bfdbfe",
                    }}
                >
                    {label}
                </div>
                <div
                    style={{
                        fontSize: "0.8rem",
                        color: "#e5e7eb",
                    }}
                >
                    {floor.name ?? "배틀 타워 층"}
                </div>
                {floor.recommendedRating && (
                    <div
                        style={{
                            fontSize: "0.7rem",
                            color: "#9ca3af",
                        }}
                    >
                        추천 ELO {floor.recommendedRating}
                    </div>
                )}
                {floor.cleared && !floor.locked && (
                    <div
                        style={{
                            marginTop: 2,
                            fontSize: "0.7rem",
                            color: "#facc15",
                        }}
                    >
                        클리어 완료
                    </div>
                )}
            </div>

            <div
                style={{
                    display: "flex",
                    gap: 8,
                }}
            >
                {monsters.map((m, idx) => {
                    const icon = getMonsterIcon(m.speciesId);
                    return (
                        <div
                            key={idx}
                            style={{
                                width: 52,
                                height: 52,
                                borderRadius: 12,
                                backgroundColor: "rgba(15,23,42,0.9)",
                                border:
                                    "1px solid rgba(248,250,252,0.9)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                            }}
                        >
                            {icon && (
                                <img
                                    src={icon}
                                    alt={m.speciesId}
                                    style={{
                                        width: 48,
                                        height: 48,
                                        imageRendering: "pixelated",
                                    }}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </button>
    );
}

export function BattleTowerTab({
                                   profile,
                                   floors,
                                   onSelectFloor,
                               }: BattleTowerTabProps) {
    const sortedFloors = [...floors].sort((a, b) => b.floor - a.floor);
    return (
        <div
            style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: 12,
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <div
                    style={{
                        fontSize: "0.95rem",
                        fontWeight: 700,
                        color: "#e5e7eb",
                    }}
                >
                    배틀 타워
                </div>
                {profile && (
                    <div
                        style={{
                            fontSize: "0.75rem",
                            color: "#9ca3af",
                        }}
                    >
                        {profile.trainer_name ?? "트레이너"}님,
                        가능한 높이까지 올라가 보세요!
                    </div>
                )}
            </div>

            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    paddingBottom: 40,
                }}
            >
                {sortedFloors.map((floor) => (
                    <FloorCard
                        key={floor.id}
                        floor={floor}
                        onClick={
                            onSelectFloor
                                ? () => onSelectFloor(floor)
                                : undefined
                        }
                    />
                ))}
            </div>
        </div>
    );
}
