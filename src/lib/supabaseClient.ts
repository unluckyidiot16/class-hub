// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    // 초기 개발 단계에서 env 안 넣으면 바로 알 수 있도록
    // (프로덕션에선 콘솔 출력 안 하거나 Sentry로 보내도 됨)
    console.warn(
        "[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 설정되어 있지 않습니다."
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
