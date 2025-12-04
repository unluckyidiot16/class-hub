// scripts/buildEffectGraphicMap.cjs
// Node 18+ 가정 (fs/promises 기본 탑재)

const fs = require("fs/promises");
const path = require("path");

// 🔧 필요하면 이 두 경로만 프로젝트에 맞게 수정
const EFFECTS_DIR = path.join(
    __dirname,
    "..",
    "public",
    "games",
    "quizmon",
    "effects",
);
const OUT_PATH = path.join(
    __dirname,
    "..",
    "public",
    "games",
    "quizmon",
    "effectGraphicMap.json",
);

async function main() {
    console.log("[buildEffectGraphicMap] scan dir:", EFFECTS_DIR);

    const entries = await fs.readdir(EFFECTS_DIR, { withFileTypes: true });

    const jsonFiles = entries
        .filter((ent) => ent.isFile() && ent.name.endsWith(".json"))
        .map((ent) => ent.name);

    if (jsonFiles.length === 0) {
        console.warn("[buildEffectGraphicMap] no json files found");
        return;
    }

    const mapping = {};

    for (const fileName of jsonFiles) {
        const filePath = path.join(EFFECTS_DIR, fileName);
        const baseName = path.basename(fileName, ".json"); // ← moveId 후보 (예: "acid-spray")

        try {
            const raw = await fs.readFile(filePath, "utf8");
            const data = JSON.parse(raw);

            // PRAS json은 대체로 배열 형태라고 가정 (accelerock.json, acid-spray.json처럼)
            const first = Array.isArray(data) ? data[0] : data;

            if (!first || typeof first.graphic !== "string") {
                console.warn(
                    `[buildEffectGraphicMap] skip ${fileName}: no graphic field`,
                );
                continue;
            }

            const graphic = first.graphic; // 예: "PRAS- Poison"

            mapping[baseName] = {
                moveId: baseName,
                graphic,
                jsonFile: fileName,
            };

            console.log(
                `  mapped: ${baseName} -> graphic="${graphic}" (file=${fileName})`,
            );
        } catch (err) {
            console.error(
                `[buildEffectGraphicMap] error parsing ${fileName}:`,
                err.message,
            );
        }
    }

    await fs.writeFile(OUT_PATH, JSON.stringify(mapping, null, 2), "utf8");
    console.log(
        `[buildEffectGraphicMap] wrote ${Object.keys(mapping).length} entries to`,
        OUT_PATH,
    );
}

main().catch((err) => {
    console.error("[buildEffectGraphicMap] fatal error:", err);
    process.exit(1);
});
