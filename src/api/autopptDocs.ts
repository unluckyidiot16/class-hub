// src/api/autopptDocs.ts
import { supabase } from "../lib/supabaseClient";

export type AutopptDocRow = {
    id: string;
    room_id: string;
    title: string;
    pdf_path: string;
    total_pages: number;
    created_at: string;
};

export async function fetchLatestAutopptDoc(
    roomId: string,
): Promise<AutopptDocRow | null> {
    const { data, error } = await supabase
        .from("autoppt_docs")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(1);

    if (error) {
        console.error("[autoppt] fetchLatestAutopptDoc error", error);
        throw new Error("AutoPPT 문서를 불러오는 중 오류가 발생했습니다.");
    }

    return (data?.[0] as AutopptDocRow | undefined) ?? null;
}

export async function createAutopptDoc(params: {
    roomId: string;
    title: string;
    pdfPath: string;
    totalPages: number;
}): Promise<AutopptDocRow> {
    const { roomId, title, pdfPath, totalPages } = params;

    const { data, error } = await supabase
        .from("autoppt_docs")
        .insert({
            room_id: roomId,
            title,
            pdf_path: pdfPath,
            total_pages: totalPages,
        })
        .select("*")
        .single();

    if (error || !data) {
        console.error("[autoppt] createAutopptDoc error", error);
        throw new Error("AutoPPT 문서를 저장하는 중 오류가 발생했습니다.");
    }

    return data as AutopptDocRow;
}
