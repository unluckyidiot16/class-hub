// src/App.tsx
import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import { LandingPage } from "./pages/LandingPage";
import { TeacherHomePage } from "./pages/teacher/TeacherHomePage";
import { TeacherClassRoomsPage } from "./pages/teacher/TeacherClassRoomsPage";
import { StudentJoinPage } from "./pages/student/StudentJoinPage";
import { StudentRoomPage } from "./pages/student/StudentRoomPage";
import { QuizPackListPage } from "./pages/teacher/QuizPackListPage";
import { QuizPackEditorPage } from "./pages/teacher/QuizPackEditorPage";
import { TeacherRoomLivePage } from "./pages/teacher/TeacherRoomLivePage";
import { StudentPlayPackPage } from "./pages/student/StudentPlayPackPage";

// QuizMon 관련 lazy 페이지들
const QuizMonDevPage = lazy(
    () => import("./games/quizmon/QuizMonDevPage"),
);

// 🔹 새로 추가: 학생용 퀴즈몬 허브 페이지
const StudentQuizMonHubPage = lazy(
    () => import("./pages/student/StudentQuizMonHubPage"),
);

function App() {
    return (
        <MainLayout>
            <Suspense fallback={<div>Loading…</div>}>
                <Routes>
                    <Route path="/" element={<LandingPage />} />

                    <Route path="/teacher" element={<TeacherHomePage />} />
                    <Route
                        path="/teacher/classes/:classId/rooms"
                        element={<TeacherClassRoomsPage />}
                    />
                    <Route
                        path="/teacher/quiz-packs"
                        element={<QuizPackListPage />}
                    />
                    <Route
                        path="/teacher/quiz-packs/:packId/edit"
                        element={<QuizPackEditorPage />}
                    />

                    {/* 교사용 라이브 퀴즈 컨트롤 페이지 */}
                    <Route
                        path="/teacher/rooms/:roomId/live"
                        element={<TeacherRoomLivePage />}
                    />

                    {/* 학생용 */}
                    <Route path="/student" element={<StudentJoinPage />} />
                    <Route
                        path="/student/room/:roomId"
                        element={<StudentRoomPage />}
                    />
                    <Route
                        path="/student/play/:packId"
                        element={<StudentPlayPackPage />}
                    />

                    {/* 🔹 학생용 퀴즈몬 허브 (자습/수집용) */}
                    <Route
                        path="/student/quizmon"
                        element={<StudentQuizMonHubPage />}
                    />

                    {/* QuizMon 샌드박스 */}
                    <Route
                        path="/dev/quizmon"
                        element={<QuizMonDevPage />}
                    />
                </Routes>
            </Suspense>
        </MainLayout>
    );
}

export default App;
