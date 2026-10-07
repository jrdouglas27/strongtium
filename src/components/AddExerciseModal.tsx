import React, { useState } from 'react';
import { X, Dumbbell, Plus } from 'lucide-react';
import { useWorkout } from '../context/WorkoutContext';
import { MUSCLE_GROUPS } from '../types/workout';

interface AddExerciseModalProps {
  onClose: () => void;
  defaultRoutineId?: string;
}

export const AddExerciseModal: React.FC<AddExerciseModalProps> = ({
  onClose,
  defaultRoutineId,
}) => {
  const { routines, logExerciseSets } = useWorkout();
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<string>(MUSCLE_GROUPS[0]);
  const [routineId, setRoutineId] = useState(defaultRoutineId || '');
  const [targetSets, setTargetSets] = useState(3);
  const [initialWeight, setInitialWeight] = useState<number | ''>('');
  const [initialReps, setInitialReps] = useState<number | ''>('');
  const [logNow, setLogNow] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const muscleGroups = MUSCLE_GROUPS;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const selectedRoutine = routines.find((r) => r.id === routineId);

      if (logNow && (Number(initialWeight) > 0 || Number(initialReps) > 0)) {
        await logExerciseSets({
          exerciseName: name.trim(),
          targetMuscleGroup: muscle,
          routineId: routineId || undefined,
          routineName: selectedRoutine?.name || undefined,
          sets: Array.from({ length: targetSets }, (_, i) => ({
            setNumber: i + 1,
            weight: Number(initialWeight) || 0,
            reps: Number(initialReps) || 0,
          })),
        });
      } else {
        // Just log a blank initial set or placeholder to establish identity
        await logExerciseSets({
          exerciseName: name.trim(),
          targetMuscleGroup: muscle,
          routineId: routineId || undefined,
          routineName: selectedRoutine?.name || undefined,
          sets: [
            {
              setNumber: 1,
              weight: Number(initialWeight) || 0,
              reps: Number(initialReps) || 0,
            },
          ],
        });
      }
      onClose();
    } catch (err) {
      console.error('Failed to create exercise:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-[#f1f5f9]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-[#2d4554] border border-[#3f5d70] rounded-xl text-[#8bb4cb]">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Add New Exercise</h3>
              <p className="text-xs text-[#cbd5e1] font-medium">Create and track an exercise</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#94a3b8] hover:text-white rounded-lg hover:bg-[#2d4554] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-white mb-1">Exercise Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Incline Dumbbell Press, Cable Flys, Romanian Deadlift..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl px-3 py-2.5 text-xs text-white placeholder-[#94a3b8] focus:outline-none focus:border-[#8bb4cb]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-white mb-1">Target Muscle</label>
              <select
                value={muscle}
                onChange={(e) => setMuscle(e.target.value)}
                className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#8bb4cb]"
              >
                {muscleGroups.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-white mb-1">Assign to Routine (Optional)</label>
              <select
                value={routineId}
                onChange={(e) => setRoutineId(e.target.value)}
                className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#8bb4cb]"
              >
                <option value="">No Routine (Standalone)</option>
                {routines.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-[#2d4554] border border-[#3f5d70] rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white">Log initial sets now?</label>
              <input
                type="checkbox"
                checked={logNow}
                onChange={(e) => setLogNow(e.target.checked)}
                className="w-4 h-4 rounded text-[#8bb4cb] focus:ring-0 cursor-pointer"
              />
            </div>

            {logNow && (
              <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                <div>
                  <span className="text-[10px] text-[#94a3b8] font-bold block mb-1">Target Sets</span>
                  <input
                    type="number"
                    value={targetSets}
                    onChange={(e) => setTargetSets(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-[#3d5a6c] border border-[#4e7085] rounded-lg p-2 text-white font-mono text-center"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-[#94a3b8] font-bold block mb-1">Weight (kg)</span>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="0"
                    value={initialWeight}
                    onChange={(e) => setInitialWeight(parseFloat(e.target.value) || '')}
                    className="w-full bg-[#3d5a6c] border border-[#4e7085] rounded-lg p-2 text-white font-mono text-center"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-[#94a3b8] font-bold block mb-1">Reps</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={initialReps}
                    onChange={(e) => setInitialReps(parseInt(e.target.value, 10) || '')}
                    className="w-full bg-[#3d5a6c] border border-[#4e7085] rounded-lg p-2 text-white font-mono text-center"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[#2d4554] hover:bg-[#253946] text-white border border-[#3f5d70] font-bold py-2.5 rounded-xl text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 flex items-center justify-center space-x-1.5 bg-[#8bb4cb] hover:bg-[#749fb7] text-[#0e2938] border border-[#749fb7] font-extrabold py-2.5 rounded-xl text-xs transition disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Creating...' : 'Create Exercise'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
