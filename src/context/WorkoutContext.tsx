import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  Routine,
  WorkoutSession,
  PersonalRecord,
  LastExercisePerformance,
} from '../types/workout';
import { calculate1RM } from '../lib/calculations';
import { STARTER_ROUTINES } from '../lib/starterData';

interface WorkoutContextType {
  routines: Routine[];
  sessions: WorkoutSession[];
  personalRecords: Record<string, PersonalRecord>;
  loading: boolean;
  activeSession: ActiveSessionState | null;
  startActiveSession: (routine?: Routine) => void;
  cancelActiveSession: () => void;
  saveCompletedSession: (sessionData: CompletedSessionInput) => Promise<void>;
  createRoutine: (name: string, description: string, restDays: number, exercises: { name: string; muscle: string; targetSets: number }[]) => Promise<void>;
  deleteRoutine: (routineId: string) => Promise<void>;
  getLastPerformance: (exerciseName: string) => LastExercisePerformance | null;
  loadStarterRoutines: () => Promise<void>;
  refreshData: () => Promise<void>;
}

export interface ActiveSessionState {
  routineId?: string;
  routineName: string;
  startedAt: string;
  exercises: {
    exerciseId?: string;
    name: string;
    notes: string;
    targetSets: number;
    sets: { setNumber: number; weight: number; reps: number; isCompleted: boolean }[];
  }[];
}

export interface CompletedSessionInput {
  routineId?: string;
  routineName: string;
  startedAt: string;
  completedAt: string;
  sessionNotes: string;
  exercises: {
    exerciseId?: string;
    exerciseName: string;
    exerciseNotes: string;
    sets: { setNumber: number; weight: number; reps: number }[];
  }[];
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

const LOCAL_STORAGE_ROUTINES = 'strongtium_routines';
const LOCAL_STORAGE_SESSIONS = 'strongtium_sessions';

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isDemoMode } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [personalRecords, setPersonalRecords] = useState<Record<string, PersonalRecord>>({});
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<ActiveSessionState | null>(null);

  // Compute Personal Records from sessions
  const computePRs = useCallback((allSessions: WorkoutSession[]) => {
    const prMap: Record<string, PersonalRecord> = {};

    allSessions.forEach((s) => {
      s.logged_exercises?.forEach((le) => {
        const exName = le.exercise_name.trim();
        if (!exName) return;

        le.sets.forEach((set) => {
          const est1RM = calculate1RM(set.weight, set.reps);
          const currentPR = prMap[exName];

          if (!currentPR) {
            prMap[exName] = {
              exercise_name: exName,
              max_weight: set.weight,
              max_reps_at_max_weight: set.reps,
              best_estimated_1rm: est1RM,
              achieved_at: s.completed_at || s.started_at,
            };
          } else {
            let updated = false;
            let maxWeight = currentPR.max_weight;
            let maxReps = currentPR.max_reps_at_max_weight;
            let best1RM = currentPR.best_estimated_1rm;

            if (set.weight > maxWeight) {
              maxWeight = set.weight;
              maxReps = set.reps;
              updated = true;
            }
            if (est1RM > best1RM) {
              best1RM = est1RM;
              updated = true;
            }

            if (updated) {
              prMap[exName] = {
                exercise_name: exName,
                max_weight: maxWeight,
                max_reps_at_max_weight: maxReps,
                best_estimated_1rm: best1RM,
                achieved_at: s.completed_at || s.started_at,
              };
            }
          }
        });
      });
    });

    setPersonalRecords(prMap);
  }, []);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);

    if (isDemoMode || !user) {
      // Local storage fallback for demo
      const savedRoutines = localStorage.getItem(LOCAL_STORAGE_ROUTINES);
      const savedSessions = localStorage.getItem(LOCAL_STORAGE_SESSIONS);

      let rList: Routine[] = savedRoutines ? JSON.parse(savedRoutines) : [];
      let sList: WorkoutSession[] = savedSessions ? JSON.parse(savedSessions) : [];

      if (rList.length === 0) {
        // Initialize starter data in demo mode
        rList = STARTER_ROUTINES.map((r, idx) => ({
          ...r,
          id: `demo-routine-${idx + 1}`,
          user_id: 'demo-user',
          created_at: new Date().toISOString(),
          last_completed_at: idx === 0 ? new Date(Date.now() - 4 * 86400000).toISOString() : null, // Push is overdue
        }));
        localStorage.setItem(LOCAL_STORAGE_ROUTINES, JSON.stringify(rList));
      }

      setRoutines(rList);
      setSessions(sList);
      computePRs(sList);
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch Routines with exercises
      const { data: routinesData, error: routinesError } = await supabase
        .from('routines')
        .select(`
          id,
          user_id,
          name,
          description,
          target_rest_days,
          last_completed_at,
          order_index,
          created_at,
          routine_exercises (
            id,
            routine_id,
            exercise_id,
            target_sets,
            order_index,
            exercises (
              id,
              user_id,
              name,
              target_muscle_group,
              default_unit,
              created_at
            )
          )
        `)
        .order('order_index', { ascending: true });

      if (routinesError) throw routinesError;

      // Map Supabase nested structure to Routine interface
      const formattedRoutines: Routine[] = (routinesData || []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        name: r.name,
        description: r.description,
        target_rest_days: r.target_rest_days,
        last_completed_at: r.last_completed_at,
        order_index: r.order_index,
        created_at: r.created_at,
        exercises: (r.routine_exercises || [])
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((re: any) => ({
            id: re.id,
            routine_id: re.routine_id,
            exercise_id: re.exercise_id,
            target_sets: re.target_sets,
            order_index: re.order_index,
            exercise: re.exercises,
          })),
      }));

      // 2. Fetch Workout Sessions with logged exercises and sets
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select(`
          id,
          user_id,
          routine_id,
          routine_name,
          started_at,
          completed_at,
          session_notes,
          logged_exercises (
            id,
            session_id,
            exercise_id,
            exercise_name,
            exercise_notes,
            order_index,
            logged_sets (
              id,
              logged_exercise_id,
              set_number,
              weight,
              reps,
              is_pr,
              created_at
            )
          )
        `)
        .order('completed_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      const formattedSessions: WorkoutSession[] = (sessionsData || []).map((s: any) => ({
        id: s.id,
        user_id: s.user_id,
        routine_id: s.routine_id,
        routine_name: s.routine_name,
        started_at: s.started_at,
        completed_at: s.completed_at,
        session_notes: s.session_notes,
        logged_exercises: (s.logged_exercises || [])
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((le: any) => ({
            id: le.id,
            session_id: le.session_id,
            exercise_id: le.exercise_id,
            exercise_name: le.exercise_name,
            exercise_notes: le.exercise_notes,
            order_index: le.order_index,
            sets: (le.logged_sets || []).sort((a: any, b: any) => a.set_number - b.set_number),
          })),
      }));

      setRoutines(formattedRoutines);
      setSessions(formattedSessions);
      computePRs(formattedSessions);
    } catch (err) {
      console.error('Error fetching Supabase workout data:', err);
      // Fallback to local storage if network or DB tables not initialized yet
      const savedRoutines = localStorage.getItem(LOCAL_STORAGE_ROUTINES);
      const savedSessions = localStorage.getItem(LOCAL_STORAGE_SESSIONS);
      if (savedRoutines) setRoutines(JSON.parse(savedRoutines));
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        setSessions(parsed);
        computePRs(parsed);
      }
    } finally {
      setLoading(false);
    }
  }, [user, isDemoMode, computePRs]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Find last performance for an exercise
  const getLastPerformance = useCallback(
    (exerciseName: string): LastExercisePerformance | null => {
      const cleanName = exerciseName.trim().toLowerCase();
      if (!cleanName) return null;

      for (const session of sessions) {
        if (!session.completed_at) continue;
        const matchingEx = session.logged_exercises?.find(
          (le) => le.exercise_name.trim().toLowerCase() === cleanName
        );

        if (matchingEx && matchingEx.sets.length > 0) {
          const sets = matchingEx.sets.map((s) => ({
            set_number: s.set_number,
            weight: Number(s.weight),
            reps: Number(s.reps),
          }));

          const maxWeight = Math.max(...sets.map((s) => s.weight));
          const best1RM = Math.max(...sets.map((s) => calculate1RM(s.weight, s.reps)));

          return {
            exercise_name: matchingEx.exercise_name,
            last_performed_at: session.completed_at,
            notes: matchingEx.exercise_notes,
            sets,
            best_estimated_1rm: best1RM,
            max_weight: maxWeight,
          };
        }
      }
      return null;
    },
    [sessions]
  );

  // Start an active workout session
  const startActiveSession = (routine?: Routine) => {
    if (routine) {
      const initialExercises = (routine.exercises || []).map((re) => {
        const lastPerf = getLastPerformance(re.exercise?.name || '');
        const targetSetsCount = re.target_sets || 3;

        const defaultSets = Array.from({ length: targetSetsCount }, (_, i) => {
          const lastSet = lastPerf?.sets[i] || lastPerf?.sets[lastPerf.sets.length - 1];
          return {
            setNumber: i + 1,
            weight: lastSet ? lastSet.weight : 0,
            reps: lastSet ? lastSet.reps : 0,
            isCompleted: false,
          };
        });

        return {
          exerciseId: re.exercise_id,
          name: re.exercise?.name || 'Exercise',
          notes: '',
          targetSets: targetSetsCount,
          sets: defaultSets,
        };
      });

      setActiveSession({
        routineId: routine.id,
        routineName: routine.name,
        startedAt: new Date().toISOString(),
        exercises: initialExercises,
      });
    } else {
      // Freeform workout
      setActiveSession({
        routineName: 'Custom Workout',
        startedAt: new Date().toISOString(),
        exercises: [],
      });
    }
  };

  const cancelActiveSession = () => {
    setActiveSession(null);
  };

  // Save completed workout session
  const saveCompletedSession = async (input: CompletedSessionInput) => {
    setLoading(true);

    if (isDemoMode || !user) {
      // Save locally
      const newSession: WorkoutSession = {
        id: `session-${Date.now()}`,
        user_id: user?.id || 'demo-user',
        routine_id: input.routineId,
        routine_name: input.routineName,
        started_at: input.startedAt,
        completed_at: input.completedAt,
        session_notes: input.sessionNotes,
        logged_exercises: input.exercises.map((e, eIdx) => ({
          id: `le-${Date.now()}-${eIdx}`,
          session_id: `session-${Date.now()}`,
          exercise_id: e.exerciseId,
          exercise_name: e.exerciseName,
          exercise_notes: e.exerciseNotes,
          order_index: eIdx,
          sets: e.sets.map((s) => ({
            id: `set-${Date.now()}-${s.setNumber}`,
            logged_exercise_id: `le-${Date.now()}-${eIdx}`,
            set_number: s.setNumber,
            weight: s.weight,
            reps: s.reps,
            created_at: new Date().toISOString(),
          })),
        })),
      };

      const updatedSessions = [newSession, ...sessions];
      setSessions(updatedSessions);
      localStorage.setItem(LOCAL_STORAGE_SESSIONS, JSON.stringify(updatedSessions));

      // Update routine last_completed_at
      if (input.routineId) {
        const updatedRoutines = routines.map((r) =>
          r.id === input.routineId ? { ...r, last_completed_at: input.completedAt } : r
        );
        setRoutines(updatedRoutines);
        localStorage.setItem(LOCAL_STORAGE_ROUTINES, JSON.stringify(updatedRoutines));
      }

      computePRs(updatedSessions);
      setActiveSession(null);
      setLoading(false);
      return;
    }

    try {
      // 1. Insert Workout Session
      const { data: sessionData, error: sessionErr } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: user.id,
          routine_id: input.routineId || null,
          routine_name: input.routineName,
          started_at: input.startedAt,
          completed_at: input.completedAt,
          session_notes: input.sessionNotes || null,
        })
        .select()
        .single();

      if (sessionErr) throw sessionErr;

      // 2. Insert Logged Exercises & Sets
      for (let i = 0; i < input.exercises.length; i++) {
        const ex = input.exercises[i];
        const { data: exData, error: exErr } = await supabase
          .from('logged_exercises')
          .insert({
            session_id: sessionData.id,
            exercise_id: ex.exerciseId || null,
            exercise_name: ex.exerciseName,
            exercise_notes: ex.exerciseNotes || null,
            order_index: i,
          })
          .select()
          .single();

        if (exErr) throw exErr;

        if (ex.sets.length > 0) {
          const setsPayload = ex.sets.map((s) => ({
            logged_exercise_id: exData.id,
            set_number: s.setNumber,
            weight: s.weight,
            reps: s.reps,
          }));

          const { error: setsErr } = await supabase.from('logged_sets').insert(setsPayload);
          if (setsErr) throw setsErr;
        }
      }

      // 3. Update Routine last_completed_at
      if (input.routineId) {
        await supabase
          .from('routines')
          .update({ last_completed_at: input.completedAt })
          .eq('id', input.routineId);
      }

      // Refresh all data
      await fetchData();
      setActiveSession(null);
    } catch (err) {
      console.error('Failed to save workout session to Supabase:', err);
      // Fallback save to local storage
      const newSession: WorkoutSession = {
        id: `session-${Date.now()}`,
        user_id: user.id,
        routine_id: input.routineId,
        routine_name: input.routineName,
        started_at: input.startedAt,
        completed_at: input.completedAt,
        session_notes: input.sessionNotes,
        logged_exercises: input.exercises.map((e, eIdx) => ({
          id: `le-${Date.now()}-${eIdx}`,
          session_id: `session-${Date.now()}`,
          exercise_id: e.exerciseId,
          exercise_name: e.exerciseName,
          exercise_notes: e.exerciseNotes,
          order_index: eIdx,
          sets: e.sets.map((s) => ({
            id: `set-${Date.now()}-${s.setNumber}`,
            logged_exercise_id: `le-${Date.now()}-${eIdx}`,
            set_number: s.setNumber,
            weight: s.weight,
            reps: s.reps,
            created_at: new Date().toISOString(),
          })),
        })),
      };
      setSessions([newSession, ...sessions]);
      setActiveSession(null);
    } finally {
      setLoading(false);
    }
  };

  // Create Custom Routine
  const createRoutine = async (
    name: string,
    description: string,
    restDays: number,
    exerciseInputs: { name: string; muscle: string; targetSets: number }[]
  ) => {
    if (isDemoMode || !user) {
      const newRoutine: Routine = {
        id: `custom-routine-${Date.now()}`,
        user_id: 'demo-user',
        name,
        description,
        target_rest_days: restDays,
        order_index: routines.length,
        created_at: new Date().toISOString(),
        exercises: exerciseInputs.map((e, idx) => ({
          id: `re-${Date.now()}-${idx}`,
          routine_id: `custom-routine-${Date.now()}`,
          exercise_id: `ex-${Date.now()}-${idx}`,
          target_sets: e.targetSets,
          order_index: idx,
          exercise: {
            id: `ex-${Date.now()}-${idx}`,
            user_id: 'demo-user',
            name: e.name,
            target_muscle_group: e.muscle,
            default_unit: 'kg',
            created_at: new Date().toISOString(),
          },
        })),
      };

      const updated = [...routines, newRoutine];
      setRoutines(updated);
      localStorage.setItem(LOCAL_STORAGE_ROUTINES, JSON.stringify(updated));
      return;
    }

    try {
      // 1. Insert Routine
      const { data: routineData, error: routineErr } = await supabase
        .from('routines')
        .insert({
          user_id: user.id,
          name,
          description,
          target_rest_days: restDays,
          order_index: routines.length,
        })
        .select()
        .single();

      if (routineErr) throw routineErr;

      // 2. Insert or find exercises and link to routine
      for (let i = 0; i < exerciseInputs.length; i++) {
        const item = exerciseInputs[i];
        
        // Find existing exercise or create new
        let exerciseId = '';
        const { data: existingEx } = await supabase
          .from('exercises')
          .select('id')
          .eq('user_id', user.id)
          .ilike('name', item.name.trim())
          .maybeSingle();

        if (existingEx) {
          exerciseId = existingEx.id;
        } else {
          const { data: newEx, error: newExErr } = await supabase
            .from('exercises')
            .insert({
              user_id: user.id,
              name: item.name.trim(),
              target_muscle_group: item.muscle || 'General',
              default_unit: 'kg',
            })
            .select()
            .single();

          if (newExErr) throw newExErr;
          exerciseId = newEx.id;
        }

        // Link to routine_exercises
        await supabase.from('routine_exercises').insert({
          routine_id: routineData.id,
          exercise_id: exerciseId,
          target_sets: item.targetSets,
          order_index: i,
        });
      }

      await fetchData();
    } catch (err) {
      console.error('Error creating routine in Supabase:', err);
    }
  };

  // Delete Routine
  const deleteRoutine = async (routineId: string) => {
    if (isDemoMode || !user) {
      const updated = routines.filter((r) => r.id !== routineId);
      setRoutines(updated);
      localStorage.setItem(LOCAL_STORAGE_ROUTINES, JSON.stringify(updated));
      return;
    }

    try {
      await supabase.from('routines').delete().eq('id', routineId);
      await fetchData();
    } catch (err) {
      console.error('Error deleting routine:', err);
    }
  };

  // Load starter routines for new user
  const loadStarterRoutines = async () => {
    for (const starter of STARTER_ROUTINES) {
      const exerciseList = (starter.exercises || []).map((e) => ({
        name: e.exercise?.name || 'Exercise',
        muscle: e.exercise?.target_muscle_group || 'General',
        targetSets: e.target_sets || 3,
      }));
      await createRoutine(starter.name, starter.description || '', starter.target_rest_days, exerciseList);
    }
  };

  return (
    <WorkoutContext.Provider
      value={{
        routines,
        sessions,
        personalRecords,
        loading,
        activeSession,
        startActiveSession,
        cancelActiveSession,
        saveCompletedSession,
        createRoutine,
        deleteRoutine,
        getLastPerformance,
        loadStarterRoutines,
        refreshData: fetchData,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
};

export const useWorkout = () => {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error('useWorkout must be used within a WorkoutProvider');
  }
  return context;
};
