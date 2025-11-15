// src/App.tsx
import { Routes, Route } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import { LandingPage } from "./pages/LandingPage";
import { TeacherHomePage } from "./pages/teacher/TeacherHomePage";
import { TeacherClassRoomsPage } from "./pages/teacher/TeacherClassRoomsPage";
import { StudentJoinPage } from "./pages/student/StudentJoinPage";
import { StudentRoomPage } from "./pages/student/StudentRoomPage";
import { QuizPackListPage } from "./pages/teacher/QuizPackListPage";
import { QuizPackEditorPage } from "./pages/teacher/QuizPackEditorPage";

// ▼ 새로 추가
import { TeacherRoomLivePage } from "./pages/teacher/TeacherRoomLivePage";

import { StudentPlayPackPage } from "./pages/student/StudentPlayPackPage";


function App() {
    return (
        <MainLayout>
            <Routes>
                <Route path="/" element={<LandingPage />} />

                <Route path="/teacher" element={<TeacherHomePage />} />
                <Route
                    path="/teacher/classes/:classId/rooms"
                    element={<TeacherClassRoomsPage />}
                />
                <Route path="/teacher/quiz-packs" element={<QuizPackListPage />} />
                <Route
                    path="/teacher/quiz-packs/:packId/edit"
                    element={<QuizPackEditorPage />}
                />

                {/* ▼ 새로 추가: 교사용 라이브 퀴즈 컨트롤 페이지 */}
                <Route
                    path="/teacher/rooms/:roomId/live"
                    element={<TeacherRoomLivePage />}
                />

                <Route path="/student" element={<StudentJoinPage />} />
                <Route path="/student/room/:roomId" element={<StudentRoomPage />} />
                <Route path="/student/play/:packId" element={<StudentPlayPackPage />} />
            </Routes>
        </MainLayout>
    );
}

export default App;
