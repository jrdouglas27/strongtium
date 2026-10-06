import React, { useState } from 'react';
import { Plus, Trash2, Dumbbell, Sparkles } from 'lucide-react';
import { useWorkout } from '../context/WorkoutContext';
import { RoutineEditorModal } from './RoutineEditorModal';

export const RoutinesView: React.FC = () => {
  const { routines, deleteRoutine, loadStarterRoutines } = useWorkout();
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div className="space-y-5 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">Workout Routines</h2>
          <p className="text-xs text-[#cbd5e1] font-medium">
            Custom splits, exercise targets, and 3-day recovery cycles
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {routines.length === 0 && (
            <button
              onClick={() => loadStarterRoutines()}
              className="flex items-center space-x-1.5 bg-[#3d5a6c] hover:bg-[#344e5e] text-white text-xs font-bold px-3 py-2 rounded-xl border border-[#4e7085] transition shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#8bb4cb]" />
              <span>Load Push/Pull/Legs</span>
            </button>
          )}

          <button
            onClick={() => setShowEditor(true)}
            className="flex items-center space-x-1.5 bg-[#8bb4cb] hover:bg-[#749fb7] text-[#0e2938] border border-[#749fb7] text-xs font-extrabold px-3.5 py-2 rounded-xl transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Routine</span>
          </button>
        </div>
      </div>

      {routines.length === 0 ? (
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-10 text-center space-y-3">
          <Dumbbell className="w-10 h-10 text-[#94a3b8] mx-auto" />
          <h3 className="font-bold text-base text-white">No Routines Configured</h3>
          <p className="text-xs text-[#cbd5e1] max-w-sm mx-auto font-medium">
            Create your first workout split or load the standard Push / Pull / Legs starter templates.
          </p>
          <button
            onClick={() => loadStarterRoutines()}
            className="inline-flex items-center space-x-1.5 bg-[#8bb4cb] text-[#0e2938] border border-[#749fb7] text-xs font-bold px-4 py-2 rounded-xl shadow-sm hover:bg-[#749fb7]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Load Push / Pull / Legs</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routines.map((routine) => (
            <div
              key={routine.id}
              className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">{routine.name}</h3>
                    {routine.description && (
                      <p className="text-xs text-[#cbd5e1] mt-0.5 font-medium">{routine.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Delete routine "${routine.name}"?`)) {
                        deleteRoutine(routine.id);
                      }
                    }}
                    className="p-1.5 text-[#94a3b8] hover:text-[#cc8d8d] rounded-lg hover:bg-[#2d4554] transition"
                    title="Delete Routine"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-2.5 flex items-center space-x-2 text-xs text-[#8bb4cb] font-mono font-bold">
                  <span>Cycle cadence: repeat every {routine.target_rest_days || 3} days</span>
                </div>

                <div className="mt-3.5 space-y-1.5">
                  <div className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">
                    Exercises ({routine.exercises?.length || 0})
                  </div>
                  <div className="space-y-1">
                    {routine.exercises?.map((re, idx) => (
                      <div
                        key={idx}
                        className="bg-[#2d4554] px-3 py-1.5 rounded-lg text-xs text-[#f1f5f9] flex items-center justify-between border border-[#3f5d70] font-medium"
                      >
                        <span className="font-semibold">{re.exercise?.name || 'Exercise'}</span>
                        <span className="text-[#94a3b8] font-mono text-[11px]">
                          {re.target_sets} sets
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showEditor && <RoutineEditorModal onClose={() => setShowEditor(false)} />}
    </div>
  );
};
