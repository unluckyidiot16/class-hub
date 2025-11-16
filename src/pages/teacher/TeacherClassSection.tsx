// src/components/teacher/TeacherClassSection.tsx
type ClassRow = {
    id: string;
    name: string;
    grade: string | null;
    created_at: string;
};

type TeacherClassListSectionProps = {
    classes: ClassRow[];
    onClickCreate: () => void;
    onClickOpenRooms: (classId: string) => void;
};

export function TeacherClassListSection({
                                            classes,
                                            onClickCreate,
                                            onClickOpenRooms,
                                        }: TeacherClassListSectionProps) {
    return (
        <div className="card teacher-classes">
            <div className="card-header flex justify-between items-center">
                <div>
                    <h2 className="card-title">내 반 목록</h2>
                    <p className="text-sm text-dim">
                        학급을 만들어 두면 각 반에 수업용 방과 퀴즈팩을 연결할 수 있습니다.
                    </p>
                </div>
                <button
                    type="button"
                    className="primary-btn"
                    onClick={onClickCreate}
                >
                    + 새 반 추가
                </button>
            </div>

            {classes.length === 0 ? (
                <p className="mt-4 text-sm text-dim">
                    아직 만든 반이 없습니다. <strong>“새 반 추가”</strong> 버튼을 눌러 첫 반을
                    만들어 보세요.
                </p>
            ) : (
                <ul className="mt-4 divide-y">
                    {classes.map((cls) => (
                        <li
                            key={cls.id}
                            className="py-3 flex items-center justify-between gap-4"
                        >
                            <div>
                                <div className="font-medium">{cls.name}</div>
                                {cls.grade && (
                                    <div className="text-xs text-dim">학년/설명: {cls.grade}</div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    className="secondary-btn"
                                    type="button"
                                    onClick={() => onClickOpenRooms(cls.id)}
                                >
                                    방 관리
                                </button>
                                {/* 삭제 버튼은 기존 TeacherHomePage 로직 그대로 옮기면 됨 */}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
