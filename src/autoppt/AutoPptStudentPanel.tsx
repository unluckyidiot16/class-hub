// src/autoppt/AutoPptStudentPanel.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { LiveQuestionPayload } from "./AutoPptQuestionPanel";
import {
    fetchLatestAutopptDoc,
    type AutopptDocRow,
} from "../api/autopptDocs";
import { PdfSinglePageViewer } from "./PdfSinglePageViewer";



export type AutoPptStudentPanelProps = {
    roomId: string | null;
};

export function AutoPptStudentPanel({ roomId }: AutoPptStudentPanelProps) {
    const [doc, setDoc] = useState<AutopptDocRow | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [liveQuestion, setLiveQuestion] = useState<LiveQuestionPayload | null>(null);
    const [showQuestionModal, setShowQuestionModal] = useState(false);


    // ✅ 전체화면 상태 + 루트 DOM ref
    const [isFullscreen, setIsFullscreen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

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

        const channelName = `autoppt:${roomId}`;
        const channel: RealtimeChannel = supabase
            .channel(channelName)
            .on("broadcast", { event: "SET_PAGE" }, (payload) => {
                const pageIndex =
                    (payload?.payload as { pageIndex?: number } | undefined)
                        ?.pageIndex ?? 0;
                setCurrentPage(pageIndex);
            })
            .on("broadcast", { event: "PRESENT_QUESTION" }, (payload) => {
                const q = (payload?.payload as any)
                    ?.question as LiveQuestionPayload | undefined;

                if (!q) return;
                setLiveQuestion(q);
                setShowQuestionModal(true);
            })
            .subscribe((status) => {
                console.log("[AutoPPT Student] channel status:", status);
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [roomId]);


    // ✅ 전체화면 진입 / 종료 감지
    useEffect(() => {
        if (typeof document === "undefined") return;

        const handleChange = () => {
            setIsFullscreen(document.fullscreenElement === rootRef.current);
        };

        document.addEventListener("fullscreenchange", handleChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleChange);
        };
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (typeof document === "undefined" || !rootRef.current) return;

        try {
            if (document.fullscreenElement === rootRef.current) {
                void document.exitFullscreen();
            } else {
                void rootRef.current.requestFullscreen();
            }
        } catch (e) {
            console.error("[AutoPptStudentPanel] toggleFullscreen error", e);
        }
    }, []);


    const pdfUrl =
        doc &&
        supabase.storage.from("autoppt").getPublicUrl(doc.pdf_path).data.publicUrl;

    const humanPage = currentPage + 1;
    const totalPages = doc?.total_pages ?? 1;

    return (
                <div
                    ref={rootRef}
                    style={{
                display: "flex", 
                position: "relative",
                flexDirection: "column",
                height: "min(70vh, 620px)",
                minHeight: 320,
                padding: 8,
                gap: 8,
                background: "#020617",
                color: "#e5e7eb",
                borderRadius: 8,
                border: "1px solid rgba(31,41,55,0.9)",
            }}
                >
                    {/* 제목 + 전체화면 버튼 */}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "0.9rem",
                            marginBottom: 4,
                        }}
                    >
                        <div style={{ fontWeight: 600 }}>AutoPPT (학생용)</div>
                        <button
                            type="button" 
                            onClick={toggleFullscreen}
                            style={{
                                fontSize: "0.75rem",
                                padding: "2px 8px",
                                borderRadius: 999,
                                border: "1px solid rgba(148,163,184,0.8)",
                                background: "transparent",
                                color: "#e5e7eb",
                                cursor: "pointer",
                            }}
                        >
                            {isFullscreen ? "전체화면 종료" : "전체화면"}
                        </button>
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
                            <PdfSinglePageViewer url={pdfUrl} pageNumber={humanPage} />
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

                    {liveQuestion && showQuestionModal && (
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                background: "rgba(15,23,42,0.8)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                zIndex: 50,
                            }}
                        >
                            <div
                                style={{
                                    maxWidth: 640,
                                    width: "90%",
                                    borderRadius: 16,
                                    border: "1px solid rgba(148,163,184,0.9)",
                                    background:
                                        "radial-gradient(circle at top, rgba(15,23,42,1), rgba(15,23,42,0.98))",
                                    padding: "1rem",
                                    boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: "0.5rem",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "0.85rem",
                                            fontWeight: 600,
                                        }}
                                    >
                                        선생님이 문제를 출제했어요
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowQuestionModal(false)}
                                        style={{
                                            fontSize: "0.75rem",
                                            padding: "0.2rem 0.5rem",
                                            borderRadius: 999,
                                            border: "1px solid rgba(75,85,99,0.9)",
                                            background: "transparent",
                                            color: "#e5e7eb",
                                            cursor: "pointer",
                                        }}
                                    >
                                        닫기
                                    </button>
                                </div>

                                <div
                                    style={{
                                        fontSize: "0.9rem",
                                        marginBottom: "0.75rem",
                                        whiteSpace: "pre-wrap",
                                    }}
                                >
                                    {liveQuestion.prompt}
                                </div>

                                {liveQuestion.options &&
                                    liveQuestion.options.length > 0 && (
                                        <ul
                                            style={{
                                                listStyle: "none",
                                                padding: 0,
                                                margin: 0,
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "0.35rem",
                                            }}
                                        >
                                            {liveQuestion.options.map(
                                                (opt, idx) => (
                                                    <li
                                                        key={idx}
                                                        style={{
                                                            fontSize: "0.9rem",
                                                            padding:
                                                                "0.35rem 0.5rem",
                                                            borderRadius: 999,
                                                            background:
                                                                "rgba(15,23,42,0.9)",
                                                            border:
                                                                "1px solid rgba(55,65,81,0.9)",
                                                        }}
                                                    >
                                                        <strong>
                                                            {String.fromCharCode(
                                                                65 + idx,
                                                            )}
                                                            .
                                                        </strong>{" "}
                                                        {opt}
                                                    </li>
                                                ),
                                            )}
                                        </ul>
                                    )}

                                {liveQuestion.timeLimitSec &&
                                    liveQuestion.timeLimitSec > 0 && (
                                        <p
                                            style={{
                                                marginTop: "0.6rem",
                                                fontSize: "0.8rem",
                                                color: "#facc15",
                                            }}
                                        >
                                            제한 시간: 약{" "}
                                            {liveQuestion.timeLimitSec}
                                            초 (지금은 타이머 없이 안내만
                                            표시됩니다)
                                        </p>
                                    )}
                            </div>
                        </div>
                    )}


                </>
            )}
        </div>
    );
}
