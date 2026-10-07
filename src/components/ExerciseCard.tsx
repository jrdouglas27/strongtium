import React, { useState, useEffect } from 'react';
import {
  Dumbbell,
  History,
  Plus,
  Trash2,
  Check,
  Award,
  ChevronDown,
  ChevronUp,
  MessageSquareQuote,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { useWorkout } from '../context/WorkoutContext';
import { calculateVolume, formatRelativeDays, formatDate } from '../lib/calculations';

interface ExerciseCardProps {
  exerciseName: string;
  targetMuscleGroup?: string;
  routineName?: string;
  routineId?: string;
  targetSets?: number;
  onFocusRoutine?: (routineId: string) => void;
}

interface SetRowState {
  setNumber: number;
  weight: number;
  reps: number;
  isCompleted: boolean;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exerciseName,
  targetMuscleGroup = 'General',
  routineName,
  routineId,
  targetSets = 3,
}) => {
  const {
    getLastPerformance,
    personalRecords,
    logExerciseSets,
    getExerciseHistory,
    sessions,
  } = useWorkout();

  const lastPerf = getLastPerformance(exerciseName);
  const pr = personalRecords[exerciseName.trim()];
  const history = getExerciseHistory(exerciseName);

  // Check if this exercise was already logged today
  const todayStr = new Date().toDateString();
  const todayEntry = sessions
    .filter((s) => s.completed_at && new Date(s.completed_at).toDateString() === todayStr)
    .flatMap((s) => s.logged_exercises || [])
    .find((le) => le.exercise_name.trim().toLowerCase() === exerciseName.trim().toLowerCase());

  const [sets, setSets] = useState<SetRowState[]>(() => {
    if (todayEntry && todayEntry.sets.length > 0) {
      return todayEntry.sets.map((s) => ({
        setNumber: s.set_number,
        weight: Number(s.weight),
        reps: Number(s.reps),
        isCompleted: true,
      }));
    }

    // Default sets from last performance or blank
    const count = targetSets || 3;
    return Array.from({ length: count }, (_, i) => {
      const prevSet = lastPerf?.sets[i] || lastPerf?.sets[lastPerf?.sets.length - 1];
      return {
        setNumber: i + 1,
        weight: prevSet ? prevSet.weight : 0,
        reps: prevSet ? prevSet.reps : 0,
        isCompleted: false,
      };
    });
  });

  const [notes, setNotes] = useState<string>(todayEntry?.exercise_notes || '');
  const [showHistory, setShowHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Sync state if today's entry updates
  useEffect(() => {
    if (todayEntry && todayEntry.sets.length > 0) {
      setSets(
        todayEntry.sets.map((s) => ({
          setNumber: s.set_number,
          weight: Number(s.weight),
          reps: Number(s.reps),
          isCompleted: true,
        }))
      );
      if (todayEntry.exercise_notes) {
        setNotes(todayEntry.exercise_notes);
      }
    }
  }, [todayEntry]);

  const handleUpdateSet = (setIdx: number, field: 'weight' | 'reps', value: number) => {
    const updated = [...sets];
    updated[setIdx] = {
      ...updated[setIdx],
      [field]: Math.max(0, value),
    };
    setSets(updated);
  };

  const handleQuickAdjust = (setIdx: number, field: 'weight' | 'reps', delta: number) => {
    const updated = [...sets];
    const current = Number(updated[setIdx][field]) || 0;
    const nextVal = Math.max(0, Math.round((current + delta) * 10) / 10);
    updated[setIdx] = {
      ...updated[setIdx],
      [field]: nextVal,
    };
    setSets(updated);
  };

  const handleToggleComplete = (setIdx: number) => {
    const updated = [...sets];
    updated[setIdx] = {
      ...updated[setIdx],
      isCompleted: !updated[setIdx].isCompleted,
    };
    setSets(updated);
  };

  const handleAddSet = () => {
    const lastSet = sets[sets.length - 1];
    setSets([
      ...sets,
      {
        setNumber: sets.length + 1,
        weight: lastSet ? lastSet.weight : 0,
        reps: lastSet ? lastSet.reps : 0,
        isCompleted: false,
      },
    ]);
  };

  const handleRemoveSet = (setIdx: number) => {
    if (sets.length <= 1) return;
    const updated = sets.filter((_, i) => i !== setIdx).map((s, i) => ({ ...s, setNumber: i + 1 }));
    setSets(updated);
  };

  const handlePrefillLast = () => {
    if (!lastPerf || lastPerf.sets.length === 0) return;
    const newSets = lastPerf.sets.map((ps, idx) => ({
      setNumber: idx + 1,
      weight: ps.weight,
      reps: ps.reps,
      isCompleted: false,
    }));
    setSets(newSets);
  };

  const handleSaveSets = async () => {
    const valid = sets.filter((s) => s.weight > 0 || s.reps > 0);
    if (valid.length === 0) return;

    setIsSaving(true);
    try {
      await logExerciseSets({
        exerciseName,
        targetMuscleGroup,
        routineId,
        routineName,
        exerciseNotes: notes,
        sets: valid.map((s, idx) => ({
          setNumber: idx + 1,
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
        })),
      });

      // Mark all valid sets as completed
      setSets((prev) => prev.map((s) => ({ ...s, isCompleted: true })));
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      console.error('Failed to log exercise sets:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const currentVolume = sets.reduce(
    (acc, s) => acc + calculateVolume(Number(s.weight), Number(s.reps)),
    0
  );

  return (
    <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 hover:border-[#749fb7]/70 transition">
      {/* Exercise Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {routineName && (
              <span className="bg-[#8bb4cb] text-[#0e2938] text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-[#749fb7] uppercase tracking-wider">
                {routineName}
              </span>
            )}
            <span className="bg-[#2d4554] text-[#cbd5e1] text-[10px] font-bold px-2 py-0.5 rounded-md border border-[#3f5d70]">
              {targetMuscleGroup}
            </span>
            {targetSets && (
              <span className="text-[10px] text-[#94a3b8] font-mono font-medium">
                {targetSets} Target Sets
              </span>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center space-x-2">
            <Dumbbell className="w-4 h-4 text-[#8bb4cb] shrink-0" />
            <span>{exerciseName}</span>
          </h3>
        </div>

        {/* PR Tag if achieved */}
        {pr && (
          <div className="bg-[#cc8d8d] border border-[#b87676] rounded-xl px-2.5 py-1 text-right shrink-0">
            <div className="flex items-center justify-end space-x-1 text-[10px] font-bold text-[#3b1212]">
              <Award className="w-3 h-3 text-[#3b1212]" />
              <span>PR</span>
            </div>
            <div className="font-mono text-xs font-extrabold text-[#3b1212]">
              {pr.max_weight}kg <span className="text-[10px]">({pr.best_estimated_1rm}kg 1RM)</span>
            </div>
          </div>
        )}
      </div>

      {/* Previous Performance Recall Box */}
      <div className="bg-[#2d4554] border border-[#3f5d70] rounded-xl p-3 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-[#8bb4cb] font-bold">
            <History className="w-3.5 h-3.5" />
            <span>PREVIOUS SESSION</span>
          </div>

          {lastPerf && (
            <span className="text-[11px] text-[#94a3b8] font-mono font-medium">
              {formatRelativeDays(lastPerf.last_performed_at)}
            </span>
          )}
        </div>

        {lastPerf ? (
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1.5">
              {lastPerf.sets.map((ps, idx) => (
                <span
                  key={idx}
                  className="bg-[#3d5a6c] text-[#f1f5f9] px-2 py-0.5 rounded-md font-mono border border-[#4e7085] font-semibold text-[11px]"
                >
                  Set {ps.set_number}: <strong className="text-white">{ps.weight}kg</strong> × {ps.reps}
                </span>
              ))}
            </div>
            {lastPerf.notes && (
              <div className="flex items-start space-x-1.5 text-[#332919] bg-[#c9bda9] px-2.5 py-1 rounded-md border border-[#b3a58e] text-[11px]">
                <MessageSquareQuote className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#332919]" />
                <span className="italic">"{lastPerf.notes}"</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[#94a3b8] text-[11px] italic">
            First time tracking this exercise! Log your baseline sets below.
          </p>
        )}
      </div>

      {/* Today Status Pill if already logged */}
      {todayEntry && (
        <div className="bg-[#274a38] border border-[#3c6e54] text-[#8fb89e] px-3 py-1.5 rounded-xl text-xs flex items-center justify-between font-medium">
          <div className="flex items-center space-x-1.5">
            <Check className="w-3.5 h-3.5 text-[#8fb89e]" />
            <span className="font-bold text-white">Logged Today:</span>
            <span>{todayEntry.sets.length} sets completed</span>
          </div>
          <span className="font-mono text-[11px] text-white/90">
            {todayEntry.sets.reduce((acc, s) => acc + Number(s.weight) * Number(s.reps), 0)} kg volume
          </span>
        </div>
      )}

      {/* Free-Flowing Inline Set Inputs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] px-1">
          <span>Log Today's Sets</span>
          {lastPerf && (
            <button
              type="button"
              onClick={handlePrefillLast}
              className="text-[#8bb4cb] hover:underline flex items-center space-x-1 capitalize font-bold"
            >
              <Sparkles className="w-3 h-3" />
              <span>Match last session</span>
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          {sets.map((s, idx) => (
            <div
              key={idx}
              className={`grid grid-cols-12 gap-1.5 sm:gap-2 items-center p-1.5 rounded-xl border transition-colors ${
                s.isCompleted
                  ? 'bg-[#274a38]/80 border-[#3c6e54]'
                  : 'bg-[#2d4554] border-[#3f5d70]'
              }`}
            >
              {/* Set Label */}
              <div className="col-span-2 flex items-center justify-center">
                <span className="w-6 h-6 rounded-md bg-[#3d5a6c] text-[#f1f5f9] border border-[#3f5d70] flex items-center justify-center text-xs font-bold font-mono">
                  S{s.setNumber}
                </span>
              </div>

              {/* Weight with +/- Steppers */}
              <div className="col-span-5 flex items-center space-x-1 bg-[#3d5a6c] rounded-lg p-0.5 sm:p-1 border border-[#3f5d70]">
                <button
                  type="button"
                  onClick={() => handleQuickAdjust(idx, 'weight', -2.5)}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center border border-[#3f5d70] shrink-0"
                >
                  -
                </button>
                <div className="flex-1 text-center min-w-0">
                  <input
                    type="number"
                    step="0.5"
                    value={s.weight === 0 ? '' : s.weight}
                    placeholder="0"
                    onChange={(e) =>
                      handleUpdateSet(idx, 'weight', parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-transparent text-center text-white font-mono font-bold text-xs sm:text-sm focus:outline-none"
                  />
                  <span className="text-[9px] text-[#94a3b8] block -mt-1 font-sans">kg</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickAdjust(idx, 'weight', 2.5)}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center border border-[#3f5d70] shrink-0"
                >
                  +
                </button>
              </div>

              {/* Reps with +/- Steppers */}
              <div className="col-span-4 flex items-center space-x-1 bg-[#3d5a6c] rounded-lg p-0.5 sm:p-1 border border-[#3f5d70]">
                <button
                  type="button"
                  onClick={() => handleQuickAdjust(idx, 'reps', -1)}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center border border-[#3f5d70] shrink-0"
                >
                  -
                </button>
                <div className="flex-1 text-center min-w-0">
                  <input
                    type="number"
                    step="1"
                    value={s.reps === 0 ? '' : s.reps}
                    placeholder="0"
                    onChange={(e) =>
                      handleUpdateSet(idx, 'reps', parseInt(e.target.value, 10) || 0)
                    }
                    className="w-full bg-transparent text-center text-white font-mono font-bold text-xs sm:text-sm focus:outline-none"
                  />
                  <span className="text-[9px] text-[#94a3b8] block -mt-1 font-sans">reps</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickAdjust(idx, 'reps', 1)}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center border border-[#3f5d70] shrink-0"
                >
                  +
                </button>
              </div>

              {/* Toggle/Remove action */}
              <div className="col-span-1 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => handleToggleComplete(idx)}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center border transition ${
                    s.isCompleted
                      ? 'bg-[#8fb89e] text-[#0e2a18] border-[#78a387]'
                      : 'bg-[#3d5a6c] text-[#94a3b8] hover:text-white border-[#3f5d70]'
                  }`}
                  title={s.isCompleted ? 'Mark uncompleted' : 'Mark completed'}
                >
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Set controls: Add / Remove */}
        <div className="flex items-center justify-between text-xs pt-1 px-1">
          <button
            type="button"
            onClick={handleAddSet}
            className="text-[#8bb4cb] hover:underline flex items-center space-x-1 font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Set</span>
          </button>

          {sets.length > 1 && (
            <button
              type="button"
              onClick={() => handleRemoveSet(sets.length - 1)}
              className="text-[#cc8d8d] hover:underline flex items-center space-x-1 font-semibold text-[11px]"
            >
              <Trash2 className="w-3 h-3" />
              <span>Remove Set</span>
            </button>
          )}
        </div>
      </div>

      {/* Optional Note Field */}
      <div>
        <input
          type="text"
          placeholder="Notes on form, resistance, cues (e.g. +2.5kg next week, paused at bottom)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl px-3 py-2 text-xs text-[#f1f5f9] placeholder-[#94a3b8] focus:outline-none focus:border-[#8bb4cb]"
        />
      </div>

      {/* Action Footer: Instant Log & History Button */}
      <div className="pt-2 border-t border-[#4e7085] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="text-xs text-[#cbd5e1] hover:text-white flex items-center justify-center sm:justify-start space-x-1 font-semibold py-1.5 px-2 rounded-lg hover:bg-[#2d4554] transition"
        >
          <History className="w-3.5 h-3.5 text-[#8bb4cb]" />
          <span>Exercise History ({history.length})</span>
          {showHistory ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
        </button>

        <button
          type="button"
          disabled={isSaving}
          onClick={handleSaveSets}
          className={`flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition shadow-sm ${
            justSaved
              ? 'bg-[#8fb89e] text-[#0e2a18] border border-[#78a387]'
              : 'bg-[#8bb4cb] hover:bg-[#749fb7] text-[#0e2938] border border-[#749fb7]'
          }`}
        >
          {justSaved ? (
            <>
              <Check className="w-4 h-4" />
              <span>Saved Successfully!</span>
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>
                {isSaving
                  ? 'Saving...'
                  : todayEntry
                  ? 'Update Logged Sets'
                  : `Log ${sets.filter((s) => s.weight > 0 || s.reps > 0).length || sets.length} Sets (${Math.round(currentVolume)}kg)`}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Exercise Specific History Drilldown */}
      {showHistory && (
        <div className="border-t border-[#4e7085] pt-3 mt-3 space-y-2.5">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#8bb4cb]" />
            <span>Past Performances for {exerciseName}</span>
          </h4>

          {history.length === 0 ? (
            <p className="text-xs text-[#cbd5e1] italic py-2">
              No previous logs recorded yet for this exercise.
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {history.map((h, i) => (
                <div
                  key={i}
                  className="bg-[#2d4554] border border-[#3f5d70] rounded-xl p-2.5 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white font-mono">{formatDate(h.completedAt)}</span>
                    <span className="text-[10px] bg-[#3d5a6c] px-2 py-0.5 rounded text-[#cbd5e1] font-mono">
                      {Math.round(h.totalVolume)}kg vol • Est. 1RM: {h.bestEstimated1RM}kg
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {h.sets.map((st, sIdx) => (
                      <span
                        key={sIdx}
                        className="bg-[#3d5a6c] px-2 py-0.5 rounded text-[11px] font-mono text-[#f1f5f9]"
                      >
                        Set {st.setNumber}: <strong>{st.weight}kg</strong> × {st.reps}
                      </span>
                    ))}
                  </div>

                  {h.notes && (
                    <p className="text-[11px] text-[#cbd5e1] italic mt-1 bg-[#223541] px-2 py-1 rounded">
                      "{h.notes}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
