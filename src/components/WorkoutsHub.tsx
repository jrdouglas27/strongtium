import React, { useState, useMemo } from 'react';
import {
  Flame,
  Plus,
  Sparkles,
  Search,
  CheckCircle2,
  Dumbbell,
  Layers,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { useWorkout } from '../context/WorkoutContext';
import { ExerciseCard } from './ExerciseCard';
import { AddExerciseModal } from './AddExerciseModal';
import { calculateRoutineDueStatus, formatRelativeDays } from '../lib/calculations';

interface WorkoutsHubProps {
  onNavigateToRoutines: () => void;
}

export const WorkoutsHub: React.FC<WorkoutsHubProps> = ({ onNavigateToRoutines }) => {
  const {
    routines,
    sessions,
    loading,
    loadStarterRoutines,
    getTodayActivity,
    markRoutineCompleted,
  } = useWorkout();

  // Find most due routine
  const mostDueRoutine = useMemo(() => {
    if (routines.length === 0) return null;

    const calculated = routines.map((r) => ({
      routine: r,
      status: calculateRoutineDueStatus(r.last_completed_at, r.target_rest_days || 3),
    }));

    const dueList = calculated.filter(
      (c) => c.status.status === 'due' || c.status.status === 'never_done'
    );
    if (dueList.length > 0) {
      dueList.sort((a, b) => (b.status.daysSinceLast || 999) - (a.status.daysSinceLast || 999));
      return dueList[0].routine;
    }

    calculated.sort((a, b) => (a.status.daysUntilDue || 0) - (b.status.daysUntilDue || 0));
    return calculated[0].routine;
  }, [routines]);

  // Selected routine filter (or 'all')
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>('auto');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);

  // Set default routine to most due if on 'auto'
  const activeRoutineId =
    selectedRoutineId === 'auto'
      ? mostDueRoutine?.id || (routines[0]?.id ?? 'all')
      : selectedRoutineId;

  const currentRoutine = routines.find((r) => r.id === activeRoutineId);

  // Collect all unique exercises across routines and sessions
  const allExerciseItems = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        muscle: string;
        routineName?: string;
        routineId?: string;
        targetSets?: number;
      }
    >();

    // 1. Add from routines
    routines.forEach((r) => {
      r.exercises?.forEach((re) => {
        const name = re.exercise?.name || 'Exercise';
        map.set(name.toLowerCase(), {
          name,
          muscle: re.exercise?.target_muscle_group || 'General',
          routineName: r.name,
          routineId: r.id,
          targetSets: re.target_sets || 3,
        });
      });
    });

    // 2. Add any standalone exercises from session history
    sessions.forEach((s) => {
      s.logged_exercises?.forEach((le) => {
        const name = le.exercise_name?.trim();
        if (name && !map.has(name.toLowerCase())) {
          map.set(name.toLowerCase(), {
            name,
            muscle: 'General',
            routineName: s.routine_name,
            routineId: s.routine_id || undefined,
            targetSets: 3,
          });
        }
      });
    });

    return Array.from(map.values());
  }, [routines, sessions]);

  // Filter exercises based on selected routine & search query
  const displayedExercises = useMemo(() => {
    let list: {
      name: string;
      muscle: string;
      routineName?: string;
      routineId?: string;
      targetSets?: number;
    }[] = [];

    if (activeRoutineId === 'all') {
      list = allExerciseItems;
    } else if (currentRoutine) {
      list = (currentRoutine.exercises || []).map((re) => ({
        name: re.exercise?.name || 'Exercise',
        muscle: re.exercise?.target_muscle_group || 'General',
        routineName: currentRoutine.name,
        routineId: currentRoutine.id,
        targetSets: re.target_sets || 3,
      }));
    } else {
      list = allExerciseItems;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.muscle.toLowerCase().includes(q) ||
          e.routineName?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [activeRoutineId, currentRoutine, allExerciseItems, searchQuery]);

  const todayActivities = getTodayActivity();
  const totalTodaySets = todayActivities.reduce((acc, a) => acc + a.setsCount, 0);
  const totalTodayVolume = todayActivities.reduce((acc, a) => acc + a.totalVolume, 0);

  const handleMarkRoutineDone = async (routineId: string) => {
    setMarkingDone(true);
    try {
      await markRoutineCompleted(routineId);
    } finally {
      setMarkingDone(false);
    }
  };

  if (loading && routines.length === 0) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-white font-medium">Loading your exercises...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Today's Activity Bar (Zero Pressure Momentum) */}
      {todayActivities.length > 0 && (
        <div className="bg-[#274a38] border border-[#3c6e54] rounded-2xl p-4 sm:p-5 shadow-sm text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-1.5 text-[#8fb89e] text-xs font-extrabold uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 text-[#8fb89e]" />
                <span>Today's Logged Progress</span>
              </div>
              <h3 className="text-lg font-extrabold text-white">
                {todayActivities.length} {todayActivities.length === 1 ? 'Exercise' : 'Exercises'} • {totalTodaySets} Total Sets
              </h3>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {todayActivities.map((act, i) => (
                  <span
                    key={i}
                    className="bg-[#1f3a2c] text-[#8fb89e] px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border border-[#2f5540]"
                  >
                    {act.exerciseName}: {act.setsCount}s ({act.maxWeight}kg max)
                  </span>
                ))}
              </div>
            </div>

            <div className="text-right sm:border-l sm:border-[#3c6e54] sm:pl-5">
              <span className="text-xs text-[#cbd5e1] block font-medium">Total Volume</span>
              <span className="text-xl font-mono font-extrabold text-white">
                {Math.round(totalTodayVolume)} <span className="text-xs font-sans">kg</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Routine Focus Bar / Selector Chips */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Exercise Workspace
            </h2>
            <p className="text-xs text-[#cbd5e1] font-medium">
              Pick 1 or 2 exercises to master today at your own pace. Log sets on-demand.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onNavigateToRoutines}
              className="flex items-center space-x-1 text-xs text-[#cbd5e1] hover:text-white font-bold py-2 px-3 rounded-xl hover:bg-[#344e5e] transition border border-transparent hover:border-[#4e7085]"
            >
              <span>Manage Splits</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-1.5 bg-[#8bb4cb] hover:bg-[#749fb7] text-[#0e2938] text-xs font-extrabold px-3.5 py-2 rounded-xl border border-[#749fb7] transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Exercise</span>
            </button>
          </div>
        </div>

        {/* Routine Switcher Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {routines.map((routine) => {
            const dueStatus = calculateRoutineDueStatus(
              routine.last_completed_at,
              routine.target_rest_days || 3
            );
            const isSelected = activeRoutineId === routine.id;
            const isDue = dueStatus.status === 'due' || dueStatus.status === 'never_done';

            return (
              <button
                key={routine.id}
                onClick={() => setSelectedRoutineId(routine.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap border shrink-0 ${
                  isSelected
                    ? 'bg-[#8bb4cb] text-[#0e2938] border-[#749fb7] shadow-sm'
                    : 'bg-[#3d5a6c] text-[#cbd5e1] hover:text-white hover:bg-[#344e5e] border-[#4e7085]'
                }`}
              >
                {isDue && (
                  <Flame
                    className={`w-3.5 h-3.5 ${
                      isSelected ? 'text-[#0e2938]' : 'text-[#cc8d8d]'
                    }`}
                  />
                )}
                <span>{routine.name}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                    isSelected
                      ? 'bg-[#0e2938]/15 text-[#0e2938]'
                      : 'bg-[#2d4554] text-[#94a3b8]'
                  }`}
                >
                  {routine.exercises?.length || 0}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => setSelectedRoutineId('all')}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap border shrink-0 ${
              activeRoutineId === 'all'
                ? 'bg-[#8bb4cb] text-[#0e2938] border-[#749fb7] shadow-sm'
                : 'bg-[#3d5a6c] text-[#cbd5e1] hover:text-white hover:bg-[#344e5e] border-[#4e7085]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Exercises ({allExerciseItems.length})</span>
          </button>
        </div>
      </div>

      {/* Routine Focus Header Card (Contextual helper) */}
      {currentRoutine && activeRoutineId !== 'all' && (
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 sm:p-5 shadow-sm text-[#f1f5f9]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-extrabold text-[#8bb4cb] uppercase tracking-wider">
                  TODAY'S FOCUS SPLIT
                </span>
                <span className="text-xs text-[#cbd5e1] font-mono">
                  • Cycle every {currentRoutine.target_rest_days || 3}d
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                {currentRoutine.name}
              </h3>
              <p className="text-xs text-[#cbd5e1] max-w-xl font-medium">
                {currentRoutine.description ||
                  `Target 1 or 2 exercises below to master this split. Last session: ${formatRelativeDays(
                    currentRoutine.last_completed_at
                  )}.`}
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                disabled={markingDone}
                onClick={() => handleMarkRoutineDone(currentRoutine.id)}
                className="flex items-center space-x-1.5 bg-[#2d4554] hover:bg-[#253946] text-[#cbd5e1] hover:text-white border border-[#3f5d70] px-3.5 py-2 rounded-xl text-xs font-bold transition"
                title="Mark this routine as completed in rotation"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#8fb89e]" />
                <span>Mark Cycle Done</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Exercise Count Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search exercises by name or muscle group (e.g. Bench, Chest, Pull)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-[#94a3b8] focus:outline-none focus:border-[#8bb4cb]"
          />
        </div>

        <div className="text-xs text-[#cbd5e1] font-medium flex items-center space-x-2">
          <span>Showing {displayedExercises.length} {displayedExercises.length === 1 ? 'exercise' : 'exercises'}</span>
        </div>
      </div>

      {/* Empty State when no routines/exercises exist */}
      {routines.length === 0 && allExerciseItems.length === 0 ? (
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-10 text-center space-y-3">
          <Dumbbell className="w-10 h-10 text-[#94a3b8] mx-auto" />
          <h3 className="font-bold text-base text-white">No Exercises Set Up Yet</h3>
          <p className="text-xs text-[#cbd5e1] max-w-sm mx-auto font-medium">
            Load the starter Push / Pull / Legs exercises to immediately start tracking and mastering your movements!
          </p>
          <button
            onClick={() => loadStarterRoutines()}
            className="inline-flex items-center space-x-1.5 bg-[#8bb4cb] text-[#0e2938] border border-[#749fb7] text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm hover:bg-[#749fb7] transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Load Push / Pull / Legs Starter Plan</span>
          </button>
        </div>
      ) : displayedExercises.length === 0 ? (
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-8 text-center space-y-2">
          <p className="text-xs text-[#cbd5e1] font-medium">
            No exercises match your search query "{searchQuery}".
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-[#8bb4cb] font-bold underline"
          >
            Clear Search
          </button>
        </div>
      ) : (
        /* Exercises Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedExercises.map((ex) => (
            <ExerciseCard
              key={`${ex.routineId || 'free'}-${ex.name}`}
              exerciseName={ex.name}
              targetMuscleGroup={ex.muscle}
              routineName={ex.routineName}
              routineId={ex.routineId}
              targetSets={ex.targetSets}
              onFocusRoutine={(rId) => setSelectedRoutineId(rId)}
            />
          ))}
        </div>
      )}

      {/* Add Custom Exercise Modal */}
      {showAddModal && (
        <AddExerciseModal
          onClose={() => setShowAddModal(false)}
          defaultRoutineId={activeRoutineId !== 'all' ? activeRoutineId : undefined}
        />
      )}
    </div>
  );
};
