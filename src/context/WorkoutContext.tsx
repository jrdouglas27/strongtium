import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  Routine,
  WorkoutSession,
  PersonalRecord,
  LastExercisePerformance,
  LogExercisePayload,
} from '../types/workout';
import {
  calculate1RM,
  getBaseExerciseName,
  getLimbTypeForMuscle,
  isUnilateralExercise,
  isUnilateralMovement,
  toLocalISODate,
} from '../lib/calculations';
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
  getActivityForDate: (targetDate?: Date | string) => TodayActivitySummary[];
  markRoutineCompleted: (routineId: string, completedAt?: string) => Promise<void>;
  createRoutine: (name: string, description: string, restDays: number, exercises: { name: string; muscle: string; targetSets: number }[]) => Promise<void>;
  updateRoutine: (routineId: string, name: string, description: string, restDays: number, exercises: { name: string; muscle: string; targetSets: number }[]) => Promise<void>;
  addOrUpdateExerciseToRoutine: (routineId: string, exerciseName: string, muscle: string, targetSets: number) => Promise<void>;
  removeExerciseFromRoutine: (routineId: string, exerciseIndex: number) => Promise<void>;
  splitExerciseInRoutine: (routineId: string, exerciseName: string) => Promise<void>;
  bulkSaveRoutines: (newRoutines: { name: string; description?: string; targetRestDays: number; exercises: { name: string; muscle: string; targetSets: number }[] }[]) => Promise<void>;
  deleteRoutine: (routineId: string) => Promise<void>;
  loadStarterRoutines: () => Promise<void>;
  refreshData: () => Promise<void>;
  unilateralPreferences: Record<string, boolean>;
  setExerciseUnilateral: (exerciseName: string, isUnilateral: boolean) => Promise<void>;
  isExerciseUnilateral: (exerciseName: string, muscle?: string) => boolean;
  bodyWeight: number;
  bodyWeightHistory: { date: string; weight: number }[];
  setBodyWeight: (weight: number) => Promise<void>;
  getBodyWeightForDate: (dateStr?: string) => number;
  bodyweightPreferences: Record<string, boolean>;
  setExerciseIncludesBodyWeight: (exerciseName: string, includesBodyWeight: boolean) => Promise<void>;
  doesExerciseIncludeBodyWeight: (exerciseName: string) => boolean;
  getBackfillSummary: () => { exercisesCount: number; setsCount: number; exerciseNames: string[] };
  backfillBodyWeightHistory: () => Promise<{ updatedExercises: number; updatedSets: number }>;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

const LOCAL_STORAGE_ROUTINES = 'strongtium_routines';
const LOCAL_STORAGE_SESSIONS = 'strongtium_sessions';
const LOCAL_STORAGE_UNILATERAL = 'strongtium_unilateral_preferences';
const LOCAL_STORAGE_BODY_WEIGHT = 'strongtium_body_weight';
const LOCAL_STORAGE_BODY_WEIGHT_HISTORY = 'strongtium_body_weight_history';
const LOCAL_STORAGE_BODYWEIGHT_PREFS = 'strongtium_bodyweight_preferences';
const LOCAL_STORAGE_BW_ENABLED_SINCE = 'strongtium_bw_enabled_since';
const LOCAL_STORAGE_BW_BACKFILLED_UNTIL = 'strongtium_bw_backfilled_until';

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [personalRecords, setPersonalRecords] = useState<Record<string, PersonalRecord>>({});
  const [loading, setLoading] = useState(true);
  const [unilateralPreferences, setUnilateralPreferences] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_UNILATERAL);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });
  const [bodyWeight, setBodyWeightState] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_BODY_WEIGHT);
      const parsed = raw ? parseFloat(raw) : 0;
      return isNaN(parsed) || parsed < 0 ? 0 : parsed;
    } catch (e) {
      return 0;
    }
  });
  const [bodyweightPreferences, setBodyweightPreferences] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_BODYWEIGHT_PREFS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });
  const [bodyWeightHistory, setBodyWeightHistory] = useState<{ date: string; weight: number }[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_BODY_WEIGHT_HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });
  const [bwEnabledSince, setBwEnabledSince] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_BW_ENABLED_SINCE);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });
  const [bwBackfilledUntil, setBwBackfilledUntil] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_BW_BACKFILLED_UNTIL);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });

  // Sync user preferences when user authenticates
  useEffect(() => {
    if (user?.user_metadata?.unilateral_preferences) {
      const remotePrefs = user.user_metadata.unilateral_preferences;
      setUnilateralPreferences((prev) => {
        const merged = { ...prev, ...remotePrefs };
        try {
          localStorage.setItem(LOCAL_STORAGE_UNILATERAL, JSON.stringify(merged));
          if (user.id) {
            localStorage.setItem(`${LOCAL_STORAGE_UNILATERAL}_${user.id}`, JSON.stringify(merged));
          }
        } catch (e) {
          // ignore
        }
        return merged;
      });
    } else if (user?.id) {
      try {
        const userSpecific = localStorage.getItem(`${LOCAL_STORAGE_UNILATERAL}_${user.id}`);
        if (userSpecific) {
          setUnilateralPreferences(JSON.parse(userSpecific));
        }
      } catch (e) {
        // ignore
      }
    }

    if (typeof user?.user_metadata?.body_weight === 'number' && user.user_metadata.body_weight >= 0) {
      const remoteBW = user.user_metadata.body_weight;
      setBodyWeightState(remoteBW);
      try {
        localStorage.setItem(LOCAL_STORAGE_BODY_WEIGHT, String(remoteBW));
        if (user.id) {
          localStorage.setItem(`${LOCAL_STORAGE_BODY_WEIGHT}_${user.id}`, String(remoteBW));
        }
      } catch (e) {
        // ignore
      }
    } else if (user?.id) {
      try {
        const userSpecificBW = localStorage.getItem(`${LOCAL_STORAGE_BODY_WEIGHT}_${user.id}`);
        if (userSpecificBW) {
          const parsed = parseFloat(userSpecificBW);
          if (!isNaN(parsed) && parsed >= 0) setBodyWeightState(parsed);
        }
      } catch (e) {
        // ignore
      }
    }

    if (user?.user_metadata?.bodyweight_preferences) {
      const remoteBWPrefs = user.user_metadata.bodyweight_preferences;
      setBodyweightPreferences((prev) => {
        const merged = { ...prev, ...remoteBWPrefs };
        try {
          localStorage.setItem(LOCAL_STORAGE_BODYWEIGHT_PREFS, JSON.stringify(merged));
          if (user.id) {
            localStorage.setItem(`${LOCAL_STORAGE_BODYWEIGHT_PREFS}_${user.id}`, JSON.stringify(merged));
          }
        } catch (e) {
          // ignore
        }
        return merged;
      });
    } else if (user?.id) {
      try {
        const userSpecificBWPrefs = localStorage.getItem(`${LOCAL_STORAGE_BODYWEIGHT_PREFS}_${user.id}`);
        if (userSpecificBWPrefs) {
          setBodyweightPreferences(JSON.parse(userSpecificBWPrefs));
        }
      } catch (e) {
        // ignore
      }
    }

    if (Array.isArray(user?.user_metadata?.body_weight_history)) {
      const remoteHist = user.user_metadata.body_weight_history;
      setBodyWeightHistory(remoteHist);
      try {
        localStorage.setItem(LOCAL_STORAGE_BODY_WEIGHT_HISTORY, JSON.stringify(remoteHist));
        if (user.id) {
          localStorage.setItem(`${LOCAL_STORAGE_BODY_WEIGHT_HISTORY}_${user.id}`, JSON.stringify(remoteHist));
        }
      } catch (e) {
        // ignore
      }
    } else if (user?.id) {
      try {
        const localHist = localStorage.getItem(`${LOCAL_STORAGE_BODY_WEIGHT_HISTORY}_${user.id}`);
        if (localHist) setBodyWeightHistory(JSON.parse(localHist));
      } catch (e) {
        // ignore
      }
    }

    if (user?.user_metadata?.bw_enabled_since) {
      const remoteSince = user.user_metadata.bw_enabled_since;
      setBwEnabledSince((prev) => ({ ...prev, ...remoteSince }));
    }
    if (user?.user_metadata?.bw_backfilled_until) {
      const remoteUntil = user.user_metadata.bw_backfilled_until;
      setBwBackfilledUntil((prev) => ({ ...prev, ...remoteUntil }));
    }
  }, [user]);

  const setExerciseUnilateral = useCallback(
    async (exerciseName: string, isUnilateral: boolean) => {
      const cleanName = getBaseExerciseName(exerciseName).trim().toLowerCase();
      if (!cleanName) return;

      setUnilateralPreferences((prev) => {
        const updated = { ...prev, [cleanName]: isUnilateral };
        try {
          localStorage.setItem(LOCAL_STORAGE_UNILATERAL, JSON.stringify(updated));
          if (user?.id) {
            localStorage.setItem(`${LOCAL_STORAGE_UNILATERAL}_${user.id}`, JSON.stringify(updated));
          }
        } catch (e) {
          console.error('Failed to save unilateral preference', e);
        }
        return updated;
      });

      if (user) {
        try {
          const currentMeta = user.user_metadata || {};
          const currentPrefs = currentMeta.unilateral_preferences || {};
          await supabase.auth.updateUser({
            data: {
              unilateral_preferences: {
                ...currentPrefs,
                [cleanName]: isUnilateral,
              },
            },
          });
        } catch (err) {
          console.warn('Could not sync unilateral preference to Supabase user metadata:', err);
        }
      }
    },
    [user]
  );

  const isExerciseUnilateral = useCallback(
    (exerciseName: string, muscle?: string) => {
      return isUnilateralMovement(exerciseName, muscle, unilateralPreferences);
    },
    [unilateralPreferences]
  );

  const setBodyWeight = useCallback(
    async (weight: number) => {
      const sanitized = isNaN(weight) || weight < 0 ? 0 : Number(weight.toFixed(2));
      setBodyWeightState(sanitized);

      const todayStr = toLocalISODate();
      let nextHistory: { date: string; weight: number }[] = [];
      setBodyWeightHistory((prev) => {
        const filtered = prev.filter((entry) => entry.date !== todayStr);
        nextHistory =
          sanitized > 0
            ? [...filtered, { date: todayStr, weight: sanitized }].sort((a, b) =>
                a.date.localeCompare(b.date)
              )
            : filtered;
        try {
          localStorage.setItem(LOCAL_STORAGE_BODY_WEIGHT, String(sanitized));
          localStorage.setItem(LOCAL_STORAGE_BODY_WEIGHT_HISTORY, JSON.stringify(nextHistory));
          if (user?.id) {
            localStorage.setItem(`${LOCAL_STORAGE_BODY_WEIGHT}_${user.id}`, String(sanitized));
            localStorage.setItem(
              `${LOCAL_STORAGE_BODY_WEIGHT_HISTORY}_${user.id}`,
              JSON.stringify(nextHistory)
            );
          }
        } catch (e) {
          console.error('Failed to save body weight', e);
        }
        return nextHistory;
      });

      if (user) {
        try {
          await supabase.auth.updateUser({
            data: {
              body_weight: sanitized,
              body_weight_history: nextHistory,
            },
          });
        } catch (err) {
          console.warn('Could not sync body weight to Supabase user metadata:', err);
        }
      }
    },
    [user]
  );

  const getBodyWeightForDate = useCallback(
    (dateStr?: string) => {
      if (bodyWeightHistory.length === 0) return bodyWeight;
      const target = dateStr
        ? dateStr.includes('T')
          ? toLocalISODate(new Date(dateStr))
          : dateStr
        : toLocalISODate();

      // bodyWeightHistory is sorted ascending by date (YYYY-MM-DD)
      let matched: number | null = null;
      for (const entry of bodyWeightHistory) {
        if (entry.date <= target) {
          matched = entry.weight;
        } else {
          break;
        }
      }
      if (matched !== null) return matched;
      // If target date is earlier than the first recorded body weight, use the earliest recorded weight
      return bodyWeightHistory[0]?.weight ?? bodyWeight;
    },
    [bodyWeight, bodyWeightHistory]
  );

  const setExerciseIncludesBodyWeight = useCallback(
    async (exerciseName: string, includesBodyWeight: boolean) => {
      const cleanName = getBaseExerciseName(exerciseName).trim().toLowerCase();
      if (!cleanName) return;

      const nowIso = new Date().toISOString();
      let updatedSince = bwEnabledSince;
      if (includesBodyWeight && !bwEnabledSince[cleanName]) {
        updatedSince = { ...bwEnabledSince, [cleanName]: nowIso };
        setBwEnabledSince(updatedSince);
        try {
          localStorage.setItem(LOCAL_STORAGE_BW_ENABLED_SINCE, JSON.stringify(updatedSince));
        } catch (e) {
          // ignore
        }
      }

      setBodyweightPreferences((prev) => {
        const updated = { ...prev, [cleanName]: includesBodyWeight };
        try {
          localStorage.setItem(LOCAL_STORAGE_BODYWEIGHT_PREFS, JSON.stringify(updated));
          if (user?.id) {
            localStorage.setItem(`${LOCAL_STORAGE_BODYWEIGHT_PREFS}_${user.id}`, JSON.stringify(updated));
          }
        } catch (e) {
          console.error('Failed to save bodyweight preference', e);
        }
        return updated;
      });

      if (user) {
        try {
          const currentMeta = user.user_metadata || {};
          const currentPrefs = currentMeta.bodyweight_preferences || {};
          await supabase.auth.updateUser({
            data: {
              bodyweight_preferences: {
                ...currentPrefs,
                [cleanName]: includesBodyWeight,
              },
              bw_enabled_since: updatedSince,
            },
          });
        } catch (err) {
          console.warn('Could not sync bodyweight preference to Supabase user metadata:', err);
        }
      }
    },
    [user, bwEnabledSince]
  );

  const doesExerciseIncludeBodyWeight = useCallback(
    (exerciseName: string) => {
      const cleanName = getBaseExerciseName(exerciseName).trim().toLowerCase();
      if (!cleanName) return false;
      return Boolean(bodyweightPreferences[cleanName]);
    },
    [bodyweightPreferences]
  );

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

    if (!user) {
      setRoutines([]);
      setSessions([]);
      setPersonalRecords({});
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

      // Auto-consolidate: If any routine contains split Left/Right exercise rows, merge back into a single base exercise
      let needsRefetch = false;
      for (const r of formattedRoutines) {
        const hasSplitSide = (r.exercises || []).some((re: any) => {
          const n = re.exercise?.name?.trim() || '';
          return isUnilateralExercise(n).isUnilateral;
        });

        if (hasSplitSide && user) {
          const updatedExercises: { name: string; muscle: string; targetSets: number }[] = [];
          const seenBase = new Set<string>();

          for (const re of (r.exercises || [])) {
            const rawName = re.exercise?.name?.trim() || 'Exercise';
            const baseName = getBaseExerciseName(rawName);
            const key = baseName.toLowerCase();
            if (!seenBase.has(key)) {
              seenBase.add(key);
              updatedExercises.push({
                name: baseName,
                muscle: re.exercise?.target_muscle_group || 'General',
                targetSets: re.target_sets || 3,
              });
            }
          }

          await supabase.from('routine_exercises').delete().eq('routine_id', r.id);
          for (let i = 0; i < updatedExercises.length; i++) {
            const item = updatedExercises[i];
            let exId = '';
            const { data: existingEx } = await supabase
              .from('exercises')
              .select('id')
              .eq('user_id', user.id)
              .ilike('name', item.name.trim())
              .maybeSingle();

            if (existingEx) {
              exId = existingEx.id;
            } else {
              const { data: newEx } = await supabase
                .from('exercises')
                .insert({
                  user_id: user.id,
                  name: item.name.trim(),
                  target_muscle_group: item.muscle,
                  default_unit: 'kg',
                })
                .select()
                .single();
              if (newEx) exId = newEx.id;
            }

            if (exId) {
              await supabase.from('routine_exercises').insert({
                routine_id: r.id,
                exercise_id: exId,
                target_sets: item.targetSets,
                order_index: i,
              });
            }
          }
          needsRefetch = true;
        }
      }



      // Auto-split "Legs & Core" into separate "Legs" and "Core" groups if present
      const legsAndCoreRoutine = formattedRoutines.find((r) =>
        /^legs\s*(&|and)\s*core$/i.test(r.name.trim())
      );

      if (legsAndCoreRoutine && user) {
        const coreRegex =
          /core|ab|plank|crunch|sit[\s-]?up|hollow|twist|woodchop|rollout|dead\s*bug|bird\s*dog|l-sit|leg\s*raise/i;
        const legExIds: { exercise_id: string; target_sets: number }[] = [];
        const coreExIds: { exercise_id: string; target_sets: number }[] = [];

        for (const re of legsAndCoreRoutine.exercises || []) {
          const exName = re.exercise?.name || '';
          const exMuscle = re.exercise?.target_muscle_group || '';
          if (coreRegex.test(`${exName} ${exMuscle}`)) {
            coreExIds.push({ exercise_id: re.exercise_id, target_sets: re.target_sets || 3 });
          } else {
            legExIds.push({ exercise_id: re.exercise_id, target_sets: re.target_sets || 3 });
          }
        }

        await supabase
          .from('routines')
          .update({
            name: 'Legs',
            description: 'Lower body movements',
          })
          .eq('id', legsAndCoreRoutine.id);

        if (coreExIds.length > 0) {
          await supabase.from('routine_exercises').delete().eq('routine_id', legsAndCoreRoutine.id);
          for (let i = 0; i < legExIds.length; i++) {
            await supabase.from('routine_exercises').insert({
              routine_id: legsAndCoreRoutine.id,
              exercise_id: legExIds[i].exercise_id,
              target_sets: legExIds[i].target_sets,
              order_index: i,
            });
          }
        }

        const existingCoreRoutine = formattedRoutines.find(
          (r) => r.id !== legsAndCoreRoutine.id && /^core(\s+group)?$/i.test(r.name.trim())
        );

        let coreRoutineId = existingCoreRoutine?.id || '';
        if (!coreRoutineId) {
          const { data: newCoreRoutine } = await supabase
            .from('routines')
            .insert({
              user_id: user.id,
              name: 'Core',
              description: 'Core stability and abdominal movements',
              target_rest_days: 3,
              order_index: formattedRoutines.length,
            })
            .select()
            .single();

          if (newCoreRoutine) {
            coreRoutineId = newCoreRoutine.id;
          }
        }

        if (coreRoutineId && coreExIds.length > 0) {
          for (let i = 0; i < coreExIds.length; i++) {
            await supabase.from('routine_exercises').insert({
              routine_id: coreRoutineId,
              exercise_id: coreExIds[i].exercise_id,
              target_sets: coreExIds[i].target_sets,
              order_index: i,
            });
          }
        }

        needsRefetch = true;
      }

      if (needsRefetch) {
        return fetchData();
      }

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
  }, [user, computePRs]);

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

      // 2. If no performance found and this is a unilateral exercise, fall back to base name
      const baseName = getBaseExerciseName(exerciseName).toLowerCase();
      if (baseName && baseName !== cleanName) {
        for (const session of sessions) {
          if (!session.completed_at) continue;
          const matchingEx = session.logged_exercises?.find(
            (le) => le.exercise_name.trim().toLowerCase() === baseName
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
      }

      return null;
    },
    [sessions]
  );

  // Get full history for a specific exercise
  const getExerciseHistory = useCallback(
    (exerciseName: string): ExerciseHistoryEntry[] => {
      const cleanName = exerciseName.trim().toLowerCase();
      const baseName = getBaseExerciseName(exerciseName).toLowerCase();
      if (!cleanName && !baseName) return [];

      const history: ExerciseHistoryEntry[] = [];

      sessions.forEach((s) => {
        if (!s.completed_at) return;
        const matchingExercises = s.logged_exercises?.filter((le) => {
          const lName = le.exercise_name.trim().toLowerCase();
          const lBase = getBaseExerciseName(le.exercise_name).toLowerCase();
          return lName === cleanName || lBase === baseName;
        });

        if (matchingExercises && matchingExercises.length > 0) {
          const allSets: { setNumber: number; weight: number; reps: number; label?: string }[] = [];
          matchingExercises.forEach((mEx) => {
            const uni = isUnilateralExercise(mEx.exercise_name);
            mEx.sets.forEach((st) => {
              allSets.push({
                setNumber: st.set_number,
                weight: Number(st.weight),
                reps: Number(st.reps),
                label: uni.isUnilateral && uni.side ? uni.side.toUpperCase() : undefined,
              });
            });
          });

          if (allSets.length > 0) {
            const maxW = Math.max(...allSets.map((st) => st.weight));
            const best1RM = Math.max(...allSets.map((st) => calculate1RM(st.weight, st.reps)));
            const totalVol = allSets.reduce((sum, st) => sum + st.weight * st.reps, 0);

            history.push({
              sessionId: s.id,
              sessionName: s.routine_name,
              completedAt: s.completed_at,
              notes: matchingExercises.map((m) => m.exercise_notes).filter(Boolean).join(' | '),
              sets: allSets,
              maxWeight: maxW,
              bestEstimated1RM: best1RM,
              totalVolume: totalVol,
            });
          }
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

  // Get summary of logged activity for any specific date
  const getActivityForDate = useCallback(
    (targetDate?: Date | string): TodayActivitySummary[] => {
      const d = targetDate
        ? typeof targetDate === 'string'
          ? new Date(targetDate.includes('T') ? targetDate : targetDate + 'T12:00:00')
          : targetDate
        : new Date();
      const targetDateStr = d.toDateString();
      const map: Record<string, TodayActivitySummary> = {};

      sessions.forEach((s) => {
        if (!s.completed_at) return;
        if (new Date(s.completed_at).toDateString() !== targetDateStr) return;

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
    },
    [sessions]
  );

  // Get summary of today's logged activity
  const getTodayActivity = useCallback((): TodayActivitySummary[] => {
    return getActivityForDate(new Date());
  }, [getActivityForDate]);

  // Log exercise sets directly (supports both real-time and retrospective logging)
  const logExerciseSets = async (payload: LogExercisePayload) => {
    const validSets = payload.sets.filter((s) => s.weight > 0 || s.reps > 0);
    if (validSets.length === 0) return;

    if (!user) return;

    const timestamp = payload.loggedAt || new Date().toISOString();
    const targetDate = new Date(timestamp);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0).toISOString();
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999).toISOString();

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

      // 2. Create or find session for the specific target date
      const { data: existingSessions } = await supabase
        .from('workout_sessions')
        .select('id, routine_id, routine_name, completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', startOfDay)
        .lte('completed_at', endOfDay)
        .order('completed_at', { ascending: false });

      const allSessionIdsOnDate = (existingSessions || []).map((s) => s.id);
      let sessionId = allSessionIdsOnDate.length > 0 ? allSessionIdsOnDate[0] : null;

      if (!sessionId) {
        const { data: newSession, error: sErr } = await supabase
          .from('workout_sessions')
          .insert({
            user_id: user.id,
            routine_id: payload.routineId || null,
            routine_name: payload.routineName || 'Workout Session',
            started_at: timestamp,
            completed_at: timestamp,
          })
          .select()
          .single();

        if (sErr) throw sErr;
        sessionId = newSession.id;
      } else if (existingSessions && existingSessions[0]) {
        const currentSession = existingSessions[0];
        if (
          payload.routineName &&
          currentSession.routine_name &&
          currentSession.routine_name !== 'Workout Session' &&
          currentSession.routine_name.trim().toLowerCase() !== payload.routineName.trim().toLowerCase()
        ) {
          await supabase
            .from('workout_sessions')
            .update({
              routine_id: null,
              routine_name: 'Workout Session',
            })
            .eq('id', sessionId);
        }
      }

      // 3. Delete any existing entry for this exercise across sessions on this date to prevent duplicate rows
      if (allSessionIdsOnDate.length > 0) {
        await supabase
          .from('logged_exercises')
          .delete()
          .in('session_id', allSessionIdsOnDate)
          .ilike('exercise_name', payload.exerciseName.trim());
      }

      // Insert logged exercise & sets
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
        const targetRoutine = routines.find((r) => r.id === payload.routineId);
        const shouldUpdateRoutine = !targetRoutine?.last_completed_at ||
          new Date(timestamp) >= new Date(targetRoutine.last_completed_at);

        if (shouldUpdateRoutine) {
          await supabase
            .from('routines')
            .update({ last_completed_at: timestamp })
            .eq('id', payload.routineId);
        }
      }

      await fetchData();
    } catch (err) {
      console.error('Error in logExerciseSets:', err);
      // Fallback save to local storage
      const updatedSessions = [...sessions];
      setSessions(updatedSessions);
    }
  };

  // Mark a routine as completed for rotation (supports custom date timestamp)
  const markRoutineCompleted = async (routineId: string, completedAt?: string) => {
    if (!user) return;
    const timestamp = completedAt || new Date().toISOString();

    try {
      const targetRoutine = routines.find((r) => r.id === routineId);
      const shouldUpdateRoutine =
        !targetRoutine?.last_completed_at ||
        new Date(timestamp) >= new Date(targetRoutine.last_completed_at);

      if (shouldUpdateRoutine) {
        await supabase.from('routines').update({ last_completed_at: timestamp }).eq('id', routineId);
      }
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
    if (!user) return;

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
    if (!user) return;

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

  // Split an exercise into separate Left & Right side entries inside a routine
  const splitExerciseInRoutine = async (routineId: string, exerciseName: string) => {
    const routine = routines.find((r) => r.id === routineId);
    if (!routine || !routine.exercises) return;

    const targetRe = routine.exercises.find(
      (re) => re.exercise?.name?.trim().toLowerCase() === exerciseName.trim().toLowerCase()
    );
    if (!targetRe) return;

    const muscle = targetRe.exercise?.target_muscle_group || 'General';
    const targetSets = targetRe.target_sets || 3;
    const limbType = getLimbTypeForMuscle(muscle);
    const baseName = getBaseExerciseName(exerciseName);

    const leftName = `${baseName} (Left ${limbType})`;
    const rightName = `${baseName} (Right ${limbType})`;

    const updatedExercises: { name: string; muscle: string; targetSets: number }[] = [];
    for (const re of routine.exercises) {
      const curName = re.exercise?.name || 'Exercise';
      if (curName.trim().toLowerCase() === exerciseName.trim().toLowerCase()) {
        updatedExercises.push({ name: leftName, muscle, targetSets });
        updatedExercises.push({ name: rightName, muscle, targetSets });
      } else {
        updatedExercises.push({
          name: curName,
          muscle: re.exercise?.target_muscle_group || 'General',
          targetSets: re.target_sets || 3,
        });
      }
    }

    await updateRoutine(
      routine.id,
      routine.name,
      routine.description || '',
      routine.target_rest_days || 3,
      updatedExercises
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
    if (!user) return;

    try {
      await supabase.from('routines').delete().eq('id', routineId);
      await fetchData();
    } catch (err) {
      console.error('Error deleting routine:', err);
    }
  };

  // Load starter routines for new user
  const loadStarterRoutines = async () => {
    if (!user) return;
    for (const starter of STARTER_ROUTINES) {
      const exerciseList = (starter.exercises || []).map((e) => ({
        name: e.exercise?.name || 'Exercise',
        muscle: e.exercise?.target_muscle_group || 'General',
        targetSets: e.target_sets || 3,
      }));
      await createRoutine(starter.name, starter.description || '', starter.target_rest_days, exerciseList);
    }
  };

  // Identify past logged exercises with +BW enabled that haven't been backfilled yet
  const getEligibleBackfillTargets = useCallback(() => {
    const nowIso = new Date().toISOString();
    const targets: {
      sessionId: string;
      sessionDate: string;
      loggedExerciseId: string;
      baseName: string;
      cleanName: string;
      cutoffIso: string;
      bwToAdd: number;
      sets: { id: string; weight: number; reps: number }[];
    }[] = [];

    if (bodyWeight <= 0) return targets;

    sessions.forEach((s) => {
      const sessionDate = s.completed_at || s.started_at;
      if (!sessionDate) return;
      const sessionMs = new Date(sessionDate).getTime();

      (s.logged_exercises || []).forEach((le) => {
        const baseName = getBaseExerciseName(le.exercise_name);
        const cleanName = baseName.trim().toLowerCase();
        if (!cleanName || !bodyweightPreferences[cleanName]) return;

        const cutoffIso = bwEnabledSince[cleanName] || nowIso;
        const cutoffMs = new Date(cutoffIso).getTime();
        const backfilledMs = bwBackfilledUntil[cleanName]
          ? new Date(bwBackfilledUntil[cleanName]).getTime()
          : -Infinity;

        if (sessionMs <= cutoffMs && sessionMs > backfilledMs && le.sets.length > 0) {
          const bwToAdd = getBodyWeightForDate(sessionDate) || bodyWeight;
          if (bwToAdd > 0) {
            targets.push({
              sessionId: s.id,
              sessionDate,
              loggedExerciseId: le.id,
              baseName,
              cleanName,
              cutoffIso,
              bwToAdd,
              sets: le.sets.map((st) => ({
                id: st.id,
                weight: Number(st.weight) || 0,
                reps: Number(st.reps) || 0,
              })),
            });
          }
        }
      });
    });

    return targets;
  }, [sessions, bodyWeight, bodyweightPreferences, bwEnabledSince, bwBackfilledUntil, getBodyWeightForDate]);

  const getBackfillSummary = useCallback(() => {
    const targets = getEligibleBackfillTargets();
    const nameSet = new Set<string>();
    let setsCount = 0;
    targets.forEach((t) => {
      nameSet.add(t.baseName);
      setsCount += t.sets.length;
    });
    return {
      exercisesCount: targets.length,
      setsCount,
      exerciseNames: Array.from(nameSet),
    };
  }, [getEligibleBackfillTargets]);

  const backfillBodyWeightHistory = useCallback(async () => {
    const targets = getEligibleBackfillTargets();
    if (targets.length === 0) {
      return { updatedExercises: 0, updatedSets: 0 };
    }

    let updatedSets = 0;
    const nextBackfilledUntil = { ...bwBackfilledUntil };
    const nextEnabledSince = { ...bwEnabledSince };

    // Update Supabase logged_sets rows if authenticated
    if (user) {
      for (const target of targets) {
        for (const st of target.sets) {
          const newWeight = Number((st.weight + target.bwToAdd).toFixed(2));
          if (st.id) {
            const { error } = await supabase
              .from('logged_sets')
              .update({ weight: newWeight })
              .eq('id', st.id);
            if (error) {
              console.error('Failed to backfill logged_set:', error);
            } else {
              updatedSets += 1;
            }
          }
        }
        nextBackfilledUntil[target.cleanName] = target.cutoffIso;
        if (!nextEnabledSince[target.cleanName]) {
          nextEnabledSince[target.cleanName] = target.cutoffIso;
        }
      }
    }

    // Also update local state & localStorage
    const setIdToNewWeight = new Map<string, number>();
    targets.forEach((t) => {
      t.sets.forEach((st) => {
        setIdToNewWeight.set(st.id, Number((st.weight + t.bwToAdd).toFixed(2)));
        if (!user) updatedSets += 1;
      });
      nextBackfilledUntil[t.cleanName] = t.cutoffIso;
      if (!nextEnabledSince[t.cleanName]) {
        nextEnabledSince[t.cleanName] = t.cutoffIso;
      }
    });

    setBwBackfilledUntil(nextBackfilledUntil);
    setBwEnabledSince(nextEnabledSince);
    try {
      localStorage.setItem(LOCAL_STORAGE_BW_BACKFILLED_UNTIL, JSON.stringify(nextBackfilledUntil));
      localStorage.setItem(LOCAL_STORAGE_BW_ENABLED_SINCE, JSON.stringify(nextEnabledSince));
    } catch (e) {
      // ignore
    }

    if (user) {
      try {
        await supabase.auth.updateUser({
          data: {
            bw_backfilled_until: nextBackfilledUntil,
            bw_enabled_since: nextEnabledSince,
          },
        });
      } catch (err) {
        console.warn('Could not sync bw_backfilled_until to Supabase user metadata:', err);
      }
      await fetchData();
    } else {
      setSessions((prev) => {
        const updated = prev.map((s) => ({
          ...s,
          logged_exercises: (s.logged_exercises || []).map((le) => ({
            ...le,
            sets: (le.sets || []).map((st) =>
              setIdToNewWeight.has(st.id)
                ? { ...st, weight: setIdToNewWeight.get(st.id)! }
                : st
            ),
          })),
        }));
        localStorage.setItem(LOCAL_STORAGE_SESSIONS, JSON.stringify(updated));
        computePRs(updated);
        return updated;
      });
    }

    return {
      updatedExercises: targets.length,
      updatedSets,
    };
  }, [getEligibleBackfillTargets, bwBackfilledUntil, bwEnabledSince, user, computePRs]);

  // Automatically backfill past +BW logs once bodyWeight > 0 and sessions are loaded
  const isAutoBackfillingRef = useRef(false);
  useEffect(() => {
    if (loading || bodyWeight <= 0 || isAutoBackfillingRef.current) return;
    const targets = getEligibleBackfillTargets();
    if (targets.length === 0) return;

    isAutoBackfillingRef.current = true;
    backfillBodyWeightHistory().finally(() => {
      isAutoBackfillingRef.current = false;
    });
  }, [loading, bodyWeight, getEligibleBackfillTargets, backfillBodyWeightHistory]);

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
        getActivityForDate,
        markRoutineCompleted,
        createRoutine,
        updateRoutine,
        addOrUpdateExerciseToRoutine,
        removeExerciseFromRoutine,
        splitExerciseInRoutine,
        bulkSaveRoutines,
        deleteRoutine,
        loadStarterRoutines,
        refreshData: fetchData,
        unilateralPreferences,
        setExerciseUnilateral,
        isExerciseUnilateral,
        bodyWeight,
        bodyWeightHistory,
        setBodyWeight,
        getBodyWeightForDate,
        bodyweightPreferences,
        setExerciseIncludesBodyWeight,
        doesExerciseIncludeBodyWeight,
        getBackfillSummary,
        backfillBodyWeightHistory,
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
