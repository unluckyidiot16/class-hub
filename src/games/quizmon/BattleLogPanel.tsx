// 예: BattleLogPanel.tsx

import type { BattleLogEntry } from "./types";

function renderLogText(text: string): React.ReactNode {
    const patterns = [
        {
            phrase: "효과가 굉장했다!",
            style: { color: "#f97373", fontWeight: 700 },
        },
        {
            phrase: "별로 효과가 없는 것 같다.",
            style: { color: "#60a5fa", fontWeight: 700 },
        },
        {
            phrase: "그러나 아무 효과도 없는 것 같다...",
            style: { color: "#d1d5db", fontWeight: 700 },
        },
        {
            phrase: "급소에 맞았다!",
            style: { color: "#facc15", fontWeight: 700 },
        },
    ];

    let nodes: React.ReactNode[] = [text];

    patterns.forEach(({ phrase, style }) => {
        nodes = nodes.flatMap((node) => {
            if (typeof node !== "string") return [node];
            const parts = node.split(phrase);
            if (parts.length === 1) return [node];

            const result: React.ReactNode[] = [];
            parts.forEach((part, idx) => {
                if (part) result.push(part);
                if (idx < parts.length - 1) {
                    result.push(
                        <span style={style} key={`${phrase}-${idx}`}>
                            {phrase}
                        </span>,
                    );
                }
            });
            return result;
        });
    });

    return nodes;
}

export function BattleLogPanel({ logs }: { logs: BattleLogEntry[] }) {
    return (
        <div
            style={{
                maxHeight: 200,
                overflowY: "auto",
                fontSize: "0.8rem",
                padding: "0.5rem",
            }}
        >
            {logs.map((log) => (
                <div key={log.id} style={{ marginBottom: 4 }}>
                    {renderLogText(log.text)}
                </div>
            ))}
        </div>
    );
}
