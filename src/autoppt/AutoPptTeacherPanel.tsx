// src/autoppt/AutoPptTeacherPanel.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
    createAutopptDoc,
    fetchLatestAutopptDoc,
    type AutopptDocRow,
} from "../api/autopptDocs";

export type AutoPptTeacherPanelProps = {
    roomId: string | null;
};

export function AutoPptTeacherPanel({ roomId }: AutoPptTeacherPanelProps) {
    const [doc, setDoc] = useState<AutopptDocRow | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [currentPage, setCurrentPage] = useState(0); // 0-based index
    const [totalPagesInput, setTotalPagesInput] = useState("1");

    const channelRef = useRef<RealtimeChannel | null>(null);

    const hasRoom = !!roomId;

    // ▸ 최신 문서 로드
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
            console.error("[AutoPptTeacherPanel] loadDoc error", e);
            setError("슬라이드를 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    }, [roomId]);

    // ▸ 마운트/room 변경 시 문서 로드
    useEffect(() => {
        void loadDoc();
    }, [loadDoc]);

    // ▸ Realtime 채널 세팅
    useEffect(() => {
        if (!roomId) return;

        const channel = supabase
            .channel(`autoppt:${roomId}`)
            .on("broadcast", { event: "SET_PAGE" }, (payload) => {
                // 같은 방의 다른 교사가 있을 경우 동기화용
                const pageIndex = (payload?.payload as any)?.pageIndex ?? 0;
                setCurrentPage(pageIndex);
            })
            .subscribe((status) => {
                if (status === "SUBSCRIBED") {
                    // 처음 subscribe 되면, 현재 페이지를 한 번 전체에게 브로드캐스트
                    channel.send({
                        type: "broadcast",
                        event: "SET_PAGE",
                        payload: { pageIndex: currentPage },
                    });
                }
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                void supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [roomId, currentPage]);

    const broadcastPage = useCallback((pageIndex: number) => {
        if (!channelRef.current) return;
        channelRef.current.send({
            type: "broadcast",
            event: "SET_PAGE",
            payload: { pageIndex },
        });
    }, []);

    const goPage = useCallback(
        (delta: number) => {
            if (!doc) return;
            setCurrentPage((prev) => {
                const next = Math.min(
                    doc.total_pages - 1,
                    Math.max(0, prev + delta),
                );
                // 실제 state가 업데이트된 값과 동일하게 브로드캐스트
                broadcastPage(next);
                return next;
            });
        },
        [doc, broadcastPage],
    );

    // ▸ 파일 업로드
    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            if (!roomId) return;
            const file = e.target.files?.[0];
            if (!file) return;

            setUploading(true);
            setError(null);

            try {
                const ext = file.name.split(".").pop() ?? "pdf";
                const baseName = file.name.replace(/\.[^/.]+$/, "");
                const path = `${roomId}/${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2)}.${ext}`;

                // 1) Storage 업로드
                const { error: uploadError } = await supabase.storage
                    .from("autoppt")
                    .upload(path, file, {
                        upsert: true,
                    });

                if (uploadError) {
                    console.error("[AutoPptTeacherPanel] upload error", uploadError);
                    setError("PDF 업로드 중 오류가 발생했습니다.");
                    return;
                }

                // 2) 총 페이지 수는 일단 수동 입력값 사용
                const parsedTotal = Math.max(1, Number(totalPagesInput) || 1);

                // 3) DB에 문서 메타 저장
                const newDoc = await createAutopptDoc({
                    roomId,
                    title: baseName,
                    pdfPath: path,
                    totalPages: parsedTotal,
                });

                setDoc(newDoc);
                setCurrentPage(0);
                setError(null);
            } catch (err) {
                console.error("[AutoPptTeacherPanel] handleFileChange error", err);
                setError("AutoPPT 문서를 저장하는 중 오류가 발생했습니다.");
            } finally {
                setUploading(false);
                // 같은 파일 다시 선택 가능하게
                e.target.value = "";
            }
        },
        [roomId, totalPagesInput],
    );

    // ▸ PDF URL (public)
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
                // 탭 높이에 종속되지 않고 화면 기준으로 넉넉하게 사용
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
            <div
                style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    marginBottom: 4,
                }}
            >
                AutoPPT (교사용)
            </div>

            {/* 업로드 영역 */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 8,
                    alignItems: "center",
                }}
            >
                <label
                    style={{
                        fontSize: "0.75rem",
                        color: "#9ca3af",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                    }}
                >
                    PDF 업로드
                    <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                        disabled={!hasRoom || uploading}
                        style={{ fontSize: "0.75rem" }}
                    />
                </label>

                <label
                    style={{
                        fontSize: "0.75rem",
                        color: "#9ca3af",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                    }}
                >
                    총 페이지 수
                    <input
                        type="number"
                        min={1}
                        value={totalPagesInput}
                        disabled={uploading}
                        onChange={(e) => setTotalPagesInput(e.target.value)}
                        style={{
                            width: 72,
                            fontSize: "0.75rem",
                            padding: "2px 4px",
                            borderRadius: 4,
                            border: "1px solid rgba(55,65,81,0.9)",
                            background: "#020617",
                            color: "#e5e7eb",
                        }}
                    />
                </label>
            </div>

            {loading && (
                <div
                    style={{
                        fontSize: "0.8rem",
                        color: "#9ca3af",
                    }}
                >
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
                <div
                    style={{
                        fontSize: "0.78rem",
                        color: "#9ca3af",
                    }}
                >
                    아직 업로드된 PDF가 없습니다. 상단에서 수업용 PDF 파일을 선택해
                    주세요.
                </div>
            )}

            {/* 슬라이드 뷰 + 네비게이션 */}
            {doc && (
                <>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "0.8rem",
                        }}
                    >
                        <div
                            style={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: "60%",
                            }}
                        >
                            {doc.title}
                        </div>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <button
                                type="button"
                                onClick={() => goPage(-1)}
                                disabled={currentPage <= 0}
                                style={{
                                    padding: "2px 8px",
                                    fontSize: "0.75rem",
                                    borderRadius: 999,
                                    border: "none",
                                    cursor: currentPage <= 0 ? "default" : "pointer",
                                    background:
                                        currentPage <= 0
                                            ? "rgba(31,41,55,0.7)"
                                            : "rgba(55,65,81,0.9)",
                                    color: "#e5e7eb",
                                }}
                            >
                                ◀
                            </button>
                            <span style={{ fontSize: "0.78rem", color: "#e5e7eb" }}>
                {humanPage} / {totalPages}
              </span>
                            <button
                                type="button"
                                onClick={() => goPage(1)}
                                disabled={currentPage >= totalPages - 1}
                                style={{
                                    padding: "2px 8px",
                                    fontSize: "0.75rem",
                                    borderRadius: 999,
                                    border: "none",
                                    cursor:
                                        currentPage >= totalPages - 1 ? "default" : "pointer",
                                    background:
                                        currentPage >= totalPages - 1
                                            ? "rgba(31,41,55,0.7)"
                                            : "rgba(55,65,81,0.9)",
                                    color: "#e5e7eb",
                                }}
                            >
                                ▶
                            </button>
                        </div>
                    </div>

                    <div
                        style={{
                            flex: 1,
                            minHeight: 260,
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
