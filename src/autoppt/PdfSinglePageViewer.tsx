// src/autoppt/PdfSinglePageViewer.tsx
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// pdf.js 워커 설정 (CDN 사용: 번들 설정 안 건드려도 됨)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export type PdfSinglePageViewerProps = {
    /** Supabase public URL */
    url: string;
    /** 1-based page number (1페이지부터 시작) */
    pageNumber: number;
};

export function PdfSinglePageViewer({ url, pageNumber }: PdfSinglePageViewerProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [containerWidth, setContainerWidth] = useState<number | undefined>(
        undefined,
    );
    const [numPages, setNumPages] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    // 컨테이너 width에 맞춰 PDF 크기 자동 조정
    useEffect(() => {
        if (!containerRef.current) return;
        const el = containerRef.current;

        const updateWidth = () => {
            const w = el.clientWidth;
            if (w) {
                // 약간 여유 주기
                setContainerWidth(w - 16);
            }
        };

        updateWidth();

        const observer = new ResizeObserver(updateWidth);
        observer.observe(el);

        return () => observer.disconnect();
    }, []);

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setError(null);
    };

    const clampedPage =
        numPages != null ? Math.min(Math.max(pageNumber, 1), numPages) : pageNumber;

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                height: "100%",
                overflow: "auto",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                backgroundColor: "#020617",
            }}
        >
            <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(e) => {
                    console.error("[PdfSinglePageViewer] onLoadError", e);
                    setError("PDF를 불러오는 중 오류가 발생했습니다.");
                }}
                loading={
                    <div
                        style={{
                            padding: "0.75rem",
                            fontSize: "0.8rem",
                            color: "#9ca3af",
                        }}
                    >
                        PDF를 불러오는 중입니다...
                    </div>
                }
                error={
                    <div
                        style={{
                            padding: "0.75rem",
                            fontSize: "0.8rem",
                            color: "#f97373",
                        }}
                    >
                        {error ?? "PDF를 불러오는 중 오류가 발생했습니다."}
                    </div>
                }
            >
                <Page
                    pageNumber={clampedPage}
                    width={containerWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                />
            </Document>
        </div>
    );
}
