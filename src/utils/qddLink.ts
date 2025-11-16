// src/utils/qddLink.ts

/**
 * QDD(QuizDiceDefense) 연동용 URL 생성 헬퍼.
 *
 * - 기본값: GitHub Pages의 QDD.html 사용
 * - 환경 변수:
 *   - VITE_QDD_HTML_URL: QDD HTML 위치(옵션)
 *   - VITE_QDD_QP_TEMPLATE: Supabase 등에서 JSON을 뽑는 URL 템플릿(옵션)
 *     예) "https://xxx.supabase.co/functions/v1/qdd-pack?pack_id={packId}"
 *
 *   VITE_QDD_QP_TEMPLATE 이 설정되어 있으면 ?qp=... 방식으로 연결.
 *   없으면 기존처럼 ?pack=슬러그 방식으로 폴백.
 */
export type SimplePack = {
    id: string;
    title?: string | null;
};

const DEFAULT_QDD_HTML_URL =
    "https://unluckyidiot16.github.io/WebGames/QuizDiceDefense/QDD.html";

export function buildQddUrlForPack(pack: SimplePack): string | null {
    const env = import.meta.env as any;

    const qddHtml = env.VITE_QDD_HTML_URL || DEFAULT_QDD_HTML_URL;
    const qpTemplate = env.VITE_QDD_QP_TEMPLATE as string | undefined;

    if (qpTemplate) {
        // Supabase 등에서 JSON을 바로 뽑아오는 URL 템플릿 사용
        const qpRaw = qpTemplate.replace("{packId}", encodeURIComponent(pack.id));
        const url = `${qddHtml}?qp=${encodeURIComponent(qpRaw)}`;
        return url;
    }

    // 템플릿이 없으면 기존처럼 pack=슬러그 방식으로 폴백
    const slug = (pack.title ?? "").trim();
    if (!slug) return null;

    return `${qddHtml}?pack=${encodeURIComponent(slug)}`;
}
