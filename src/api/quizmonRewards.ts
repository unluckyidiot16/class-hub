// src/api/quizmonRewards.ts
import { supabase } from "../lib/supabaseClient";

export async function grantQuizmonCoins(params: {
    classId: string;
    studentKey: string;
    amount: number;
    reason?: string;
}) {
    const { classId, studentKey, amount } = params;

    if (!amount) return;

    const { data, error } = await supabase.rpc(
        "increment_quizmon_coins",
        {
            p_class_id: classId,
            p_student_key: studentKey,
            p_amount: amount,
        },
    );

    if (error) {
        console.error("[grantQuizmonCoins] rpc error", error);
        throw error;
    }

    return data; // 필요하면 새로운 profile row 리턴
}

