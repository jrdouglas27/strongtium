import React, { useMemo } from 'react';
import {
  Flame,
  Plus,
  Play,
  Sparkles,
  ArrowRight,
  CalendarCheck,
} from 'lucide-react';
import { useWorkout } from '../context/WorkoutContext';
import { RoutineCard } from './RoutineCard';
import { calculateRoutineDueStatus, formatRelativeDays } from '../lib/calculations';
import { Routine } from '../types/workout';

interface WorkoutsHubProps {
  onStartRoutine: (routine?: Routine) => void;
  onNavigateToRoutines: () => void;
}

export const WorkoutsHub: React.FC<WorkoutsHubProps> = ({
  onStartRoutine,
  onNavigateToRoutines,
}) => {
  const { routines, sessions, loading, loadStarterRoutines } = useWorkout();

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

  const lastSession = sessions.find((s) => s.completed_at);

  if (loading && routines.length === 0) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-white font-medium">Loading your workouts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Zero-Activation Hero Prompt: Primary Due Routine (Muted Non-Bright Slate Surface) */}
      {mostDueRoutine && (
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-5 sm:p-6 shadow-md text-[#f1f5f9]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center space-x-1.5 bg-[#8bb4cb] text-[#0e2938] px-3 py-1 rounded-md text-xs font-bold border border-[#749fb7]">
                <Flame className="w-3.5 h-3.5 text-[#0e2938]" />
                <span>UP NEXT IN ROTATION</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {mostDueRoutine.name}
              </h2>
              <p className="text-xs text-[#cbd5e1] max-w-lg font-medium">
                Last completed {formatRelativeDays(mostDueRoutine.last_completed_at)}. Previous performance and notes are loaded for today's session.
              </p>
            </div>

            <button
              onClick={() => onStartRoutine(mostDueRoutine)}
              className="flex items-center justify-center space-x-2 bg-[#8fb89e] hover:bg-[#7ea98d] text-[#0e2a18] border border-[#78a387] font-extrabold px-6 py-3.5 rounded-xl text-xs transition shrink-0 shadow-sm"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>START THIS WORKOUT</span>
            </button>
          </div>
        </div>
      )}

      {/* Routine Splits Section */}
      <div>
        {/* Crisp Bold White Heading on Deep Slate Background */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-extrabold text-white tracking-tight">Workout Routines</h3>
            <span className="text-xs text-[#94a3b8] font-mono font-bold">({routines.length})</span>
          </div>

          <button
            onClick={onNavigateToRoutines}
            className="text-xs text-white font-bold underline hover:text-[#8bb4cb] flex items-center space-x-1"
          >
            <span>Manage All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {routines.length === 0 ? (
          <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-8 text-center space-y-3">
            <p className="text-xs text-[#cbd5e1] font-medium">
              You haven't set up any workout routines yet. Load the starter Push/Pull/Legs templates to begin!
            </p>
            <button
              onClick={() => loadStarterRoutines()}
              className="inline-flex items-center space-x-1.5 bg-[#8bb4cb] text-[#0e2938] border border-[#749fb7] text-xs font-bold px-4 py-2 rounded-xl shadow-sm hover:bg-[#749fb7] transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load Push / Pull / Legs</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {routines.map((routine) => (
              <RoutineCard
                key={routine.id}
                routine={routine}
                onStart={onStartRoutine}
                onEdit={onNavigateToRoutines}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions & Recent Summary (Muted Slate Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Quick Blank Workout */}
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <h4 className="font-bold text-sm text-white">Freeform Session</h4>
            <p className="text-xs text-[#cbd5e1] font-medium">Log arbitrary exercises without a routine</p>
          </div>
          <button
            onClick={() => onStartRoutine()}
            className="flex items-center space-x-1.5 bg-[#b9a1c6] hover:bg-[#a48ab2] text-[#2e1837] border border-[#a48ab2] text-xs font-bold px-3 py-2 rounded-xl transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ad-Hoc Log</span>
          </button>
        </div>

        {/* Last Workout Summary */}
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <h4 className="font-bold text-sm text-white">Last Completed</h4>
            <p className="text-xs text-[#cbd5e1] font-medium">
              {lastSession
                ? `${lastSession.routine_name} (${formatRelativeDays(lastSession.completed_at)})`
                : 'No session logged yet'}
            </p>
          </div>
          <div className="text-[#0e2938] p-2 bg-[#8bb4cb] border border-[#749fb7] rounded-xl">
            <CalendarCheck className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
};
