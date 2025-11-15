// src/pages/LandingPage.tsx
import { Link } from "react-router-dom";

export function LandingPage() {
    return (
        <section className="page landing">
            <h1>ClassHub (가칭)</h1>
            <p className="page-desc">
                수업용 실시간 퀴즈와 게임, 방과후 개인 플레이를 한 곳에서 관리하는
                허브입니다.
            </p>

            <div className="landing-actions">
                <div className="card">
                    <h2>교사로 시작</h2>
                    <p>수업용 방을 만들고, 퀴즈팩을 관리하고, 실시간 퀴즈를 진행합니다.</p>
                    <Link to="/teacher" className="primary-btn">
                        교사 대시보드로 이동
                    </Link>
                </div>

                <div className="card">
                    <h2>학생으로 접속</h2>
                    <p>선생님이 알려준 방 코드로 접속하여 퀴즈/게임에 참여합니다.</p>
                    <Link to="/student" className="secondary-btn">
                        학생 접속 화면으로 이동
                    </Link>
                </div>
            </div>
        </section>
    );
}
