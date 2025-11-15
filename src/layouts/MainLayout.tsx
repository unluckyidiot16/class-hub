// src/layouts/MainLayout.tsx
import type { PropsWithChildren } from "react";
import { Link, useLocation } from "react-router-dom";

export function MainLayout({ children }: PropsWithChildren) {
    const location = useLocation();

    const isTeacher = location.pathname.startsWith("/teacher");
    const isStudent = location.pathname.startsWith("/student");

    return (
        <div className="app-root">
            {/* ✅ 학생 페이지에서는 헤더 자체를 숨김 */}
            {!isStudent && (
                <header className="app-header">
                    <div className="app-header-left">
                        <Link to="/" className="brand">
                            ClassHub
                        </Link>
                        <span className="brand-sub">수업용 퀴즈 & 게임 허브</span>
                    </div>

                    <nav className="app-nav">
                        <Link
                            to="/teacher"
                            className={isTeacher ? "nav-link active" : "nav-link"}
                        >
                            교사 모드
                        </Link>
                        <Link
                            to="/student"
                            className={isStudent ? "nav-link active" : "nav-link"}
                        >
                            학생 모드
                        </Link>
                    </nav>
                </header>
            )}

            {/* 필요하면 학생 전용 레이아웃 스타일링을 위해 class 추가 */}
            <main className={isStudent ? "app-main student-main" : "app-main"}>
                {children}
            </main>
        </div>
    );
}
