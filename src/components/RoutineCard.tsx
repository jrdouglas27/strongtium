import React from 'react';
import { Play, Calendar, Dumbbell, Clock, Flame, ChevronRight } from 'lucide-react';
import { Routine } from '../types/workout';
import { calculateRoutineDueStatus, formatRelativeDays } from '../lib/calculations';

interface RoutineCardProps {
  routine: Routine;
  onStart: (routine: Routine) => void;
  onEdit?: (routine: Routine) => void;
}

export const RoutineCard: React.FC<RoutineCardProps> = ({ routine, onStart, onEdit }) => {
  const dueStatus = calculateRoutineDueStatus(
    routine.last_completed_at,
    routine.target_rest_days || 3
  );

  const getBadgeStyle = () => {
    switch (dueStatus.badgeColor) {
      case 'red':
        return 'bg-[#cc8d8d] text-[#3b1212] border-[#b87676]';
      case 'amber':
        return 'bg-[#c9bda9] text-[#332919] border-[#b3a58e]';
      case 'green':
        return 'bg-[#8fb89e] text-[#0e2a18] border-[#78a387]';
      case 'blue':
        return 'bg-[#8bb4cb] text-[#0e2938] border-[#749fb7]';
      default:
        return 'bg-[#2d4554] text-[#cbd5e1] border-[#3f5d70]';
    }
  };

  const isDueOrOverdue = dueStatus.status === 'due' || dueStatus.status === 'never_done';

  return (
    <div
      className={`rounded-2xl border transition-colors p-5 shadow-sm flex flex-col justify-between ${
        isDueOrOverdue
          ? 'bg-[#3d5a6c] border-[#749fb7] ring-2 ring-[#8bb4cb]'
          : 'bg-[#3d5a6c] border-[#4e7085]'
      }`}
    >
      <div>
        {/* Top Header & Due Badge */}
        <div className="flex items-start justify-between gap-2.5 mb-2">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              {routine.name}
            </h3>
            {routine.description && (
              <p className="text-xs text-[#cbd5e1] line-clamp-1 mt-0.5 font-medium">{routine.description}</p>
            )}
          </div>

          <span
            className={`px-2 py-0.5 rounded-md text-xs font-bold border flex items-center space-x-1 shrink-0 ${getBadgeStyle()}`}
          >
            {dueStatus.badgeColor === 'amber' || dueStatus.badgeColor === 'red' ? (
              <Flame className="w-3 h-3" />
            ) : (
              <Clock className="w-3 h-3" />
            )}
            <span>{dueStatus.badgeText}</span>
          </span>
        </div>

        {/* Cadence Info */}
        <div className="flex items-center space-x-3 text-xs text-[#cbd5e1] mb-3.5 font-mono font-medium">
          <span className="flex items-center space-x-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Cycle: every {routine.target_rest_days || 3}d</span>
          </span>
          <span>•</span>
          <span>Last: {formatRelativeDays(routine.last_completed_at)}</span>
        </div>

        {/* Exercises Preview */}
        <div className="space-y-1.5 mb-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
            Exercises ({routine.exercises?.length || 0})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {routine.exercises && routine.exercises.length > 0 ? (
              routine.exercises.map((re, idx) => (
                <span
                  key={idx}
                  className="bg-[#2d4554] text-[#f1f5f9] text-xs px-2.5 py-1 rounded-md border border-[#3f5d70] flex items-center space-x-1 font-medium"
                >
                  <Dumbbell className="w-3 h-3 text-[#8bb4cb]" />
                  <span>{re.exercise?.name || 'Exercise'}</span>
                  <span className="text-[10px] text-[#94a3b8] font-mono">
                    ({re.target_sets}s)
                  </span>
                </span>
              ))
            ) : (
              <span className="text-xs text-[#94a3b8] italic">No exercises added</span>
            )}
          </div>
        </div>
      </div>

      {/* Start Button & Edit Option */}
      <div className="pt-3 border-t border-[#4e7085] flex items-center space-x-2">
        <button
          onClick={() => onStart(routine)}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-bold transition ${
            isDueOrOverdue
              ? 'bg-[#8fb89e] hover:bg-[#7ea98d] text-[#0e2a18] border border-[#78a387]'
              : 'bg-[#2d4554] hover:bg-[#253946] text-[#f1f5f9] border border-[#3f5d70]'
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Start Workout</span>
        </button>

        {onEdit && (
          <button
            onClick={() => onEdit(routine)}
            className="p-2.5 bg-[#2d4554] hover:bg-[#253946] text-[#cbd5e1] hover:text-white rounded-xl border border-[#3f5d70] transition"
            title="Edit Routine"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
