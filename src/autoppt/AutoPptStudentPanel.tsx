// src/autoppt/AutoPptStudentPanel.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
    fetchLatestAutopptDoc,
    type AutopptDocRow,
} from "../api/autopptDocs";

export type AutoPptStudentPanelProps = {
    roomId: string | null;
};

export function AutoPptStudentPanel({ roomId }: AutoPptStudentPanelProps) {
    const [doc, setDoc] = useState<AutopptDocRow | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(0);

    const channelRef = useRef<RealtimeChannel | null>(null);

    const loadDoc = useCallback(async () => {
        if (!roomId) {
            setDoc(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const latest = await fetchLatestAutopptDoc(roomId);
            setDoc(latest);
            setCurrentPage(0);
        } catch (e) {
            console.error("[AutoPptStudentPanel] loadDoc error", e);
            setError("슬라이드를 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    }, [roomId]);

    useEffect(() => {
        void loadDoc();
    }, [loadDoc]);

    // ▸ Realtime: SET_PAGE 수신
    useEffect(() => {
        if (!roomId) return;

        const channel = supabase
            .channel(`autoppt:${roomId}`)
            .on("broadcast", { event: "SET_PAGE" }, (payload) => {
                const pageIndex = (payload?.payload as any)?.pageIndex ?? 0;
                setCurrentPage(pageIndex);
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                void supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [roomId]);

    const pdfUrl =
        doc &&
        supabase.storage.from("autoppt").getPublicUrl(doc.pdf_path).data.publicUrl;

    const humanPage = currentPage + 1;
    const totalPages = doc?.total_pages ?? 1;

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                padding: 8,
                gap: 8,
                background: "#020617",
                color: "#e5e7eb",
                borderRadius: 8,
                border: "1px solid rgba(31,41,55,0.9)",
            }}
        >
            <div
                style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    marginBottom: 4,
                }}
            >
                AutoPPT (학생용)
            </div>

            {loading && (
                <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                    슬라이드를 불러오는 중입니다...
                </div>
            )}

            {error && (
                <div
                    style={{
                        fontSize: "0.78rem",
                        color: "#f97373",
                        background: "rgba(127,29,29,0.2)",
                        borderRadius: 8,
                        padding: "4px 8px",
                    }}
                >
                    {error}
                </div>
            )}

            {!loading && !doc && (
                <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
                    아직 교사가 업로드한 PDF가 없습니다.
                </div>
            )}

            {doc && (
                <>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.78rem",
                        }}
                    >
                        <div
                            style={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: "70%",
                            }}
                        >
                            {doc.title}
                        </div>
                        <div>
                            {humanPage} / {totalPages}
                        </div>
                    </div>

                    <div
                        style={{
                            flex: 1,
                            borderRadius: 8,
                            overflow: "hidden",
                            border: "1px solid rgba(31,41,55,0.9)",
                            background: "#020617",
                        }}
                    >
                        {pdfUrl ? (
                            <iframe
                                key={`${pdfUrl}#${humanPage}`}
                                src={`${pdfUrl}#page=${humanPage}`}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    border: "none",
                                }}
                                title="AutoPPT Slide"
                            />
                        ) : (
                            <div
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "0.8rem",
                                    color: "#9ca3af",
                                }}
                            >
                                PDF URL을 불러올 수 없습니다.
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
