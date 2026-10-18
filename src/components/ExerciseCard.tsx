import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Copy,
} from 'lucide-react';
import { useWorkout } from '../context/WorkoutContext';
import {
  calculateVolume,
  formatRelativeDays,
  formatDate,
  toLocalISODate,
  formatWorkoutDateLabel,
  getBaseExerciseName,
  getLimbTypeForMuscle,
  isUnilateralMovement,
} from '../lib/calculations';

interface ExerciseCardProps {
  exerciseName: string;
  targetMuscleGroup?: string;
  routineName?: string;
  routineId?: string;
  targetSets?: number;
  onFocusRoutine?: (routineId: string) => void;
  selectedDate?: string;
}

interface BilateralSetState {
  setNumber: number;
  weight: number;
  reps: number;
  isCompleted: boolean;
}

interface UnilateralSetState {
  setNumber: number;
  leftWeight: number;
  leftReps: number;
  rightWeight: number;
  rightReps: number;
  isCompleted: boolean;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exerciseName,
  targetMuscleGroup = 'General',
  routineName,
  routineId,
  targetSets = 3,
  selectedDate,
}) => {
  const {
    getLastPerformance,
    personalRecords,
    logExerciseSets,
    getExerciseHistory,
    sessions,
  } = useWorkout();

  // Determine base exercise name and limb type ('Arm' vs 'Leg')
  const baseName = getBaseExerciseName(exerciseName);
  const limbType = getLimbTypeForMuscle(targetMuscleGroup);
  const leftExerciseName = `${baseName} (Left ${limbType})`;
  const rightExerciseName = `${baseName} (Right ${limbType})`;

  // Determine if this exercise defaults to Unilateral L/R tracking
  const autoUnilateral = useMemo(
    () => isUnilateralMovement(exerciseName, targetMuscleGroup),
    [exerciseName, targetMuscleGroup]
  );

  const [isUnilateral, setIsUnilateral] = useState<boolean>(autoUnilateral);
  const [unilateralViewMode, setUnilateralViewMode] = useState<'combined' | 'columns' | 'left' | 'right'>('combined');

  // Date context: defaults to local today if not specified
  const activeDate = selectedDate || toLocalISODate();
  const isToday = activeDate === toLocalISODate();
  const dateLabel = formatWorkoutDateLabel(activeDate);

  // Retrieve performances
  const leftPerf = getLastPerformance(leftExerciseName) || getLastPerformance(baseName);
  const rightPerf = getLastPerformance(rightExerciseName) || getLastPerformance(baseName);
  const bilateralPerf = getLastPerformance(baseName) || getLastPerformance(exerciseName);

  // Retrieve PRs
  const prLeft = personalRecords[leftExerciseName.trim()];
  const prRight = personalRecords[rightExerciseName.trim()];
  const prBilateral = personalRecords[baseName.trim()] || personalRecords[exerciseName.trim()];

  // Check if already logged on active date
  const findLatestLoggedExercise = useCallback(
    (targetName: string) => {
      const clean = targetName.trim().toLowerCase();
      for (const session of sessions) {
        const d = session.completed_at || session.started_at;
        if (!d || toLocalISODate(new Date(d)) !== activeDate) continue;

        const matches = (session.logged_exercises || []).filter(
          (le) => le.exercise_name.trim().toLowerCase() === clean
        );
        if (matches.length > 0) {
          const withSets = matches.filter((m) => (m.sets || []).length > 0);
          return withSets.length > 0 ? withSets[withSets.length - 1] : matches[matches.length - 1];
        }
      }
      return null;
    },
    [sessions, activeDate]
  );

  const leftLogged = useMemo(
    () => findLatestLoggedExercise(leftExerciseName),
    [findLatestLoggedExercise, leftExerciseName]
  );
  const rightLogged = useMemo(
    () => findLatestLoggedExercise(rightExerciseName),
    [findLatestLoggedExercise, rightExerciseName]
  );
  const baseLogged = useMemo(
    () => findLatestLoggedExercise(baseName),
    [findLatestLoggedExercise, baseName]
  );

  const hasExistingLog = Boolean(
    (isUnilateral && (leftLogged || rightLogged)) || (!isUnilateral && baseLogged)
  );

  // Stable fingerprint of the saved DB state + active date + last performance baseline
  const savedDataFingerprint = useMemo(() => {
    const lId = leftLogged?.id || '';
    const lSets = (leftLogged?.sets || []).map((s) => `${s.set_number}:${s.weight}:${s.reps}`).join(',');
    const rId = rightLogged?.id || '';
    const rSets = (rightLogged?.sets || []).map((s) => `${s.set_number}:${s.weight}:${s.reps}`).join(',');
    const bId = baseLogged?.id || '';
    const bSets = (baseLogged?.sets || []).map((s) => `${s.set_number}:${s.weight}:${s.reps}`).join(',');
    const n = leftLogged?.exercise_notes || rightLogged?.exercise_notes || baseLogged?.exercise_notes || '';

    const perfKey = `${leftPerf?.last_performed_at || ''}_${(leftPerf?.sets || []).map((s) => `${s.weight}x${s.reps}`).join(',')}_${rightPerf?.last_performed_at || ''}_${(rightPerf?.sets || []).map((s) => `${s.weight}x${s.reps}`).join(',')}_${bilateralPerf?.last_performed_at || ''}_${(bilateralPerf?.sets || []).map((s) => `${s.weight}x${s.reps}`).join(',')}`;

    return `${baseName}__${activeDate}__${lId}[${lSets}]__${rId}[${rSets}]__${bId}[${bSets}]__${n}__perf[${perfKey}]`;
  }, [baseName, activeDate, leftLogged, rightLogged, baseLogged, leftPerf, rightPerf, bilateralPerf]);

  const lastLoadedKeyRef = useRef<string>(savedDataFingerprint);
  const isDirtyRef = useRef<boolean>(false);

  // State: Unilateral Sets
  const [uniSets, setUniSets] = useState<UnilateralSetState[]>(() => {
    const leftSets = leftLogged?.sets || [];
    const rightSets = rightLogged?.sets || [];
    const maxLen = Math.max(leftSets.length, rightSets.length);

    if (maxLen > 0) {
      return Array.from({ length: maxLen }, (_, i) => ({
        setNumber: i + 1,
        leftWeight: Number(leftSets[i]?.weight) || 0,
        leftReps: Number(leftSets[i]?.reps) || 0,
        rightWeight: Number(rightSets[i]?.weight) || 0,
        rightReps: Number(rightSets[i]?.reps) || 0,
        isCompleted: true,
      }));
    }

    if (baseLogged && baseLogged.sets.length > 0) {
      return baseLogged.sets.map((s) => ({
        setNumber: s.set_number,
        leftWeight: Number(s.weight),
        leftReps: Number(s.reps),
        rightWeight: Number(s.weight),
        rightReps: Number(s.reps),
        isCompleted: true,
      }));
    }

    // Default from last performance or blank
    const count = targetSets || 3;
    return Array.from({ length: count }, (_, i) => {
      const prevL = leftPerf?.sets[i] || leftPerf?.sets[leftPerf.sets.length - 1];
      const prevR = rightPerf?.sets[i] || rightPerf?.sets[rightPerf.sets.length - 1];
      return {
        setNumber: i + 1,
        leftWeight: prevL ? prevL.weight : 0,
        leftReps: prevL ? prevL.reps : 0,
        rightWeight: prevR ? prevR.weight : (prevL ? prevL.weight : 0),
        rightReps: prevR ? prevR.reps : (prevL ? prevL.reps : 0),
        isCompleted: false,
      };
    });
  });

  // State: Bilateral Sets
  const [biSets, setBiSets] = useState<BilateralSetState[]>(() => {
    if (baseLogged && baseLogged.sets.length > 0) {
      return baseLogged.sets.map((s) => ({
        setNumber: s.set_number,
        weight: Number(s.weight),
        reps: Number(s.reps),
        isCompleted: true,
      }));
    }

    const count = targetSets || 3;
    return Array.from({ length: count }, (_, i) => {
      const prevSet = bilateralPerf?.sets[i] || bilateralPerf?.sets[bilateralPerf.sets.length - 1];
      return {
        setNumber: i + 1,
        weight: prevSet ? prevSet.weight : 0,
        reps: prevSet ? prevSet.reps : 0,
        isCompleted: false,
      };
    });
  });

  const [notes, setNotes] = useState<string>(
    leftLogged?.exercise_notes || rightLogged?.exercise_notes || baseLogged?.exercise_notes || ''
  );
  const [showHistory, setShowHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Sync state when active date or logs update in database
  useEffect(() => {
    if (lastLoadedKeyRef.current === savedDataFingerprint) {
      return;
    }

    // If user has unsaved edits for this exercise and date, don't overwrite them
    if (isDirtyRef.current && lastLoadedKeyRef.current.startsWith(`${baseName}__${activeDate}__`)) {
      return;
    }

    lastLoadedKeyRef.current = savedDataFingerprint;
    isDirtyRef.current = false;

    const leftSets = leftLogged?.sets || [];
    const rightSets = rightLogged?.sets || [];
    const maxLen = Math.max(leftSets.length, rightSets.length);

    if (maxLen > 0) {
      setUniSets(
        Array.from({ length: maxLen }, (_, i) => ({
          setNumber: i + 1,
          leftWeight: Number(leftSets[i]?.weight) || 0,
          leftReps: Number(leftSets[i]?.reps) || 0,
          rightWeight: Number(rightSets[i]?.weight) || 0,
          rightReps: Number(rightSets[i]?.reps) || 0,
          isCompleted: true,
        }))
      );
      setNotes(leftLogged?.exercise_notes || rightLogged?.exercise_notes || '');
    } else if (baseLogged && baseLogged.sets.length > 0) {
      setUniSets(
        baseLogged.sets.map((s) => ({
          setNumber: s.set_number,
          leftWeight: Number(s.weight),
          leftReps: Number(s.reps),
          rightWeight: Number(s.weight),
          rightReps: Number(s.reps),
          isCompleted: true,
        }))
      );
      setBiSets(
        baseLogged.sets.map((s) => ({
          setNumber: s.set_number,
          weight: Number(s.weight),
          reps: Number(s.reps),
          isCompleted: true,
        }))
      );
      setNotes(baseLogged.exercise_notes || '');
    } else {
      const count = targetSets || 3;
      setUniSets(
        Array.from({ length: count }, (_, i) => {
          const prevL = leftPerf?.sets[i] || leftPerf?.sets[leftPerf.sets.length - 1];
          const prevR = rightPerf?.sets[i] || rightPerf?.sets[rightPerf.sets.length - 1];
          return {
            setNumber: i + 1,
            leftWeight: prevL ? prevL.weight : 0,
            leftReps: prevL ? prevL.reps : 0,
            rightWeight: prevR ? prevR.weight : (prevL ? prevL.weight : 0),
            rightReps: prevR ? prevR.reps : (prevL ? prevL.reps : 0),
            isCompleted: false,
          };
        })
      );
      setBiSets(
        Array.from({ length: count }, (_, i) => {
          const prevSet = bilateralPerf?.sets[i] || bilateralPerf?.sets[bilateralPerf.sets.length - 1];
          return {
            setNumber: i + 1,
            weight: prevSet ? prevSet.weight : 0,
            reps: prevSet ? prevSet.reps : 0,
            isCompleted: false,
          };
        })
      );
      setNotes('');
    }
  }, [
    savedDataFingerprint,
    baseName,
    activeDate,
    leftLogged,
    rightLogged,
    baseLogged,
    leftPerf,
    rightPerf,
    bilateralPerf,
    targetSets,
  ]);

  // Unilateral Handlers
  const handleUpdateUniSet = (
    idx: number,
    side: 'left' | 'right',
    field: 'Weight' | 'Reps',
    val: number
  ) => {
    isDirtyRef.current = true;
    const updated = [...uniSets];
    const key = `${side}${field}` as 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps';
    updated[idx] = {
      ...updated[idx],
      [key]: Math.max(0, val),
    };
    setUniSets(updated);
  };

  const handleAdjustUniSet = (
    idx: number,
    side: 'left' | 'right',
    field: 'Weight' | 'Reps',
    delta: number
  ) => {
    isDirtyRef.current = true;
    const updated = [...uniSets];
    const key = `${side}${field}` as 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps';
    const current = Number(updated[idx][key]) || 0;
    const nextVal = Math.max(0, Math.round((current + delta) * 10) / 10);
    updated[idx] = {
      ...updated[idx],
      [key]: nextVal,
    };
    setUniSets(updated);
  };

  const handleCopyLeftToRight = (idx: number) => {
    isDirtyRef.current = true;
    const updated = [...uniSets];
    updated[idx] = {
      ...updated[idx],
      rightWeight: updated[idx].leftWeight,
      rightReps: updated[idx].leftReps,
    };
    setUniSets(updated);
  };

  const handleToggleUniComplete = (idx: number) => {
    isDirtyRef.current = true;
    const updated = [...uniSets];
    updated[idx] = {
      ...updated[idx],
      isCompleted: !updated[idx].isCompleted,
    };
    setUniSets(updated);
  };

  const handleAddUniSet = () => {
    isDirtyRef.current = true;
    const last = uniSets[uniSets.length - 1];
    setUniSets([
      ...uniSets,
      {
        setNumber: uniSets.length + 1,
        leftWeight: last ? last.leftWeight : 0,
        leftReps: last ? last.leftReps : 0,
        rightWeight: last ? last.rightWeight : 0,
        rightReps: last ? last.rightReps : 0,
        isCompleted: false,
      },
    ]);
  };

  const handleRemoveUniSet = (idx: number) => {
    isDirtyRef.current = true;
    if (uniSets.length <= 1) return;
    const updated = uniSets.filter((_, i) => i !== idx).map((s, i) => ({ ...s, setNumber: i + 1 }));
    setUniSets(updated);
  };

  const handlePrefillUniLast = () => {
    isDirtyRef.current = true;
    const count = Math.max(leftPerf?.sets.length || 0, rightPerf?.sets.length || 0, targetSets || 3);
    const newSets: UnilateralSetState[] = Array.from({ length: count }, (_, i) => {
      const pL = leftPerf?.sets[i] || leftPerf?.sets[leftPerf.sets.length - 1];
      const pR = rightPerf?.sets[i] || rightPerf?.sets[rightPerf.sets.length - 1];
      return {
        setNumber: i + 1,
        leftWeight: pL ? pL.weight : 0,
        leftReps: pL ? pL.reps : 0,
        rightWeight: pR ? pR.weight : (pL ? pL.weight : 0),
        rightReps: pR ? pR.reps : (pL ? pL.reps : 0),
        isCompleted: false,
      };
    });
    setUniSets(newSets);
  };

  // Bilateral Handlers
  const handleUpdateBiSet = (idx: number, field: 'weight' | 'reps', val: number) => {
    isDirtyRef.current = true;
    const updated = [...biSets];
    updated[idx] = { ...updated[idx], [field]: Math.max(0, val) };
    setBiSets(updated);
  };

  const handleAdjustBiSet = (idx: number, field: 'weight' | 'reps', delta: number) => {
    isDirtyRef.current = true;
    const updated = [...biSets];
    const current = Number(updated[idx][field]) || 0;
    const nextVal = Math.max(0, Math.round((current + delta) * 10) / 10);
    updated[idx] = { ...updated[idx], [field]: nextVal };
    setBiSets(updated);
  };

  const handleToggleBiComplete = (idx: number) => {
    isDirtyRef.current = true;
    const updated = [...biSets];
    updated[idx] = { ...updated[idx], isCompleted: !updated[idx].isCompleted };
    setBiSets(updated);
  };

  const handleAddBiSet = () => {
    isDirtyRef.current = true;
    const last = biSets[biSets.length - 1];
    setBiSets([
      ...biSets,
      {
        setNumber: biSets.length + 1,
        weight: last ? last.weight : 0,
        reps: last ? last.reps : 0,
        isCompleted: false,
      },
    ]);
  };

  const handleRemoveBiSet = (idx: number) => {
    isDirtyRef.current = true;
    if (biSets.length <= 1) return;
    const updated = biSets.filter((_, i) => i !== idx).map((s, i) => ({ ...s, setNumber: i + 1 }));
    setBiSets(updated);
  };

  const handlePrefillBiLast = () => {
    if (!bilateralPerf || bilateralPerf.sets.length === 0) return;
    isDirtyRef.current = true;
    setBiSets(
      bilateralPerf.sets.map((ps, idx) => ({
        setNumber: idx + 1,
        weight: ps.weight,
        reps: ps.reps,
        isCompleted: false,
      }))
    );
  };

  // Save Sets
  const handleSaveSets = async () => {
    setIsSaving(true);
    try {
      const now = new Date();
      let loggedAt: string;
      if (isToday) {
        loggedAt = now.toISOString();
      } else {
        const [y, m, d] = activeDate.split('-').map(Number);
        const targetDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
        loggedAt = targetDate.toISOString();
      }

      if (isUnilateral) {
        const validSets = uniSets.filter(
          (s) => s.leftWeight > 0 || s.leftReps > 0 || s.rightWeight > 0 || s.rightReps > 0
        );
        if (validSets.length === 0) return;

        // 1. Log Left Arm/Leg Sets
        await logExerciseSets({
          exerciseName: leftExerciseName,
          targetMuscleGroup,
          routineId,
          routineName,
          exerciseNotes: notes || undefined,
          loggedAt,
          sets: validSets.map((s, i) => ({
            setNumber: i + 1,
            weight: Number(s.leftWeight) || 0,
            reps: Number(s.leftReps) || 0,
          })),
        });

        // 2. Log Right Arm/Leg Sets
        await logExerciseSets({
          exerciseName: rightExerciseName,
          targetMuscleGroup,
          routineId,
          routineName,
          exerciseNotes: notes || undefined,
          loggedAt,
          sets: validSets.map((s, i) => ({
            setNumber: i + 1,
            weight: Number(s.rightWeight) || 0,
            reps: Number(s.rightReps) || 0,
          })),
        });

        isDirtyRef.current = false;
        setUniSets((prev) => prev.map((s) => ({ ...s, isCompleted: true })));
      } else {
        const validSets = biSets.filter((s) => s.weight > 0 || s.reps > 0);
        if (validSets.length === 0) return;

        await logExerciseSets({
          exerciseName: baseName,
          targetMuscleGroup,
          routineId,
          routineName,
          exerciseNotes: notes || undefined,
          loggedAt,
          sets: validSets.map((s, i) => ({
            setNumber: i + 1,
            weight: Number(s.weight) || 0,
            reps: Number(s.reps) || 0,
          })),
        });

        isDirtyRef.current = false;
        setBiSets((prev) => prev.map((s) => ({ ...s, isCompleted: true })));
      }

      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      console.error('Failed to log exercise sets:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Compute Volume
  const uniLeftVolume = uniSets.reduce(
    (acc, s) => acc + calculateVolume(Number(s.leftWeight), Number(s.leftReps)),
    0
  );
  const uniRightVolume = uniSets.reduce(
    (acc, s) => acc + calculateVolume(Number(s.rightWeight), Number(s.rightReps)),
    0
  );
  const totalUniVolume = uniLeftVolume + uniRightVolume;

  const totalBiVolume = biSets.reduce(
    (acc, s) => acc + calculateVolume(Number(s.weight), Number(s.reps)),
    0
  );

  const displayVolume = isUnilateral ? totalUniVolume : totalBiVolume;
  const history = getExerciseHistory(baseName);

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

            {/* Toggle L & R Mode Button */}
            <button
              type="button"
              onClick={() => setIsUnilateral(!isUnilateral)}
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border flex items-center space-x-1 uppercase tracking-wider transition ${
                isUnilateral
                  ? 'bg-[#183446] text-[#8bb4cb] border-[#2e5d7d] hover:bg-[#20445c]'
                  : 'bg-[#2d4554] text-[#94a3b8] hover:text-white border-[#3f5d70]'
              }`}
              title={
                isUnilateral
                  ? 'Tracking Left and Right sides independently. Click to switch to Bilateral.'
                  : 'Click to enable separate Left and Right side tracking for this exercise.'
              }
            >
              <Sparkles className="w-2.5 h-2.5 text-[#8bb4cb]" />
              <span>{isUnilateral ? `⚡ L & R (${limbType}s)` : 'Bilateral'}</span>
            </button>
          </div>

          <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center space-x-2">
            <Dumbbell className="w-4 h-4 text-[#8bb4cb] shrink-0" />
            <span>{baseName}</span>
          </h3>
        </div>

        {/* PR Tag if achieved */}
        {(isUnilateral ? (prLeft || prRight) : prBilateral) && (
          <div className="bg-[#cc8d8d] border border-[#b87676] rounded-xl px-2.5 py-1 text-right shrink-0">
            <div className="flex items-center justify-end space-x-1 text-[10px] font-bold text-[#3b1212]">
              <Award className="w-3 h-3 text-[#3b1212]" />
              <span>PR</span>
            </div>
            {isUnilateral ? (
              <div className="font-mono text-[11px] font-extrabold text-[#3b1212] leading-tight">
                {prLeft && <div>L: {prLeft.max_weight}kg</div>}
                {prRight && <div>R: {prRight.max_weight}kg</div>}
              </div>
            ) : (
              <div className="font-mono text-xs font-extrabold text-[#3b1212]">
                {prBilateral?.max_weight}kg{' '}
                <span className="text-[10px]">({prBilateral?.best_estimated_1rm}kg 1RM)</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Previous Performance Recall Box */}
      <div className="bg-[#2d4554] border border-[#3f5d70] rounded-xl p-3 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-[#8bb4cb] font-bold">
            <History className="w-3.5 h-3.5" />
            <span>PREVIOUS SESSION</span>
          </div>

          {(isUnilateral ? leftPerf || rightPerf : bilateralPerf) && (
            <span className="text-[11px] text-[#94a3b8] font-mono font-medium">
              {formatRelativeDays((leftPerf || rightPerf || bilateralPerf)?.last_performed_at)}
            </span>
          )}
        </div>

        {isUnilateral ? (
          leftPerf || rightPerf ? (
            <div className="space-y-1.5">
              {leftPerf && leftPerf.sets.length > 0 && (
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#183446] text-[#8bb4cb] border border-[#2e5d7d] uppercase">
                    Left {limbType}:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {leftPerf.sets.map((ps, idx) => (
                      <span
                        key={idx}
                        className="bg-[#3d5a6c] text-[#f1f5f9] px-2 py-0.5 rounded-md font-mono border border-[#4e7085] text-[11px]"
                      >
                        S{ps.set_number}: <strong>{ps.weight}kg</strong> × {ps.reps}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {rightPerf && rightPerf.sets.length > 0 && (
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#1a3826] text-[#8fb89e] border border-[#2d5d3f] uppercase">
                    Right {limbType}:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {rightPerf.sets.map((ps, idx) => (
                      <span
                        key={idx}
                        className="bg-[#3d5a6c] text-[#f1f5f9] px-2 py-0.5 rounded-md font-mono border border-[#4e7085] text-[11px]"
                      >
                        S{ps.set_number}: <strong>{ps.weight}kg</strong> × {ps.reps}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(leftPerf?.notes || rightPerf?.notes) && (
                <div className="flex items-start space-x-1.5 text-[#332919] bg-[#c9bda9] px-2.5 py-1 rounded-md border border-[#b3a58e] text-[11px]">
                  <MessageSquareQuote className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#332919]" />
                  <span className="italic">
                    "{leftPerf?.notes || rightPerf?.notes}"
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[#94a3b8] text-[11px] italic">
              First time tracking this unilateral exercise! Log your Left and Right baseline sets below.
            </p>
          )
        ) : bilateralPerf ? (
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1.5">
              {bilateralPerf.sets.map((ps, idx) => (
                <span
                  key={idx}
                  className="bg-[#3d5a6c] text-[#f1f5f9] px-2 py-0.5 rounded-md font-mono border border-[#4e7085] text-[11px]"
                >
                  Set {ps.set_number}: <strong>{ps.weight}kg</strong> × {ps.reps}
                </span>
              ))}
            </div>
            {bilateralPerf.notes && (
              <div className="flex items-start space-x-1.5 text-[#332919] bg-[#c9bda9] px-2.5 py-1 rounded-md border border-[#b3a58e] text-[11px]">
                <MessageSquareQuote className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#332919]" />
                <span className="italic">"{bilateralPerf.notes}"</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[#94a3b8] text-[11px] italic">
            First time tracking this exercise! Log your baseline sets below.
          </p>
        )}
      </div>

      {/* Target Date Status Pill if already logged */}
      {hasExistingLog && (
        <div className="bg-[#274a38] border border-[#3c6e54] text-[#8fb89e] px-3 py-1.5 rounded-xl text-xs flex items-center justify-between font-medium">
          <div className="flex items-center space-x-1.5">
            <Check className="w-3.5 h-3.5 text-[#8fb89e]" />
            <span className="font-bold text-white">Logged for {dateLabel}:</span>
            <span>
              {isUnilateral
                ? `${Math.max(leftLogged?.sets.length || 0, rightLogged?.sets.length || 0)} L & R sets saved`
                : `${baseLogged?.sets.length || 0} sets saved`}
            </span>
          </div>
          <span className="font-mono text-[11px] text-white/90">
            {Math.round(displayVolume)} kg volume
          </span>
        </div>
      )}

      {/* Main Sets Logging Section */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] px-1 gap-2">
          <div className="flex items-center space-x-2">
            <span>Log Sets ({dateLabel})</span>
            {!isToday && (
              <span className="text-[9px] bg-[#2d4554] text-[#8bb4cb] border border-[#3f5d70] px-1.5 py-0.5 rounded font-mono font-normal">
                Retroactive
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Unilateral View Mode Selector Pills */}
            {isUnilateral && (
              <div className="flex items-center space-x-1 bg-[#253946] border border-[#3f5d70] p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setUnilateralViewMode('combined')}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold transition ${
                    unilateralViewMode === 'combined'
                      ? 'bg-[#8bb4cb] text-[#0e2938]'
                      : 'text-[#cbd5e1] hover:text-white'
                  }`}
                  title="View Left and Right sides together per set"
                >
                  L & R Sets
                </button>
                <button
                  type="button"
                  onClick={() => setUnilateralViewMode('columns')}
                  className={`hidden sm:inline-block px-2 py-0.5 rounded text-[9px] font-bold transition ${
                    unilateralViewMode === 'columns'
                      ? 'bg-[#8bb4cb] text-[#0e2938]'
                      : 'text-[#cbd5e1] hover:text-white'
                  }`}
                  title="Side-by-side columns"
                >
                  Columns
                </button>
                <button
                  type="button"
                  onClick={() => setUnilateralViewMode('left')}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold transition ${
                    unilateralViewMode === 'left'
                      ? 'bg-[#8bb4cb] text-[#0e2938]'
                      : 'text-[#cbd5e1] hover:text-white'
                  }`}
                  title="Focus on Left side"
                >
                  L
                </button>
                <button
                  type="button"
                  onClick={() => setUnilateralViewMode('right')}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold transition ${
                    unilateralViewMode === 'right'
                      ? 'bg-[#8fb89e] text-[#0e2a18]'
                      : 'text-[#cbd5e1] hover:text-white'
                  }`}
                  title="Focus on Right side"
                >
                  R
                </button>
              </div>
            )}

            {/* Prefill from Last Session */}
            {(isUnilateral ? leftPerf || rightPerf : bilateralPerf) && (
              <button
                type="button"
                onClick={isUnilateral ? handlePrefillUniLast : handlePrefillBiLast}
                className="text-[#8bb4cb] hover:underline flex items-center space-x-1 capitalize font-bold"
              >
                <Sparkles className="w-3 h-3" />
                <span>Match last</span>
              </button>
            )}
          </div>
        </div>

        {/* Sets Input List */}
        {isUnilateral ? (
          unilateralViewMode === 'columns' ? (
            /* 2-Column Side-by-Side Mode */
            <div className="grid grid-cols-2 gap-3">
              {/* Left Side Column */}
              <div className="space-y-1.5 bg-[#253946]/50 p-2.5 rounded-xl border border-[#3a586c]">
                <div className="flex items-center justify-between text-[10px] font-extrabold text-[#8bb4cb] uppercase tracking-wider px-1">
                  <span>Left {limbType}</span>
                  <span className="font-mono">{Math.round(uniLeftVolume)}kg</span>
                </div>
                {uniSets.map((s, idx) => (
                  <div
                    key={idx}
                    className={`p-1.5 rounded-lg border transition ${
                      s.isCompleted ? 'bg-[#274a38]/70 border-[#3c6e54]' : 'bg-[#2d4554] border-[#3f5d70]'
                    } flex items-center gap-1`}
                  >
                    <span className="w-5 h-5 rounded bg-[#3d5a6c] text-[#f1f5f9] flex items-center justify-center text-[10px] font-bold font-mono shrink-0">
                      S{s.setNumber}
                    </span>
                    <input
                      type="number"
                      step="0.5"
                      placeholder="0"
                      value={s.leftWeight === 0 ? '' : s.leftWeight}
                      onChange={(e) =>
                        handleUpdateUniSet(idx, 'left', 'Weight', parseFloat(e.target.value) || 0)
                      }
                      className="w-12 bg-[#3d5a6c] border border-[#4e7085] rounded text-center text-white font-mono font-bold text-xs p-1 focus:outline-none"
                    />
                    <span className="text-[9px] text-[#94a3b8]">kg</span>
                    <span className="text-white/60">×</span>
                    <input
                      type="number"
                      step="1"
                      placeholder="0"
                      value={s.leftReps === 0 ? '' : s.leftReps}
                      onChange={(e) =>
                        handleUpdateUniSet(idx, 'left', 'Reps', parseInt(e.target.value, 10) || 0)
                      }
                      className="w-10 bg-[#3d5a6c] border border-[#4e7085] rounded text-center text-white font-mono font-bold text-xs p-1 focus:outline-none"
                    />
                    <span className="text-[9px] text-[#94a3b8]">reps</span>
                  </div>
                ))}
              </div>

              {/* Right Side Column */}
              <div className="space-y-1.5 bg-[#253946]/50 p-2.5 rounded-xl border border-[#3a586c]">
                <div className="flex items-center justify-between text-[10px] font-extrabold text-[#8fb89e] uppercase tracking-wider px-1">
                  <span>Right {limbType}</span>
                  <span className="font-mono">{Math.round(uniRightVolume)}kg</span>
                </div>
                {uniSets.map((s, idx) => (
                  <div
                    key={idx}
                    className={`p-1.5 rounded-lg border transition ${
                      s.isCompleted ? 'bg-[#274a38]/70 border-[#3c6e54]' : 'bg-[#2d4554] border-[#3f5d70]'
                    } flex items-center gap-1`}
                  >
                    <span className="w-5 h-5 rounded bg-[#3d5a6c] text-[#f1f5f9] flex items-center justify-center text-[10px] font-bold font-mono shrink-0">
                      S{s.setNumber}
                    </span>
                    <input
                      type="number"
                      step="0.5"
                      placeholder="0"
                      value={s.rightWeight === 0 ? '' : s.rightWeight}
                      onChange={(e) =>
                        handleUpdateUniSet(idx, 'right', 'Weight', parseFloat(e.target.value) || 0)
                      }
                      className="w-12 bg-[#3d5a6c] border border-[#4e7085] rounded text-center text-white font-mono font-bold text-xs p-1 focus:outline-none"
                    />
                    <span className="text-[9px] text-[#94a3b8]">kg</span>
                    <span className="text-white/60">×</span>
                    <input
                      type="number"
                      step="1"
                      placeholder="0"
                      value={s.rightReps === 0 ? '' : s.rightReps}
                      onChange={(e) =>
                        handleUpdateUniSet(idx, 'right', 'Reps', parseInt(e.target.value, 10) || 0)
                      }
                      className="w-10 bg-[#3d5a6c] border border-[#4e7085] rounded text-center text-white font-mono font-bold text-xs p-1 focus:outline-none"
                    />
                    <span className="text-[9px] text-[#94a3b8]">reps</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Combined / Crammed Dual-Line Mode (Default) */
            <div className="space-y-2">
              {uniSets.map((s, idx) => (
                <div
                  key={idx}
                  className={`p-2 sm:p-2.5 rounded-xl border transition-colors space-y-1.5 ${
                    s.isCompleted
                      ? 'bg-[#274a38]/80 border-[#3c6e54]'
                      : 'bg-[#2d4554] border-[#3f5d70]'
                  }`}
                >
                  {/* Set Header with S# Label, Quick Copy L->R and Completion Checkbox */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-md bg-[#3d5a6c] text-[#f1f5f9] border border-[#4e7085] flex items-center justify-center text-[11px] font-bold font-mono">
                        S{s.setNumber}
                      </span>
                      <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                        Set {s.setNumber}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {unilateralViewMode === 'combined' && (
                        <button
                          type="button"
                          onClick={() => handleCopyLeftToRight(idx)}
                          className="text-[10px] bg-[#3d5a6c] hover:bg-[#324a59] text-[#cbd5e1] hover:text-white px-2 py-0.5 rounded-md border border-[#4e7085] flex items-center space-x-1 font-bold transition"
                          title="Copy Left arm numbers to Right arm"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>Copy L → R</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleToggleUniComplete(idx)}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center border transition ${
                          s.isCompleted
                            ? 'bg-[#8fb89e] text-[#0e2a18] border-[#78a387]'
                            : 'bg-[#3d5a6c] text-[#94a3b8] hover:text-white border-[#3f5d70]'
                        }`}
                        title={s.isCompleted ? 'Mark uncompleted' : 'Mark completed'}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Left Side Row */}
                  {(unilateralViewMode === 'combined' || unilateralViewMode === 'left') && (
                    <div className="grid grid-cols-12 gap-1 sm:gap-2 items-center bg-[#253946]/70 p-1 sm:p-1.5 rounded-lg border border-[#3a586c]">
                      <div className="col-span-3 sm:col-span-2 flex items-center">
                        <span className="text-[10px] sm:text-[11px] font-extrabold bg-[#183446] text-[#8bb4cb] border border-[#2e5d7d] px-1.5 py-0.5 rounded uppercase tracking-wider">
                          L ({limbType})
                        </span>
                      </div>

                      {/* Weight Steppers */}
                      <div className="col-span-5 sm:col-span-5 flex items-center space-x-0.5 sm:space-x-1 bg-[#3d5a6c] rounded-lg p-0.5 border border-[#3f5d70]">
                        <button
                          type="button"
                          onClick={() => handleAdjustUniSet(idx, 'left', 'Weight', -2.5)}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center shrink-0 border border-[#3f5d70]"
                        >
                          -
                        </button>
                        <div className="flex-1 text-center min-w-0">
                          <input
                            type="number"
                            step="0.5"
                            value={s.leftWeight === 0 ? '' : s.leftWeight}
                            placeholder="0"
                            onChange={(e) =>
                              handleUpdateUniSet(
                                idx,
                                'left',
                                'Weight',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full bg-transparent text-center text-white font-mono font-bold text-xs sm:text-sm focus:outline-none"
                          />
                          <span className="text-[9px] text-[#94a3b8] block -mt-1 font-sans">kg</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAdjustUniSet(idx, 'left', 'Weight', 2.5)}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center shrink-0 border border-[#3f5d70]"
                        >
                          +
                        </button>
                      </div>

                      {/* Reps Steppers */}
                      <div className="col-span-4 sm:col-span-5 flex items-center space-x-0.5 sm:space-x-1 bg-[#3d5a6c] rounded-lg p-0.5 border border-[#3f5d70]">
                        <button
                          type="button"
                          onClick={() => handleAdjustUniSet(idx, 'left', 'Reps', -1)}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center shrink-0 border border-[#3f5d70]"
                        >
                          -
                        </button>
                        <div className="flex-1 text-center min-w-0">
                          <input
                            type="number"
                            step="1"
                            value={s.leftReps === 0 ? '' : s.leftReps}
                            placeholder="0"
                            onChange={(e) =>
                              handleUpdateUniSet(
                                idx,
                                'left',
                                'Reps',
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="w-full bg-transparent text-center text-white font-mono font-bold text-xs sm:text-sm focus:outline-none"
                          />
                          <span className="text-[9px] text-[#94a3b8] block -mt-1 font-sans">reps</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAdjustUniSet(idx, 'left', 'Reps', 1)}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center shrink-0 border border-[#3f5d70]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Right Side Row */}
                  {(unilateralViewMode === 'combined' || unilateralViewMode === 'right') && (
                    <div className="grid grid-cols-12 gap-1 sm:gap-2 items-center bg-[#253946]/70 p-1 sm:p-1.5 rounded-lg border border-[#3a586c]">
                      <div className="col-span-3 sm:col-span-2 flex items-center">
                        <span className="text-[10px] sm:text-[11px] font-extrabold bg-[#1a3826] text-[#8fb89e] border border-[#2d5d3f] px-1.5 py-0.5 rounded uppercase tracking-wider">
                          R ({limbType})
                        </span>
                      </div>

                      {/* Weight Steppers */}
                      <div className="col-span-5 sm:col-span-5 flex items-center space-x-0.5 sm:space-x-1 bg-[#3d5a6c] rounded-lg p-0.5 border border-[#3f5d70]">
                        <button
                          type="button"
                          onClick={() => handleAdjustUniSet(idx, 'right', 'Weight', -2.5)}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center shrink-0 border border-[#3f5d70]"
                        >
                          -
                        </button>
                        <div className="flex-1 text-center min-w-0">
                          <input
                            type="number"
                            step="0.5"
                            value={s.rightWeight === 0 ? '' : s.rightWeight}
                            placeholder="0"
                            onChange={(e) =>
                              handleUpdateUniSet(
                                idx,
                                'right',
                                'Weight',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full bg-transparent text-center text-white font-mono font-bold text-xs sm:text-sm focus:outline-none"
                          />
                          <span className="text-[9px] text-[#94a3b8] block -mt-1 font-sans">kg</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAdjustUniSet(idx, 'right', 'Weight', 2.5)}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center shrink-0 border border-[#3f5d70]"
                        >
                          +
                        </button>
                      </div>

                      {/* Reps Steppers */}
                      <div className="col-span-4 sm:col-span-5 flex items-center space-x-0.5 sm:space-x-1 bg-[#3d5a6c] rounded-lg p-0.5 border border-[#3f5d70]">
                        <button
                          type="button"
                          onClick={() => handleAdjustUniSet(idx, 'right', 'Reps', -1)}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center shrink-0 border border-[#3f5d70]"
                        >
                          -
                        </button>
                        <div className="flex-1 text-center min-w-0">
                          <input
                            type="number"
                            step="1"
                            value={s.rightReps === 0 ? '' : s.rightReps}
                            placeholder="0"
                            onChange={(e) =>
                              handleUpdateUniSet(
                                idx,
                                'right',
                                'Reps',
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="w-full bg-transparent text-center text-white font-mono font-bold text-xs sm:text-sm focus:outline-none"
                          />
                          <span className="text-[9px] text-[#94a3b8] block -mt-1 font-sans">reps</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAdjustUniSet(idx, 'right', 'Reps', 1)}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center shrink-0 border border-[#3f5d70]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          /* Bilateral Mode (Standard Single-Line) */
          <div className="space-y-1.5">
            {biSets.map((s, idx) => (
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

                {/* Weight Steppers */}
                <div className="col-span-5 flex items-center space-x-1 bg-[#3d5a6c] rounded-lg p-0.5 sm:p-1 border border-[#3f5d70]">
                  <button
                    type="button"
                    onClick={() => handleAdjustBiSet(idx, 'weight', -2.5)}
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
                        handleUpdateBiSet(idx, 'weight', parseFloat(e.target.value) || 0)
                      }
                      className="w-full bg-transparent text-center text-white font-mono font-bold text-xs sm:text-sm focus:outline-none"
                    />
                    <span className="text-[9px] text-[#94a3b8] block -mt-1 font-sans">kg</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdjustBiSet(idx, 'weight', 2.5)}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center border border-[#3f5d70] shrink-0"
                  >
                    +
                  </button>
                </div>

                {/* Reps Steppers */}
                <div className="col-span-4 flex items-center space-x-1 bg-[#3d5a6c] rounded-lg p-0.5 sm:p-1 border border-[#3f5d70]">
                  <button
                    type="button"
                    onClick={() => handleAdjustBiSet(idx, 'reps', -1)}
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
                        handleUpdateBiSet(idx, 'reps', parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full bg-transparent text-center text-white font-mono font-bold text-xs sm:text-sm focus:outline-none"
                    />
                    <span className="text-[9px] text-[#94a3b8] block -mt-1 font-sans">reps</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdjustBiSet(idx, 'reps', 1)}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-[#2d4554] hover:bg-[#223541] text-white font-bold text-xs flex items-center justify-center border border-[#3f5d70] shrink-0"
                  >
                    +
                  </button>
                </div>

                {/* Completion Checkmark */}
                <div className="col-span-1 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => handleToggleBiComplete(idx)}
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
        )}

        {/* Set controls: Add / Remove */}
        <div className="flex items-center justify-between text-xs pt-1 px-1">
          <button
            type="button"
            onClick={isUnilateral ? handleAddUniSet : handleAddBiSet}
            className="text-[#8bb4cb] hover:underline flex items-center space-x-1 font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Set</span>
          </button>

          {(isUnilateral ? uniSets.length : biSets.length) > 1 && (
            <button
              type="button"
              onClick={() => (isUnilateral ? handleRemoveUniSet(uniSets.length - 1) : handleRemoveBiSet(biSets.length - 1))}
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
          placeholder="Notes on form, resistance, cues (e.g. paused at peak, +2.5kg next session)..."
          value={notes}
          onChange={(e) => {
            isDirtyRef.current = true;
            setNotes(e.target.value);
          }}
          className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl px-3 py-2 text-xs text-[#f1f5f9] placeholder-[#94a3b8] focus:outline-none focus:border-[#8bb4cb]"
        />
      </div>

      {/* Action Footer: History Toggle & Log Button */}
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
                  : hasExistingLog
                  ? `Update ${dateLabel}'s Sets (${Math.round(displayVolume)}kg)`
                  : isUnilateral
                  ? `Log ${dateLabel} (L: ${Math.round(uniLeftVolume)}kg + R: ${Math.round(uniRightVolume)}kg)`
                  : `Log Sets for ${dateLabel} (${Math.round(displayVolume)}kg)`}
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
            <span>Past Performances for {baseName}</span>
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
                    {h.sets.map((st: any, sIdx: number) => (
                      <span
                        key={sIdx}
                        className="bg-[#3d5a6c] px-2 py-0.5 rounded text-[11px] font-mono text-[#f1f5f9] flex items-center space-x-1"
                      >
                        {st.label && (
                          <span
                            className={`text-[9px] font-extrabold px-1 rounded ${
                              st.label === 'LEFT' || st.label === 'L'
                                ? 'bg-[#183446] text-[#8bb4cb]'
                                : 'bg-[#1a3826] text-[#8fb89e]'
                            }`}
                          >
                            {st.label}
                          </span>
                        )}
                        <span>
                          S{st.setNumber}: <strong>{st.weight}kg</strong> × {st.reps}
                        </span>
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
