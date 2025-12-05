// src/games/quizmon/QuizmonProvider.tsx
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { supabase } from "../../lib/supabaseClient";
import {
    useQuizmonProfile,
    type UseQuizmonProfileResult,
} from "./useQuizmonProfile";
import type { QuizmonOwnedMonsterRow } from "./types";
import { healAllMonstersService } from "./quizmonService";

// useQuizmonProfile 훅의 반환값에서 프로필/함수 타입 추론
type QuizmonProfile = UseQuizmonProfileResult["profile"];
type QuizmonProfileError = UseQuizmonProfileResult["error"];
type ApplyRaidResultFn = UseQuizmonProfileResult["applyRaidResult"];
type ChooseStarterFn = (payload: {
    speciesId: string;
    trainerName: string;
}) => Promise<void>;
type BuyExpDustFn = UseQuizmonProfileResult["buyExpDust"];



export type QuizmonContextValue = {
    profile: QuizmonProfile;
    profileLoading: boolean;
    profileError: QuizmonProfileError;
    applyRaidResult: ApplyRaidResultFn;
    chooseStarter: ChooseStarterFn;

    monsters: QuizmonOwnedMonsterRow[];
    collectionLoading: boolean;
    collectionError: string | null;
    refreshMonsters: () => Promise<void>;
    healAllMonsters: () => Promise<void>;
    buyExpDust: BuyExpDustFn; 
};


const QuizmonContext = createContext<QuizmonContextValue | undefined>(
    undefined,
);

type QuizmonProviderProps = {
    classId: string | null;
    studentId: string | null;
    children: ReactNode;
};

export function QuizmonProvider({
                                    classId,
                                    studentId,
                                    children,
                                }: QuizmonProviderProps) {
    const isStudent = !!studentId;

    const {
        profile,
        loading: profileLoading,
        error: profileError,
        applyRaidResult,
        chooseStarter,   // ← 이제 payload 버전으로 들어옴
        buyExpDust,
    } = useQuizmonProfile({
        classId,
        studentKey: studentId,
    });

    const [monsters, setMonsters] = useState<QuizmonOwnedMonsterRow[]>([]);
    const [collectionLoading, setCollectionLoading] = useState(false);
    const [collectionError, setCollectionError] = useState<string | null>(null);
    const refreshingRef = useRef(false);

    /**
     * 보유 몬스터 컬렉션 로딩
     * - 기존 owned_monsters가 없고, profile.partner / starter_species_id 만 있는
     *   예전 데이터도 자동으로 마이그레이션해 줌.
     */
    const refreshMonsters = useCallback(async () => {
        if (!profile?.id || !isStudent) {
            setMonsters([]);
            setCollectionLoading(false);
            setCollectionError(null);
            return;
        }
        if (refreshingRef.current) return;

        refreshingRef.current = true;
        setCollectionLoading(true);
        setCollectionError(null);

        try {
            let rows: QuizmonOwnedMonsterRow[] = [];

            // 1) 현재 프로필 기준 owned_monsters 조회
            const { data, error } = await supabase
                .from("quizmon_owned_monsters")
                .select("*")
                .eq("profile_id", profile.id)
                .order("created_at", { ascending: true });

            if (error) {
                console.error(
                    "[QuizmonProvider] refreshMonsters error",
                    error,
                );
                setCollectionError(
                    "보유 몬스터를 불러오는 중 오류가 발생했습니다.",
                );
                setMonsters([]);
                return;
            }

            rows = (data ?? []) as QuizmonOwnedMonsterRow[];

            // 2) 마이그레이션: owned_monsters가 비었는데
            //    profile.partner / starter_species_id 가 있으면
            //    starter 개체를 1마리 생성해 준다.
            if (!rows.length && profile) {
                const anyProfile = profile as any;
                const fallbackSpeciesId =
                    (anyProfile.partner as string | null) ??
                    (anyProfile.starter_species_id as string | null) ??
                    null;

                if (fallbackSpeciesId) {
                    const { data: inserted, error: insertError } =
                        await supabase
                            .from("quizmon_owned_monsters")
                            .insert({
                                profile_id: profile.id,
                                species_id: fallbackSpeciesId,
                                level: 1,
                                exp: 0,
                                party_slot: 1,
                                current_hp: null,
                                is_fainted: false,
                                learned_moves: [] as string[],
                            })
                            .select("*")
                            .single();

                    if (insertError) {
                        console.error(
                            "[QuizmonProvider] create starter owned_monster error",
                            insertError,
                        );
                    } else if (inserted) {
                        rows = [inserted as QuizmonOwnedMonsterRow];
                    }
                }
            }

            setMonsters(rows);
        } finally {
            refreshingRef.current = false;
            setCollectionLoading(false);
        }
    }, [profile, isStudent]);

    // 🔹 학생 프로필이 준비되면 1회 자동 로딩
    useEffect(() => {
        void refreshMonsters();
    }, [refreshMonsters]);

    /**
     * 모든 보유 몬스터 전체 회복
     */

    const healAllMonsters = useCallback(async () => {
        if (!profile?.id || !isStudent) return;

        setCollectionError(null);
        setCollectionLoading(true);
        try {
            await healAllMonstersService(profile.id);   // ✅ 파티 전체 회복
            await refreshMonsters();
        } catch (e) {
            console.error("[QuizmonProvider] healAllMonsters error", e);
            let message = "몬스터를 회복하는 중 오류가 발생했습니다.";
            if (e instanceof Error && e.message) {
                message = e.message;
            }
            setCollectionError(message);
        } finally {
            setCollectionLoading(false);
        }
        // 👇 여기만 수정
    }, [profile, isStudent, refreshMonsters]);




    const value: QuizmonContextValue = {
        profile,
        profileLoading,
        profileError,
        applyRaidResult,
        chooseStarter,
        monsters,
        collectionLoading,
        collectionError,
        refreshMonsters,
        healAllMonsters,
        buyExpDust,
    };

    return (
        <QuizmonContext.Provider value={value}>
            {children}
        </QuizmonContext.Provider>
    );
}

export function useQuizmonContext() {
    const ctx = useContext(QuizmonContext);
    if (!ctx) {
        throw new Error(
            "useQuizmonContext는 QuizmonProvider 안에서만 사용해야 합니다.",
        );
    }
    return ctx;
}
