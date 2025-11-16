// src/components/teacher/TeacherQuizPackSection.tsx
type QuizPackRow = {
    id: string;
    title: string;
    subject: string | null;
    grade: string | null;
    created_at: string;
};

type TeacherQuizPackSummarySectionProps = {
    packs: QuizPackRow[];
    onClickOpenList: () => void;
    onClickCreate: () => void;
};

export function TeacherQuizPackSummarySection({
                                                  packs,
                                                  onClickOpenList,
                                                  onClickCreate,
                                              }: TeacherQuizPackSummarySectionProps) {
    const total = packs.length;

    return (
        <div className="card teacher-quizpacks">
            <div className="card-header flex justify-between items-center">
                <div>
                    <h2 className="card-title">퀴즈팩 관리</h2>
                    <p className="text-sm text-dim">
                        자주 쓰는 문제 묶음을 퀴즈팩으로 만들어두고 여러 반에서 재사용할 수 있습니다.
                    </p>
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-dim">
                    총 <strong>{total}</strong>개의 퀴즈팩이 있습니다.
                </div>
                <button className="secondary-btn" onClick={onClickOpenList}>
                    전체 목록 열기
                </button>
            </div>

            {packs.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm">
                    {packs.slice(0, 5).map((p) => (
                        <li key={p.id} className="flex justify-between">
              <span>
                {p.title}
                  {p.subject && (
                      <span className="text-dim"> · {p.subject}</span>
                  )}
              </span>
                            {p.grade && <span className="text-dim">{p.grade}</span>}
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-6">
                <button className="primary-btn full-width" onClick={onClickCreate}>
                    + 새 퀴즈팩 만들기
                </button>
            </div>
        </div>
    );
}
