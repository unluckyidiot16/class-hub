// src/utils/quizPackImport.ts
import type { QuizPackJsonV1 } from "../types/quizPackJson";
import { supabase } from "../lib/supabaseClient";

// QDD (Eng5_9 같은) question/options/answerIndex 배열 → QuizPackJsonV1 변환
function tryConvertLegacyQddJson(
    raw: unknown,
    filename: string
): QuizPackJsonV1 | null {
    if (!Array.isArray(raw) || raw.length === 0) return null;

    // 최소 형태 검사
    if (
        !raw.every(
            (q) =>
                q &&
                typeof (q as any).question === "string" &&
                Array.isArray((q as any).options) &&
                typeof (q as any).answerIndex === "number"
        )
    ) {
        return null;
    }

    const mapDifficulty = (d: any): number | null => {
        if (typeof d !== "string") return null;
        const v = d.toLowerCase();
        if (v === "easy") return 1;
        if (v === "medium") return 3;
        if (v === "hard") return 5;
        return null;
    };

    const title =
        filename.replace(/\.json$/i, "") || "Imported QDD QuizPack";

    const questions = (raw as any[]).map((q, idx) => ({
        index: idx,
        prompt: String(q.question),
        options: (q.options as any[]).map((o) => String(o)),
        answerIndex:
            typeof q.answerIndex === "number" ? q.answerIndex : 0,
        difficulty: mapDifficulty(q.difficulty),
        tags: null,
    }));

    return {
        type: "quizpack",
        version: "v1",
        pack: {
            id: undefined,
            title,
            subject: null,
            grade: null,
            description: null,
        },
        questions,
    };
}

function normalizeQuizPackJson(raw: any, filename: string): QuizPackJsonV1 {
    // 1) 이미 QuizPackJsonV1 형태 (type/version/pack/questions)
    if (
        raw &&
        raw.type === "quizpack" &&
        raw.version === "v1" &&
        raw.pack &&
        Array.isArray(raw.questions)
    ) {
        const pack = raw.pack ?? {};
        const questions = raw.questions ?? [];

        if (questions.length === 0) {
            throw new Error("문항이 하나 이상 있어야 합니다.");
        }

        const normalizedQuestions = questions.map((q: any, idx: number) => {
            if (
                typeof q.prompt !== "string" ||
                !Array.isArray(q.options) ||
                typeof q.answerIndex !== "number"
            ) {
                throw new Error(`${idx + 1}번 문항 형식이 잘못되었습니다.`);
            }

            return {
                id: q.id, // 있으면 그대로, 없어도 무시
                index: typeof q.index === "number" ? q.index : idx,
                prompt: q.prompt,
                options: q.options.map((o: any) => String(o)),
                answerIndex: q.answerIndex,
                difficulty:
                    typeof q.difficulty === "number"
                        ? q.difficulty
                        : null,
                tags: Array.isArray(q.tags)
                    ? q.tags.map((t: any) => String(t))
                    : null,
            };
        });

        const title =
            typeof pack.title === "string" && pack.title.trim()
                ? pack.title.trim()
                : filename.replace(/\.json$/i, "") ||
                "제목 없는 퀴즈팩";

        return {
            type: "quizpack",
            version: "v1",
            pack: {
                id: pack.id,
                title,
                subject:
                    typeof pack.subject === "string"
                        ? pack.subject
                        : null,
                grade:
                    typeof pack.grade === "string" ? pack.grade : null,
                description:
                    typeof pack.description === "string"
                        ? pack.description
                        : null,
            },
            questions: normalizedQuestions,
        };
    }

    // 2) QDD 레거시 배열 포맷이면 변환
    const converted = tryConvertLegacyQddJson(raw, filename);
    if (converted) return converted;

    // 3) 둘 다 아니면 실패
    throw new Error("지원하지 않는 퀴즈팩 포맷입니다.");
}

/**
 * 업로드된 파일을 읽어서 QuizPackJsonV1로 파싱/검증
 */
export async function parseQuizPackFile(
    file: File
): Promise<QuizPackJsonV1> {
    const text = await file.text();
    let raw: unknown;

    try {
        raw = JSON.parse(text);
    } catch {
        throw new Error("JSON 형식이 올바르지 않습니다.");
    }

    return normalizeQuizPackJson(raw as any, file.name);
}

/**
 * JSON으로부터 새 quiz_packs + quiz_questions를 생성하고
 * 생성된 pack id를 반환
 */
export async function importQuizPackJson(
    file: File,
    ownerId: string
): Promise<string> {
    const data = await parseQuizPackFile(file);
    const { pack, questions } = data;

    // 1) quiz_packs insert
    const { data: packRow, error: packErr } = await supabase
        .from("quiz_packs")
        .insert({
            owner_id: ownerId,
            title: pack.title,
            subject: pack.subject ?? null,
            grade: pack.grade ?? null,
            description: pack.description ?? null,
        })
        .select("*")
        .single();

    if (packErr || !packRow) {
        console.error("[importQuizPackJson] pack insert error", packErr);
        throw new Error("퀴즈팩 생성 중 오류가 발생했습니다.");
    }

    const newPackId = packRow.id as string;

    // 2) quiz_questions bulk insert
    const questionRows = questions.map((q, idx) => ({
        pack_id: newPackId,
        index_in_pack:
            typeof q.index === "number" ? q.index : idx,
        prompt: q.prompt,
        options: q.options,
        answer_index: q.answerIndex,
        difficulty:
            typeof q.difficulty === "number" ? q.difficulty : null,
        tags: Array.isArray(q.tags) ? q.tags : null,
    }));

    if (questionRows.length > 0) {
        const { error: qErr } = await supabase
            .from("quiz_questions")
            .insert(questionRows);

        if (qErr) {
            console.error(
                "[importQuizPackJson] questions insert error",
                qErr
            );
            throw new Error("문항 생성 중 오류가 발생했습니다.");
        }
    }

    return newPackId;
}
