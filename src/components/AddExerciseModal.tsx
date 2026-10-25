import React, { useState } from 'react';
import { X, Dumbbell, Plus, Calendar } from 'lucide-react';
import { useWorkout } from '../context/WorkoutContext';
import { MUSCLE_GROUPS } from '../types/workout';
import { toLocalISODate, formatWorkoutDateLabel, getLimbTypeForMuscle } from '../lib/calculations';

interface AddExerciseModalProps {
  onClose: () => void;
  defaultRoutineId?: string;
  selectedDate?: string;
}

export const AddExerciseModal: React.FC<AddExerciseModalProps> = ({
  onClose,
  defaultRoutineId,
  selectedDate,
}) => {
  const { routines, logExerciseSets, setExerciseUnilateral, isExerciseUnilateral } = useWorkout();
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<string>(MUSCLE_GROUPS[0]);
  const [routineId, setRoutineId] = useState(defaultRoutineId || '');
  const [targetSets, setTargetSets] = useState<number | ''>(3);
  const [initialWeight, setInitialWeight] = useState<number | ''>('');
  const [initialReps, setInitialReps] = useState<number | ''>('');
  const [splitSides, setSplitSides] = useState(false);
  const userManuallyToggledRef = React.useRef(false);
  const [logNow, setLogNow] = useState(false);
  const [logDate, setLogDate] = useState<string>(selectedDate || toLocalISODate());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!userManuallyToggledRef.current) {
      setSplitSides(isExerciseUnilateral(val, muscle));
    }
  };

  const handleMuscleChange = (val: string) => {
    setMuscle(val);
    if (!userManuallyToggledRef.current) {
      setSplitSides(isExerciseUnilateral(name, val));
    }
  };

  const muscleGroups = MUSCLE_GROUPS;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const selectedRoutine = routines.find((r) => r.id === routineId);

      const now = new Date();
      let loggedAt: string;
      if (logDate === toLocalISODate()) {
        loggedAt = now.toISOString();
      } else {
        const [y, m, d] = logDate.split('-').map(Number);
        const targetDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
        loggedAt = targetDate.toISOString();
      }

      // Persist custom unilateral preference for this exercise
      await setExerciseUnilateral(name.trim(), splitSides);

      const limbType = getLimbTypeForMuscle(muscle);
      const namesToCreate = splitSides
        ? [`${name.trim()} (Left ${limbType})`, `${name.trim()} (Right ${limbType})`]
        : [name.trim()];

      for (const exName of namesToCreate) {
        if (logNow && (Number(initialWeight) > 0 || Number(initialReps) > 0)) {
          await logExerciseSets({
            exerciseName: exName,
            targetMuscleGroup: muscle,
            routineId: routineId || undefined,
            routineName: selectedRoutine?.name || undefined,
            loggedAt,
            sets: Array.from({ length: Number(targetSets) > 0 ? Number(targetSets) : 3 }, (_, i) => ({
              setNumber: i + 1,
              weight: Number(initialWeight) || 0,
              reps: Number(initialReps) || 0,
            })),
          });
        } else {
          await logExerciseSets({
            exerciseName: exName,
            targetMuscleGroup: muscle,
            routineId: routineId || undefined,
            routineName: selectedRoutine?.name || undefined,
            loggedAt,
            sets: [
              {
                setNumber: 1,
                weight: Number(initialWeight) || 0,
                reps: Number(initialReps) || 0,
              },
            ],
          });
        }
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
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl px-3 py-2.5 text-xs text-white placeholder-[#94a3b8] focus:outline-none focus:border-[#8bb4cb]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-white mb-1">Target Muscle</label>
              <select
                value={muscle}
                onChange={(e) => handleMuscleChange(e.target.value)}
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

          <div className="flex items-center justify-between bg-[#2d4554] border border-[#3f5d70] rounded-xl p-3">
            <div>
              <label className="text-xs font-bold text-white block">Unilateral (Left & Right Sides)</label>
              <span className="text-[10px] text-[#cbd5e1]">Enables independent Left & Right arm/leg logging in its exercise box</span>
            </div>
            <input
              type="checkbox"
              checked={splitSides}
              onChange={(e) => {
                userManuallyToggledRef.current = true;
                setSplitSides(e.target.checked);
              }}
              className="w-4 h-4 rounded text-[#8bb4cb] focus:ring-0 cursor-pointer"
            />
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
              <div className="space-y-2 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#94a3b8] font-bold flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-[#8bb4cb]" />
                      <span>Log Date</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#8bb4cb] font-bold">
                      {formatWorkoutDateLabel(logDate)}
                    </span>
                  </div>
                  <input
                    type="date"
                    max={toLocalISODate()}
                    value={logDate}
                    onChange={(e) => {
                      if (e.target.value) setLogDate(e.target.value);
                    }}
                    className="w-full bg-[#3d5a6c] border border-[#4e7085] rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-[#8bb4cb]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-[#94a3b8] font-bold block mb-1">Target Sets</span>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          const cur = Number(targetSets) || 3;
                          setTargetSets(Math.max(1, cur - 1));
                        }}
                        className="w-6 h-8 rounded-lg bg-[#2d4554] hover:bg-[#223541] text-white flex items-center justify-center font-bold text-xs border border-[#3f5d70] transition"
                        title="Decrease sets"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={targetSets}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '') {
                            setTargetSets('');
                          } else {
                            const parsed = parseInt(v, 10);
                            if (!isNaN(parsed)) {
                              setTargetSets(Math.max(1, Math.min(20, parsed)));
                            }
                          }
                        }}
                        onBlur={() => {
                          if (!targetSets || Number(targetSets) < 1) {
                            setTargetSets(3);
                          }
                        }}
                        className="w-full bg-[#3d5a6c] border border-[#4e7085] rounded-lg p-2 text-white font-mono text-center focus:outline-none focus:border-[#8bb4cb]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const cur = Number(targetSets) || 3;
                          setTargetSets(Math.min(20, cur + 1));
                        }}
                        className="w-6 h-8 rounded-lg bg-[#2d4554] hover:bg-[#223541] text-white flex items-center justify-center font-bold text-xs border border-[#3f5d70] transition"
                        title="Increase sets"
                      >
                        +
                      </button>
                    </div>
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
