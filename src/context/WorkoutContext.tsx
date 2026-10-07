import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  Routine,
  WorkoutSession,
  PersonalRecord,
  LastExercisePerformance,
  LogExercisePayload,
} from '../types/workout';
import { calculate1RM } from '../lib/calculations';
import { STARTER_ROUTINES } from '../lib/starterData';

export interface ExerciseHistoryEntry {
  sessionId: string;
  sessionName: string;
  completedAt: string;
  notes?: string;
  sets: { setNumber: number; weight: number; reps: number }[];
  maxWeight: number;
  bestEstimated1RM: number;
  totalVolume: number;
}

export interface TodayActivitySummary {
  exerciseName: string;
  routineName?: string;
  setsCount: number;
  maxWeight: number;
  totalVolume: number;
  lastLoggedAt: string;
}

interface WorkoutContextType {
  routines: Routine[];
  sessions: WorkoutSession[];
  personalRecords: Record<string, PersonalRecord>;
  loading: boolean;
  logExerciseSets: (payload: LogExercisePayload) => Promise<void>;
  getExerciseHistory: (exerciseName: string) => ExerciseHistoryEntry[];
  getLastPerformance: (exerciseName: string) => LastExercisePerformance | null;
  getTodayLoggedSetsCount: (exerciseName?: string) => number;
  getTodayActivity: () => TodayActivitySummary[];
  markRoutineCompleted: (routineId: string) => Promise<void>;
  createRoutine: (name: string, description: string, restDays: number, exercises: { name: string; muscle: string; targetSets: number }[]) => Promise<void>;
  updateRoutine: (routineId: string, name: string, description: string, restDays: number, exercises: { name: string; muscle: string; targetSets: number }[]) => Promise<void>;
  addOrUpdateExerciseToRoutine: (routineId: string, exerciseName: string, muscle: string, targetSets: number) => Promise<void>;
  removeExerciseFromRoutine: (routineId: string, exerciseIndex: number) => Promise<void>;
  bulkSaveRoutines: (newRoutines: { name: string; description?: string; targetRestDays: number; exercises: { name: string; muscle: string; targetSets: number }[] }[]) => Promise<void>;
  deleteRoutine: (routineId: string) => Promise<void>;
  loadStarterRoutines: () => Promise<void>;
  refreshData: () => Promise<void>;
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

  // Get full history for a specific exercise
  const getExerciseHistory = useCallback(
    (exerciseName: string): ExerciseHistoryEntry[] => {
      const cleanName = exerciseName.trim().toLowerCase();
      if (!cleanName) return [];

      const history: ExerciseHistoryEntry[] = [];

      sessions.forEach((s) => {
        if (!s.completed_at) return;
        const match = s.logged_exercises?.find(
          (le) => le.exercise_name.trim().toLowerCase() === cleanName
        );

        if (match && match.sets.length > 0) {
          const sets = match.sets.map((st) => ({
            setNumber: st.set_number,
            weight: Number(st.weight),
            reps: Number(st.reps),
          }));
          const maxW = Math.max(...sets.map((st) => st.weight));
          const best1RM = Math.max(...sets.map((st) => calculate1RM(st.weight, st.reps)));
          const totalVol = sets.reduce((sum, st) => sum + st.weight * st.reps, 0);

          history.push({
            sessionId: s.id,
            sessionName: s.routine_name,
            completedAt: s.completed_at,
            notes: match.exercise_notes,
            sets,
            maxWeight: maxW,
            bestEstimated1RM: best1RM,
            totalVolume: totalVol,
          });
        }
      });

      return history;
    },
    [sessions]
  );

  // Get count of sets logged today (for a specific exercise or across all)
  const getTodayLoggedSetsCount = useCallback(
    (exerciseName?: string): number => {
      const todayStr = new Date().toDateString();
      const cleanName = exerciseName ? exerciseName.trim().toLowerCase() : null;
      let count = 0;

      sessions.forEach((s) => {
        if (!s.completed_at) return;
        if (new Date(s.completed_at).toDateString() !== todayStr) return;

        s.logged_exercises?.forEach((le) => {
          if (!cleanName || le.exercise_name.trim().toLowerCase() === cleanName) {
            count += le.sets.length;
          }
        });
      });

      return count;
    },
    [sessions]
  );

  // Get summary of today's logged activity
  const getTodayActivity = useCallback((): TodayActivitySummary[] => {
    const todayStr = new Date().toDateString();
    const map: Record<string, TodayActivitySummary> = {};

    sessions.forEach((s) => {
      if (!s.completed_at) return;
      if (new Date(s.completed_at).toDateString() !== todayStr) return;

      s.logged_exercises?.forEach((le) => {
        const name = le.exercise_name.trim();
        if (!name) return;

        const vol = le.sets.reduce((acc, st) => acc + Number(st.weight) * Number(st.reps), 0);
        const maxW = Math.max(0, ...le.sets.map((st) => Number(st.weight)));

        if (!map[name]) {
          map[name] = {
            exerciseName: name,
            routineName: s.routine_name,
            setsCount: le.sets.length,
            maxWeight: maxW,
            totalVolume: vol,
            lastLoggedAt: s.completed_at!,
          };
        } else {
          map[name].setsCount += le.sets.length;
          map[name].totalVolume += vol;
          map[name].maxWeight = Math.max(map[name].maxWeight, maxW);
          map[name].lastLoggedAt = s.completed_at!;
        }
      });
    });

    return Object.values(map);
  }, [sessions]);

  // Log exercise sets directly (free-flowing on-demand logging)
  const logExerciseSets = async (payload: LogExercisePayload) => {
    const validSets = payload.sets.filter((s) => s.weight > 0 || s.reps > 0);
    if (validSets.length === 0) return;

    const timestamp = payload.loggedAt || new Date().toISOString();
    const todayStr = new Date(timestamp).toDateString();

    if (isDemoMode || !user) {
      // Find today's session or create one
      const existingSessionIndex = sessions.findIndex(
        (s) => s.completed_at && new Date(s.completed_at).toDateString() === todayStr
      );

      let updatedSessions = [...sessions];
      const newLoggedEx = {
        id: `le-${Date.now()}`,
        session_id: '',
        exercise_id: payload.exerciseId,
        exercise_name: payload.exerciseName,
        exercise_notes: payload.exerciseNotes,
        order_index: 0,
        sets: validSets.map((s, idx) => ({
          id: `set-${Date.now()}-${idx + 1}`,
          logged_exercise_id: `le-${Date.now()}`,
          set_number: s.setNumber || idx + 1,
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
          created_at: timestamp,
        })),
      };

      if (existingSessionIndex >= 0) {
        const existingSession = { ...updatedSessions[existingSessionIndex] };
        newLoggedEx.session_id = existingSession.id;
        newLoggedEx.order_index = (existingSession.logged_exercises?.length || 0);

        // Replace or append logged exercise
        const existingExIdx = existingSession.logged_exercises?.findIndex(
          (e) => e.exercise_name.trim().toLowerCase() === payload.exerciseName.trim().toLowerCase()
        );

        let updatedLoggedExercises = [...(existingSession.logged_exercises || [])];
        if (existingExIdx !== undefined && existingExIdx >= 0) {
          // Update sets and notes for this exercise today
          updatedLoggedExercises[existingExIdx] = {
            ...updatedLoggedExercises[existingExIdx],
            exercise_notes: payload.exerciseNotes || updatedLoggedExercises[existingExIdx].exercise_notes,
            sets: validSets.map((s, idx) => ({
              id: `set-${Date.now()}-${idx + 1}`,
              logged_exercise_id: updatedLoggedExercises[existingExIdx].id,
              set_number: s.setNumber || idx + 1,
              weight: Number(s.weight) || 0,
              reps: Number(s.reps) || 0,
              created_at: timestamp,
            })),
          };
        } else {
          updatedLoggedExercises.push(newLoggedEx);
        }

        existingSession.logged_exercises = updatedLoggedExercises;
        existingSession.completed_at = timestamp;
        if (payload.routineName && (!existingSession.routine_name || existingSession.routine_name === 'Daily Workout')) {
          existingSession.routine_name = payload.routineName;
          existingSession.routine_id = payload.routineId;
        }

        updatedSessions[existingSessionIndex] = existingSession;
      } else {
        const newSession: WorkoutSession = {
          id: `session-${Date.now()}`,
          user_id: user?.id || 'demo-user',
          routine_id: payload.routineId,
          routine_name: payload.routineName || 'Daily Workout',
          started_at: timestamp,
          completed_at: timestamp,
          session_notes: '',
          logged_exercises: [newLoggedEx],
        };
        newLoggedEx.session_id = newSession.id;
        updatedSessions = [newSession, ...updatedSessions];
      }

      setSessions(updatedSessions);
      localStorage.setItem(LOCAL_STORAGE_SESSIONS, JSON.stringify(updatedSessions));

      // Update routine last_completed_at if routineId provided
      if (payload.routineId) {
        const updatedRoutines = routines.map((r) =>
          r.id === payload.routineId ? { ...r, last_completed_at: timestamp } : r
        );
        setRoutines(updatedRoutines);
        localStorage.setItem(LOCAL_STORAGE_ROUTINES, JSON.stringify(updatedRoutines));
      }

      computePRs(updatedSessions);
      return;
    }

    try {
      // 1. Ensure exercise exists in DB
      let exerciseId = payload.exerciseId;
      if (!exerciseId) {
        const { data: existingEx } = await supabase
          .from('exercises')
          .select('id')
          .eq('user_id', user.id)
          .ilike('name', payload.exerciseName.trim())
          .maybeSingle();

        if (existingEx) {
          exerciseId = existingEx.id;
        } else {
          const { data: newEx } = await supabase
            .from('exercises')
            .insert({
              user_id: user.id,
              name: payload.exerciseName.trim(),
              target_muscle_group: payload.targetMuscleGroup || 'General',
              default_unit: 'kg',
            })
            .select()
            .single();

          if (newEx) exerciseId = newEx.id;
        }
      }

      // 2. Create or find today's session
      // Query if a session exists today
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const { data: existingSessions } = await supabase
        .from('workout_sessions')
        .select('id, routine_id, routine_name')
        .eq('user_id', user.id)
        .gte('completed_at', todayStart)
        .order('completed_at', { ascending: false })
        .limit(1);

      let sessionId = existingSessions && existingSessions.length > 0 ? existingSessions[0].id : null;

      if (!sessionId) {
        const { data: newSession, error: sErr } = await supabase
          .from('workout_sessions')
          .insert({
            user_id: user.id,
            routine_id: payload.routineId || null,
            routine_name: payload.routineName || 'Daily Workout',
            started_at: timestamp,
            completed_at: timestamp,
          })
          .select()
          .single();

        if (sErr) throw sErr;
        sessionId = newSession.id;
      }

      // 3. Insert logged exercise & sets
      const { data: exRow, error: exErr } = await supabase
        .from('logged_exercises')
        .insert({
          session_id: sessionId,
          exercise_id: exerciseId || null,
          exercise_name: payload.exerciseName.trim(),
          exercise_notes: payload.exerciseNotes || null,
          order_index: 0,
        })
        .select()
        .single();

      if (exErr) throw exErr;

      const setsPayload = validSets.map((s, idx) => ({
        logged_exercise_id: exRow.id,
        set_number: s.setNumber || idx + 1,
        weight: Number(s.weight) || 0,
        reps: Number(s.reps) || 0,
      }));

      const { error: setsErr } = await supabase.from('logged_sets').insert(setsPayload);
      if (setsErr) throw setsErr;

      // 4. Update routine last_completed_at if routineId
      if (payload.routineId) {
        await supabase
          .from('routines')
          .update({ last_completed_at: timestamp })
          .eq('id', payload.routineId);
      }

      await fetchData();
    } catch (err) {
      console.error('Error in logExerciseSets:', err);
      // Fallback save to local storage
      const updatedSessions = [...sessions];
      setSessions(updatedSessions);
    }
  };

  // Mark a routine as completed for rotation
  const markRoutineCompleted = async (routineId: string) => {
    const timestamp = new Date().toISOString();
    if (isDemoMode || !user) {
      const updatedRoutines = routines.map((r) =>
        r.id === routineId ? { ...r, last_completed_at: timestamp } : r
      );
      setRoutines(updatedRoutines);
      localStorage.setItem(LOCAL_STORAGE_ROUTINES, JSON.stringify(updatedRoutines));
      return;
    }

    try {
      await supabase.from('routines').update({ last_completed_at: timestamp }).eq('id', routineId);
      await fetchData();
    } catch (err) {
      console.error('Error marking routine completed:', err);
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

      for (let i = 0; i < exerciseInputs.length; i++) {
        const item = exerciseInputs[i];
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

  // Update Existing Routine
  const updateRoutine = async (
    routineId: string,
    name: string,
    description: string,
    restDays: number,
    exerciseInputs: { name: string; muscle: string; targetSets: number }[]
  ) => {
    if (isDemoMode || !user) {
      const updated = routines.map((r) => {
        if (r.id !== routineId) return r;
        return {
          ...r,
          name,
          description,
          target_rest_days: restDays,
          exercises: exerciseInputs.map((e, idx) => ({
            id: `re-${Date.now()}-${idx}`,
            routine_id: routineId,
            exercise_id: `ex-${Date.now()}-${idx}`,
            target_sets: e.targetSets,
            order_index: idx,
            exercise: {
              id: `ex-${Date.now()}-${idx}`,
              user_id: 'demo-user',
              name: e.name,
              target_muscle_group: e.muscle,
              default_unit: 'kg' as const,
              created_at: new Date().toISOString(),
            },
          })),
        };
      });

      setRoutines(updated);
      localStorage.setItem(LOCAL_STORAGE_ROUTINES, JSON.stringify(updated));
      return;
    }

    try {
      // 1. Update Routine details
      const { error: routineErr } = await supabase
        .from('routines')
        .update({
          name,
          description,
          target_rest_days: restDays,
        })
        .eq('id', routineId);

      if (routineErr) throw routineErr;

      // 2. Delete existing routine_exercises
      await supabase.from('routine_exercises').delete().eq('routine_id', routineId);

      // 3. Re-insert exercises
      for (let i = 0; i < exerciseInputs.length; i++) {
        const item = exerciseInputs[i];
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

        await supabase.from('routine_exercises').insert({
          routine_id: routineId,
          exercise_id: exerciseId,
          target_sets: item.targetSets,
          order_index: i,
        });
      }

      await fetchData();
    } catch (err) {
      console.error('Error updating routine in Supabase:', err);
    }
  };

  // Add or update an individual exercise inside a routine
  const addOrUpdateExerciseToRoutine = async (
    routineId: string,
    exerciseName: string,
    muscle: string,
    targetSets: number
  ) => {
    const routine = routines.find((r) => r.id === routineId);
    if (!routine) return;

    const existingExercises = (routine.exercises || []).map((re) => ({
      name: re.exercise?.name || 'Exercise',
      muscle: re.exercise?.target_muscle_group || 'General',
      targetSets: re.target_sets || 3,
    }));

    const existingIdx = existingExercises.findIndex(
      (e) => e.name.trim().toLowerCase() === exerciseName.trim().toLowerCase()
    );

    if (existingIdx >= 0) {
      existingExercises[existingIdx] = {
        name: exerciseName.trim(),
        muscle,
        targetSets,
      };
    } else {
      existingExercises.push({
        name: exerciseName.trim(),
        muscle,
        targetSets,
      });
    }

    await updateRoutine(
      routine.id,
      routine.name,
      routine.description || '',
      routine.target_rest_days || 3,
      existingExercises
    );
  };

  // Remove an exercise from a routine
  const removeExerciseFromRoutine = async (routineId: string, exerciseIndex: number) => {
    const routine = routines.find((r) => r.id === routineId);
    if (!routine || !routine.exercises) return;

    const remainingExercises = routine.exercises
      .filter((_, idx) => idx !== exerciseIndex)
      .map((re) => ({
        name: re.exercise?.name || 'Exercise',
        muscle: re.exercise?.target_muscle_group || 'General',
        targetSets: re.target_sets || 3,
      }));

    await updateRoutine(
      routine.id,
      routine.name,
      routine.description || '',
      routine.target_rest_days || 3,
      remainingExercises
    );
  };

  // Bulk save / replace routines
  const bulkSaveRoutines = async (
    newRoutines: {
      name: string;
      description?: string;
      targetRestDays: number;
      exercises: { name: string; muscle: string; targetSets: number }[];
    }[]
  ) => {
    for (const r of newRoutines) {
      const existing = routines.find(
        (er) => er.name.trim().toLowerCase() === r.name.trim().toLowerCase()
      );
      if (existing) {
        await updateRoutine(
          existing.id,
          r.name,
          r.description || '',
          r.targetRestDays,
          r.exercises
        );
      } else {
        await createRoutine(
          r.name,
          r.description || '',
          r.targetRestDays,
          r.exercises
        );
      }
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
        logExerciseSets,
        getExerciseHistory,
        getLastPerformance,
        getTodayLoggedSetsCount,
        getTodayActivity,
        markRoutineCompleted,
        createRoutine,
        updateRoutine,
        addOrUpdateExerciseToRoutine,
        removeExerciseFromRoutine,
        bulkSaveRoutines,
        deleteRoutine,
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
