// src/components/teacher/TeacherAccountSection.tsx
import type { Session } from "@supabase/supabase-js";

type Profile = {
    id: string;
    display_name: string | null;
    role: string | null;
    created_at: string | null;
};

type TeacherAccountCardProps = {
    session: Session | null;
    profile: Profile | null;
    onClickProfile: () => void;
};

export function TeacherAccountCard({
                                       session,
                                       profile,
                                       onClickProfile,
                                   }: TeacherAccountCardProps) {
    const email = session?.user?.email ?? "로그인이 필요합니다.";

    return (
        <div className="card teacher-account">
            <h2 className="card-title">내 계정</h2>
            <p className="text-sm text-dim">ClassHub에 로그인한 교사 계정입니다.</p>

            <div className="mt-4 space-y-1">
                <div className="label-row">
                    <span className="label">이메일</span>
                    <span>{email}</span>
                </div>
                {profile?.display_name && (
                    <div className="label-row">
                        <span className="label">표시 이름</span>
                        <span>{profile.display_name}</span>
                    </div>
                )}
            </div>

            <div className="mt-6 flex gap-2">
                <button
                    type="button"
                    className="secondary-btn flex-1"
                    onClick={onClickProfile}
                >
                    내 정보 보기
                </button>
                {/* 로그인/로그아웃 버튼은 기존 로직 재사용 */}
            </div>
        </div>
    );
}
