import React, { useState, useMemo } from 'react';
import {
  Plus,
  Sparkles,
  Search,
  Dumbbell,
  Layers,
  Zap,
  ArrowRight,
  Calendar,
  Clock,
} from 'lucide-react';
import { useWorkout } from '../context/WorkoutContext';
import { ExerciseCard } from './ExerciseCard';
import { AddExerciseModal } from './AddExerciseModal';
import {
  toLocalISODate,
  getYesterdayISODate,
  formatWorkoutDateLabel,
  getBaseExerciseName,
} from '../lib/calculations';

interface WorkoutsHubProps {
  onNavigateToRoutines: () => void;
}

export const WorkoutsHub: React.FC<WorkoutsHubProps> = ({ onNavigateToRoutines }) => {
  const {
    routines,
    sessions,
    loading,
    loadStarterRoutines,
    getActivityForDate,
  } = useWorkout();

  // Date selection state (defaults to today for frictionless real-time logging)
  const todayISODate = useMemo(() => toLocalISODate(), []);
  const yesterdayISODate = useMemo(() => getYesterdayISODate(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayISODate);

  const isSelectedToday = selectedDate === todayISODate;
  const isSelectedYesterday = selectedDate === yesterdayISODate;
  const selectedDateLabel = formatWorkoutDateLabel(selectedDate);

  // Selected navigation group filter (defaults to 'all' so muscle groups are only used for navigation)
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const activeRoutineId = selectedRoutineId;
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
        const rawName = re.exercise?.name || 'Exercise';
        const name = getBaseExerciseName(rawName);
        const key = name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            name,
            muscle: re.exercise?.target_muscle_group || 'General',
            routineName: r.name,
            routineId: r.id,
            targetSets: re.target_sets || 3,
          });
        }
      });
    });

    // 2. Add any standalone exercises from session history
    sessions.forEach((s) => {
      s.logged_exercises?.forEach((le) => {
        const rawName = le.exercise_name?.trim();
        if (rawName) {
          const name = getBaseExerciseName(rawName);
          const key = name.toLowerCase();
          if (!map.has(key)) {
            map.set(key, {
              name,
              muscle: 'General',
              routineName: s.routine_name,
              routineId: s.routine_id || undefined,
              targetSets: 3,
            });
          }
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
      const seen = new Set<string>();
      list = [];
      (currentRoutine.exercises || []).forEach((re) => {
        const rawName = re.exercise?.name || 'Exercise';
        const name = getBaseExerciseName(rawName);
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          list.push({
            name,
            muscle: re.exercise?.target_muscle_group || 'General',
            routineName: currentRoutine.name,
            routineId: currentRoutine.id,
            targetSets: re.target_sets || 3,
          });
        }
      });
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

  const dateActivities = getActivityForDate(selectedDate);
  const totalDateSets = dateActivities.reduce((acc, a) => acc + a.setsCount, 0);

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
      {/* Date Navigator Bar (Real-Time vs Retrospective Logging) */}
      <div className="bg-[#2d4554] border border-[#3f5d70] rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#3d5a6c] border border-[#4e7085] rounded-xl text-[#8bb4cb] shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-extrabold text-white">Logging Date:</span>
              {isSelectedToday ? (
                <span className="inline-flex items-center space-x-1.5 bg-[#274a38] text-[#8fb89e] border border-[#3c6e54] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8fb89e] animate-pulse" />
                  <span>Real-Time (Today)</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 bg-[#3d5a6c] text-[#8bb4cb] border border-[#749fb7]/60 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                  <Clock className="w-3 h-3 text-[#8bb4cb]" />
                  <span>Retrospective ({selectedDateLabel})</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#cbd5e1] font-medium pt-0.5">
              {isSelectedToday
                ? 'Recording sets in real time. Defaulting to today.'
                : `Backfilling workout details retrospectively for ${selectedDateLabel}.`}
            </p>
          </div>
        </div>

        {/* Quick Date Switcher Chips + Date Input */}
        <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setSelectedDate(todayISODate)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              isSelectedToday
                ? 'bg-[#8bb4cb] text-[#0e2938] border-[#749fb7] shadow-sm'
                : 'bg-[#3d5a6c] text-[#cbd5e1] hover:text-white hover:bg-[#344e5e] border-[#4e7085]'
            }`}
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => setSelectedDate(yesterdayISODate)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              isSelectedYesterday
                ? 'bg-[#8bb4cb] text-[#0e2938] border-[#749fb7] shadow-sm'
                : 'bg-[#3d5a6c] text-[#cbd5e1] hover:text-white hover:bg-[#344e5e] border-[#4e7085]'
            }`}
          >
            Yesterday
          </button>

          <div className="relative">
            <input
              type="date"
              max={todayISODate}
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              className={`bg-[#3d5a6c] border text-xs font-bold px-2.5 py-1.5 rounded-xl text-white focus:outline-none focus:border-[#8bb4cb] transition cursor-pointer ${
                !isSelectedToday && !isSelectedYesterday
                  ? 'border-[#8bb4cb] bg-[#344e5e] ring-1 ring-[#8bb4cb]'
                  : 'border-[#4e7085]'
              }`}
              title="Pick a custom past date"
            />
          </div>
        </div>
      </div>

      {/* Selected Date's Activity Bar (Zero Pressure Momentum) */}
      {dateActivities.length > 0 && (
        <div className="bg-[#274a38] border border-[#3c6e54] rounded-2xl p-4 sm:p-5 shadow-sm text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-1.5 text-[#8fb89e] text-xs font-extrabold uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 text-[#8fb89e]" />
                <span>
                  {isSelectedToday
                    ? "Today's Logged Progress"
                    : isSelectedYesterday
                    ? "Yesterday's Logged Progress"
                    : `Logged Progress (${selectedDateLabel})`}
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-white">
                {dateActivities.length} {dateActivities.length === 1 ? 'Exercise' : 'Exercises'} • {totalDateSets} Total Sets
              </h3>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {dateActivities.map((act, i) => (
                  <span
                    key={i}
                    className="bg-[#1f3a2c] text-[#8fb89e] px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border border-[#2f5540]"
                  >
                    {act.exerciseName}: {act.setsCount}s ({act.maxWeight}kg max)
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Group Filter Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Exercise Workspace
            </h2>
            <p className="text-xs text-[#cbd5e1] font-medium">
              Filter by group for quick navigation, or browse all movements. Repeat each movement every 3 days.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onNavigateToRoutines}
              className="flex items-center space-x-1 text-xs text-[#cbd5e1] hover:text-white font-bold py-2 px-3 rounded-xl hover:bg-[#344e5e] transition border border-transparent hover:border-[#4e7085]"
            >
              <span>Manage Groups</span>
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

        {/* Navigation Group Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
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

          {routines.map((routine) => {
            const isSelected = activeRoutineId === routine.id;

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
        </div>
      </div>

      {/* Search & Exercise Count Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search exercises by name (e.g. Bench, Squat, Curl)..."
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
            Load the starter Push / Pull / Legs / Core exercises to immediately start tracking and mastering your movements!
          </p>
          <button
            onClick={() => loadStarterRoutines()}
            className="inline-flex items-center space-x-1.5 bg-[#8bb4cb] text-[#0e2938] border border-[#749fb7] text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm hover:bg-[#749fb7] transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Load Push / Pull / Legs / Core Starter Plan</span>
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
              selectedDate={selectedDate}
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
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
};
