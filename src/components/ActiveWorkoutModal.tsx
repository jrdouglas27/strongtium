import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Plus,
  Trash2,
  Clock,
  Award,
  History,
  AlertCircle,
  Save,
  MessageSquareQuote,
} from 'lucide-react';
import { useWorkout } from '../context/WorkoutContext';
import { calculate1RM, calculateVolume } from '../lib/calculations';

interface ActiveWorkoutModalProps {
  onClose: () => void;
}

export const ActiveWorkoutModal: React.FC<ActiveWorkoutModalProps> = ({ onClose }) => {
  const {
    activeSession,
    cancelActiveSession,
    saveCompletedSession,
    getLastPerformance,
    personalRecords,
  } = useWorkout();

  if (!activeSession) return null;

  const [exercises, setExercises] = useState(activeSession.exercises);
  const [sessionNotes, setSessionNotes] = useState('');
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Live timer
  useEffect(() => {
    const startTime = new Date(activeSession.startedAt).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      setSecondsElapsed(Math.floor((now - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession.startedAt]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleUpdateSet = (
    exIdx: number,
    setIdx: number,
    field: 'weight' | 'reps' | 'isCompleted',
    value: any
  ) => {
    const updated = [...exercises];
    const targetSet = { ...updated[exIdx].sets[setIdx], [field]: value };
    updated[exIdx].sets[setIdx] = targetSet;
    setExercises(updated);
  };

  const handleQuickAdjust = (
    exIdx: number,
    setIdx: number,
    field: 'weight' | 'reps',
    delta: number
  ) => {
    const updated = [...exercises];
    const currentVal = Number(updated[exIdx].sets[setIdx][field]) || 0;
    const newVal = Math.max(0, Math.round((currentVal + delta) * 10) / 10);
    updated[exIdx].sets[setIdx][field] = newVal;
    setExercises(updated);
  };

  const handleAddSet = (exIdx: number) => {
    const updated = [...exercises];
    const targetEx = updated[exIdx];
    const lastSet = targetEx.sets[targetEx.sets.length - 1];
    targetEx.sets.push({
      setNumber: targetEx.sets.length + 1,
      weight: lastSet ? lastSet.weight : 0,
      reps: lastSet ? lastSet.reps : 0,
      isCompleted: false,
    });
    setExercises(updated);
  };

  const handleRemoveSet = (exIdx: number, setIdx: number) => {
    const updated = [...exercises];
    updated[exIdx].sets.splice(setIdx, 1);
    updated[exIdx].sets.forEach((s, i) => {
      s.setNumber = i + 1;
    });
    setExercises(updated);
  };

  const handleUpdateNotes = (exIdx: number, notes: string) => {
    const updated = [...exercises];
    updated[exIdx].notes = notes;
    setExercises(updated);
  };

  const totalSetsCompleted = exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.isCompleted || (s.weight > 0 && s.reps > 0)).length,
    0
  );

  const totalVolume = exercises.reduce(
    (acc, ex) =>
      acc +
      ex.sets.reduce((sAcc, s) => sAcc + calculateVolume(Number(s.weight), Number(s.reps)), 0),
    0
  );

  // Detect PRs in current session
  const detectedPRs: { exerciseName: string; type: string; value: string }[] = [];
  exercises.forEach((ex) => {
    const currentPR = personalRecords[ex.name.trim()];
    ex.sets.forEach((s) => {
      const w = Number(s.weight);
      const r = Number(s.reps);
      const est1RM = calculate1RM(w, r);

      if (currentPR) {
        if (w > currentPR.max_weight && w > 0) {
          detectedPRs.push({
            exerciseName: ex.name,
            type: 'Max Weight PR',
            value: `${w} kg`,
          });
        } else if (est1RM > currentPR.best_estimated_1rm && est1RM > 0) {
          detectedPRs.push({
            exerciseName: ex.name,
            type: '1RM PR',
            value: `${est1RM} kg est. 1RM`,
          });
        }
      } else if (w > 0 && r > 0) {
        detectedPRs.push({
          exerciseName: ex.name,
          type: 'New Baseline PR',
          value: `${w} kg × ${r}`,
        });
      }
    });
  });

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      const completedAt = new Date().toISOString();
      await saveCompletedSession({
        routineId: activeSession.routineId,
        routineName: activeSession.routineName,
        startedAt: activeSession.startedAt,
        completedAt,
        sessionNotes,
        exercises: exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          exerciseName: ex.name,
          exerciseNotes: ex.notes,
          sets: ex.sets
            .filter((s) => s.weight > 0 || s.reps > 0 || s.isCompleted)
            .map((s) => ({
              setNumber: s.setNumber,
              weight: Number(s.weight) || 0,
              reps: Number(s.reps) || 0,
            })),
        })),
      });
      onClose();
    } catch (err) {
      console.error('Failed to finish workout:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2f4858] flex flex-col overflow-hidden text-[#f1f5f9]">
      {/* Top Session Bar */}
      <div className="bg-[#223541] border-b border-[#182731] px-4 py-3 sm:px-6 flex items-center justify-between shadow-md text-white">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-[#8fb89e]" />
          <div>
            <h2 className="font-bold text-base sm:text-lg tracking-tight text-white leading-tight">
              {activeSession.routineName}
            </h2>
            <div className="flex items-center space-x-2 text-xs text-[#94a3b8]">
              <span className="flex items-center space-x-1 font-mono text-[#8bb4cb] font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatTimer(secondsElapsed)}</span>
              </span>
              <span>•</span>
              <span>{totalSetsCompleted} sets logged</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              if (confirm('Discard this workout session?')) {
                cancelActiveSession();
                onClose();
              }
            }}
            className="p-2 text-[#94a3b8] hover:text-[#cc8d8d] hover:bg-[#1b2b35] rounded-lg transition"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowFinishConfirm(true)}
            className="flex items-center space-x-1.5 bg-[#8fb89e] hover:bg-[#7ea98d] text-[#0e2a18] border border-[#78a387] px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Finish</span>
          </button>
        </div>
      </div>

      {/* Main Exercises Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6 space-y-5 max-w-3xl mx-auto w-full pb-24">
        {exercises.map((ex, exIdx) => {
          const lastPerf = getLastPerformance(ex.name);

          return (
            <div
              key={exIdx}
              className="bg-[#3d5a6c] rounded-2xl border border-[#4e7085] p-4 sm:p-5 shadow-sm"
            >
              {/* Exercise Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {ex.name}
                  </h3>
                  <span className="text-xs text-[#cbd5e1] font-medium">Target: {ex.targetSets} sets</span>
                </div>
              </div>

              {/* Previous Performance Banner (Muted Inset Box) */}
              <div className="mb-4 bg-[#2d4554] rounded-xl p-3 border border-[#3f5d70]">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-[#8bb4cb] mb-1.5">
                  <History className="w-3.5 h-3.5" />
                  <span>PREVIOUS PERFORMANCE</span>
                </div>

                {lastPerf ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {lastPerf.sets.map((s, i) => (
                        <span
                          key={i}
                          className="bg-[#3d5a6c] px-2 py-0.5 rounded-md text-[#f1f5f9] font-mono border border-[#3f5d70] font-semibold"
                        >
                          Set {s.set_number}: <strong className="text-white">{s.weight}kg</strong> × {s.reps}
                        </span>
                      ))}
                    </div>
                    {lastPerf.notes && (
                      <div className="flex items-start space-x-1.5 text-xs text-[#332919] bg-[#c9bda9] px-2.5 py-1 rounded-md border border-[#b3a58e]">
                        <MessageSquareQuote className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#332919]" />
                        <span className="italic">"{lastPerf.notes}"</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[#8bb4cb] flex items-center space-x-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 text-[#8bb4cb]" />
                    <span>First time logging this exercise. Setting your baseline.</span>
                  </p>
                )}
              </div>

              {/* Set Logging Rows */}
              <div className="space-y-2 mb-3.5">
                <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-[#94a3b8] px-1 uppercase tracking-wider">
                  <span className="col-span-2 text-center">Set</span>
                  <span className="col-span-5 text-center">Weight (kg)</span>
                  <span className="col-span-4 text-center">Reps</span>
                  <span className="col-span-1 text-center"></span>
                </div>

                {ex.sets.map((set, setIdx) => (
                  <div
                    key={setIdx}
                    className={`grid grid-cols-12 gap-2 items-center p-1.5 rounded-xl border transition-colors ${
                      set.isCompleted
                        ? 'bg-[#274a38] border-[#3c6e54]'
                        : 'bg-[#2d4554] border-[#3f5d70]'
                    }`}
                  >
                    {/* Set Number */}
                    <div className="col-span-2 flex items-center justify-center">
                      <span className="w-6 h-6 rounded-full bg-[#3d5a6c] text-[#f1f5f9] border border-[#3f5d70] flex items-center justify-center text-xs font-bold font-mono">
                        {set.setNumber}
                      </span>
                    </div>

                    {/* Weight Input with Steppers */}
                    <div className="col-span-5 flex items-center space-x-1 bg-[#3d5a6c] rounded-lg p-1 border border-[#3f5d70]">
                      <button
                        type="button"
                        onClick={() => handleQuickAdjust(exIdx, setIdx, 'weight', -2.5)}
                        className="w-7 h-7 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center border border-[#3f5d70]"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step="0.5"
                        value={set.weight || ''}
                        placeholder="0"
                        onChange={(e) =>
                          handleUpdateSet(
                            exIdx,
                            setIdx,
                            'weight',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full bg-transparent text-center text-white font-mono font-bold text-sm focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleQuickAdjust(exIdx, setIdx, 'weight', 2.5)}
                        className="w-7 h-7 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center border border-[#3f5d70]"
                      >
                        +
                      </button>
                    </div>

                    {/* Reps Input with Steppers */}
                    <div className="col-span-4 flex items-center space-x-1 bg-[#3d5a6c] rounded-lg p-1 border border-[#3f5d70]">
                      <button
                        type="button"
                        onClick={() => handleQuickAdjust(exIdx, setIdx, 'reps', -1)}
                        className="w-7 h-7 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center border border-[#3f5d70]"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step="1"
                        value={set.reps || ''}
                        placeholder="0"
                        onChange={(e) =>
                          handleUpdateSet(
                            exIdx,
                            setIdx,
                            'reps',
                            parseInt(e.target.value, 10) || 0
                          )
                        }
                        className="w-full bg-transparent text-center text-white font-mono font-bold text-sm focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleQuickAdjust(exIdx, setIdx, 'reps', 1)}
                        className="w-7 h-7 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center border border-[#3f5d70]"
                      >
                        +
                      </button>
                    </div>

                    {/* Checkmark */}
                    <div className="col-span-1 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSet(exIdx, setIdx, 'isCompleted', !set.isCompleted)
                        }
                        className={`w-7 h-7 rounded-lg flex items-center justify-center border transition ${
                          set.isCompleted
                            ? 'bg-[#8fb89e] text-[#0e2a18] border-[#78a387]'
                            : 'bg-[#3d5a6c] text-[#94a3b8] hover:text-white border-[#3f5d70]'
                        }`}
                        title="Mark complete"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Set Actions */}
              <div className="flex items-center justify-between pt-1 border-t border-[#4e7085] mb-3">
                <button
                  type="button"
                  onClick={() => handleAddSet(exIdx)}
                  className="flex items-center space-x-1 text-xs font-bold text-[#8bb4cb] hover:underline py-1 px-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Set</span>
                </button>

                {ex.sets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSet(exIdx, ex.sets.length - 1)}
                    className="flex items-center space-x-1 text-xs text-[#cc8d8d] hover:underline py-1 px-1.5 font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Set</span>
                  </button>
                )}
              </div>

              {/* Plain Text Note Field */}
              <div>
                <input
                  type="text"
                  placeholder="How did this exercise feel? (e.g. Smooth, pause on bottom, +2.5kg next time)"
                  value={ex.notes}
                  onChange={(e) => handleUpdateNotes(exIdx, e.target.value)}
                  className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl px-3 py-2 text-xs text-[#f1f5f9] placeholder-[#94a3b8] focus:outline-none focus:border-[#8bb4cb]"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation & Finish Modal */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-xl bg-[#8fb89e] text-[#0e2a18] border border-[#78a387] flex items-center justify-center mx-auto mb-2">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-extrabold text-white">Workout Complete!</h3>
              <p className="text-xs text-[#cbd5e1] font-medium">
                Logged {totalSetsCompleted} sets • Total Volume: {Math.round(totalVolume)} kg
              </p>
            </div>

            {/* PR Highlights if any */}
            {detectedPRs.length > 0 && (
              <div className="bg-[#cc8d8d] border border-[#b87676] rounded-xl p-3 space-y-1.5">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-[#3b1212]">
                  <Award className="w-4 h-4" />
                  <span>PERSONAL RECORD ACHIEVEMENTS!</span>
                </div>
                <div className="space-y-1">
                  {detectedPRs.slice(0, 3).map((pr, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-[#3b1212] font-semibold">{pr.exerciseName}</span>
                      <span className="text-[#3b1212] font-mono font-bold">{pr.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Session Notes */}
            <div>
              <label className="block text-xs font-bold text-white mb-1">
                Session Reflection Note (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Overall energy, recovery, or notes for next time..."
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl p-2.5 text-xs text-[#f1f5f9] placeholder-[#94a3b8] focus:outline-none focus:border-[#8bb4cb]"
              />
            </div>

            {/* Actions */}
            <div className="flex space-x-3 pt-1">
              <button
                type="button"
                onClick={() => setShowFinishConfirm(false)}
                className="flex-1 bg-[#2d4554] hover:bg-[#253946] text-white border border-[#3f5d70] font-bold py-2.5 rounded-xl text-xs transition"
              >
                Keep Logging
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleFinish}
                className="flex-1 flex items-center justify-center space-x-1.5 bg-[#8fb89e] hover:bg-[#7ea98d] text-[#0e2a18] border border-[#78a387] font-extrabold py-2.5 rounded-xl text-xs transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Workout'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
