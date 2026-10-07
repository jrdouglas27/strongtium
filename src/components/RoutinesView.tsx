import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Dumbbell,
  Sparkles,
  Layers,
  Table,
  FileText,
  Check,
  Edit2,
  Calendar,
  Save,
  HelpCircle,
  FolderSync,
} from 'lucide-react';
import { useWorkout } from '../context/WorkoutContext';
import { RoutineEditorModal } from './RoutineEditorModal';
import { MUSCLE_GROUPS } from '../types/workout';
export const RoutinesView: React.FC = () => {
  const {
    routines,
    updateRoutine,
    deleteRoutine,
    addOrUpdateExerciseToRoutine,
    removeExerciseFromRoutine,
    bulkSaveRoutines,
    loadStarterRoutines,
  } = useWorkout();

  const [activeViewMode, setActiveViewMode] = useState<'splits' | 'matrix' | 'text'>('splits');
  const [showEditor, setShowEditor] = useState(false);

  // Quick Add Exercise State
  const [quickExName, setQuickExName] = useState('');
  const [quickExMuscle, setQuickExMuscle] = useState('Chest');
  const [quickExRoutineId, setQuickExRoutineId] = useState(routines[0]?.id || '');
  const [quickExSets, setQuickExSets] = useState(3);
  const [quickAddedFeedback, setQuickAddedFeedback] = useState(false);

  // Bulk Text Importer State
  const starterTextTemplate = `# Push (Chest, Shoulders & Triceps)
Barbell Bench Press (Chest, 3 sets)
Overhead Shoulder Press (Shoulders, 3 sets)
Incline Dumbbell Press (Chest, 3 sets)
Triceps Cable Pushdown (Triceps, 3 sets)

# Pull (Back & Biceps)
Barbell Bent-Over Row (Back, 3 sets)
Lat Pulldown / Pull-Ups (Back, 3 sets)
Dumbbell Bicep Curls (Biceps, 3 sets)
Face Pulls (Rear Delts, 3 sets)

# Legs & Core
Barbell Squat (Quads / Glutes, 3 sets)
Romanian Deadlift (Hamstrings, 3 sets)
Leg Press / Bulgarian Split Squat (Quads, 3 sets)
Standing Calf Raise (Calves, 3 sets)`;

  const [bulkText, setBulkText] = useState(starterTextTemplate);
  const [bulkStatusMessage, setBulkStatusMessage] = useState<string | null>(null);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // Edit Single Routine Inline State
  const [inlineEditingRoutine, setInlineEditingRoutine] = useState<{
    id: string;
    name: string;
    description: string;
    targetRestDays: number;
    exercises: { name: string; muscle: string; targetSets: number }[];
  } | null>(null);

  const muscleGroups = MUSCLE_GROUPS;

  // Handle Quick Add Exercise
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickExName.trim() || !quickExRoutineId) return;

    await addOrUpdateExerciseToRoutine(
      quickExRoutineId,
      quickExName.trim(),
      quickExMuscle,
      quickExSets
    );

    setQuickExName('');
    setQuickAddedFeedback(true);
    setTimeout(() => setQuickAddedFeedback(false), 2000);
  };

  // Start Inline Routine Edit
  const handleStartInlineEdit = (routineId: string) => {
    const target = routines.find((r) => r.id === routineId);
    if (!target) return;

    setInlineEditingRoutine({
      id: target.id,
      name: target.name,
      description: target.description || '',
      targetRestDays: target.target_rest_days || 3,
      exercises: (target.exercises || []).map((re) => ({
        name: re.exercise?.name || 'Exercise',
        muscle: re.exercise?.target_muscle_group || 'General',
        targetSets: re.target_sets || 3,
      })),
    });
  };

  // Save Inline Routine Edit
  const handleSaveInlineEdit = async () => {
    if (!inlineEditingRoutine) return;
    await updateRoutine(
      inlineEditingRoutine.id,
      inlineEditingRoutine.name,
      inlineEditingRoutine.description,
      inlineEditingRoutine.targetRestDays,
      inlineEditingRoutine.exercises
    );
    setInlineEditingRoutine(null);
  };

  // Add exercise to inline edit
  const handleAddInlineExercise = () => {
    if (!inlineEditingRoutine) return;
    setInlineEditingRoutine({
      ...inlineEditingRoutine,
      exercises: [
        ...inlineEditingRoutine.exercises,
        { name: '', muscle: 'General', targetSets: 3 },
      ],
    });
  };

  // Parse and import bulk text format
  const handleParseAndImportBulkText = async () => {
    setIsBulkSaving(true);
    setBulkStatusMessage(null);

    try {
      const lines = bulkText.split('\n');
      const parsedRoutines: {
        name: string;
        description: string;
        targetRestDays: number;
        exercises: { name: string; muscle: string; targetSets: number }[];
      }[] = [];

      let currentRoutineName = '';
      let currentRoutineExercises: { name: string; muscle: string; targetSets: number }[] = [];

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        if (line.startsWith('#')) {
          // Save previous routine if exists
          if (currentRoutineName && currentRoutineExercises.length > 0) {
            parsedRoutines.push({
              name: currentRoutineName,
              description: 'Custom split',
              targetRestDays: 3,
              exercises: currentRoutineExercises,
            });
          }

          // New Routine header
          currentRoutineName = line.replace(/^#+\s*/, '').trim();
          currentRoutineExercises = [];
        } else {
          // Exercise item line, e.g. "Barbell Bench Press (Chest, 3 sets)" or "Barbell Bench Press"
          let exName = line;
          let muscle = 'General';
          let sets = 3;

          const parenMatch = line.match(/^(.*?)\((.*?)\)$/);
          if (parenMatch) {
            exName = parenMatch[1].trim();
            const details = parenMatch[2].split(',');
            if (details[0]) muscle = details[0].trim();
            if (details[1]) {
              const numMatch = details[1].match(/\d+/);
              if (numMatch) sets = parseInt(numMatch[0], 10);
            }
          }

          if (exName) {
            currentRoutineExercises.push({
              name: exName,
              muscle: muscle || 'General',
              targetSets: sets || 3,
            });
          }
        }
      }

      // Append last routine
      if (currentRoutineName && currentRoutineExercises.length > 0) {
        parsedRoutines.push({
          name: currentRoutineName,
          description: 'Custom split',
          targetRestDays: 3,
          exercises: currentRoutineExercises,
        });
      }

      if (parsedRoutines.length === 0) {
        setBulkStatusMessage('Error: No valid routines or exercises detected. Check format.');
        return;
      }

      await bulkSaveRoutines(parsedRoutines);
      setBulkStatusMessage(`Successfully saved ${parsedRoutines.length} routines!`);
      setTimeout(() => setBulkStatusMessage(null), 3000);
      setActiveViewMode('splits');
    } catch (err: any) {
      setBulkStatusMessage(`Error: ${err.message || 'Failed to parse text'}`);
    } finally {
      setIsBulkSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2">
            <Layers className="w-5 h-5 text-[#8bb4cb]" />
            <span>Exercise & Routine Configuration</span>
          </h2>
          <p className="text-xs text-[#cbd5e1] font-medium mt-0.5">
            Define, write out, organize, and map exercises to your routine splits (Push, Pull, Legs, Custom).
          </p>
        </div>

        {/* View Switcher Chips */}
        <div className="flex items-center space-x-1.5 bg-[#2d4554] border border-[#3f5d70] p-1 rounded-xl shrink-0">
          <button
            onClick={() => setActiveViewMode('splits')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeViewMode === 'splits'
                ? 'bg-[#8bb4cb] text-[#0e2938] shadow-sm'
                : 'text-[#cbd5e1] hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Splits</span>
          </button>

          <button
            onClick={() => setActiveViewMode('matrix')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeViewMode === 'matrix'
                ? 'bg-[#8bb4cb] text-[#0e2938] shadow-sm'
                : 'text-[#cbd5e1] hover:text-white'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Exercise Matrix</span>
          </button>

          <button
            onClick={() => setActiveViewMode('text')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeViewMode === 'text'
                ? 'bg-[#8bb4cb] text-[#0e2938] shadow-sm'
                : 'text-[#cbd5e1] hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Text / Paste</span>
          </button>
        </div>
      </div>

      {/* Quick Add Exercise Bar */}
      <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8bb4cb] flex items-center space-x-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>Quick Add / Map Exercise to Routine</span>
          </h3>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowEditor(true)}
              className="text-xs text-white font-bold bg-[#2d4554] hover:bg-[#223541] border border-[#3f5d70] px-3 py-1.5 rounded-lg transition"
            >
              + New Routine Split
            </button>
          </div>
        </div>

        <form onSubmit={handleQuickAdd} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          <div className="sm:col-span-5">
            <input
              type="text"
              required
              placeholder="Exercise name (e.g. Incline Bench Press, Romanian Deadlift)..."
              value={quickExName}
              onChange={(e) => setQuickExName(e.target.value)}
              className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl px-3 py-2 text-xs text-white placeholder-[#94a3b8] focus:outline-none focus:border-[#8bb4cb]"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={quickExMuscle}
              onChange={(e) => setQuickExMuscle(e.target.value)}
              className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8bb4cb]"
            >
              {muscleGroups.map((m) => (
                <option key={m} value={m}>
                  {m} Group
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              value={quickExRoutineId}
              onChange={(e) => setQuickExRoutineId(e.target.value)}
              className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8bb4cb]"
            >
              {routines.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 flex space-x-1.5">
            <input
              type="number"
              min={1}
              max={15}
              value={quickExSets}
              onChange={(e) => setQuickExSets(Math.max(1, parseInt(e.target.value) || 3))}
              className="w-14 bg-[#2d4554] border border-[#3f5d70] rounded-xl px-2 py-2 text-xs text-center text-white font-mono font-bold"
              title="Target Sets"
            />

            <button
              type="submit"
              disabled={!quickExName.trim()}
              className={`flex-1 flex items-center justify-center space-x-1 py-2 px-3 rounded-xl text-xs font-extrabold transition shadow-sm ${
                quickAddedFeedback
                  ? 'bg-[#8fb89e] text-[#0e2a18] border border-[#78a387]'
                  : 'bg-[#8bb4cb] hover:bg-[#749fb7] text-[#0e2938] border border-[#749fb7]'
              }`}
            >
              {quickAddedFeedback ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{quickAddedFeedback ? 'Added!' : 'Add'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* VIEW 1: SPLITS VIEW */}
      {activeViewMode === 'splits' && (
        <div className="space-y-4">
          {routines.length === 0 ? (
            <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-10 text-center space-y-3">
              <Dumbbell className="w-10 h-10 text-[#94a3b8] mx-auto" />
              <h3 className="font-bold text-base text-white">No Routines Configured Yet</h3>
              <p className="text-xs text-[#cbd5e1] max-w-sm mx-auto font-medium">
                Create a split or load the starter Push / Pull / Legs routine presets.
              </p>
              <button
                onClick={() => loadStarterRoutines()}
                className="inline-flex items-center space-x-1.5 bg-[#8bb4cb] text-[#0e2938] border border-[#749fb7] text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm hover:bg-[#749fb7]"
              >
                <Sparkles className="w-4 h-4" />
                <span>Load Push / Pull / Legs</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {routines.map((routine) => {
                const isEditing = inlineEditingRoutine?.id === routine.id;

                if (isEditing && inlineEditingRoutine) {
                  return (
                    <div
                      key={routine.id}
                      className="bg-[#3d5a6c] border-2 border-[#8bb4cb] rounded-2xl p-5 shadow-md space-y-4"
                    >
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-white uppercase tracking-wider">
                          Edit Routine Split Name
                        </label>
                        <input
                          type="text"
                          value={inlineEditingRoutine.name}
                          onChange={(e) =>
                            setInlineEditingRoutine({
                              ...inlineEditingRoutine,
                              name: e.target.value,
                            })
                          }
                          className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl px-3 py-2 text-sm font-bold text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-[#cbd5e1] mb-1">
                            Cadence (Rest Days)
                          </label>
                          <select
                            value={inlineEditingRoutine.targetRestDays}
                            onChange={(e) =>
                              setInlineEditingRoutine({
                                ...inlineEditingRoutine,
                                targetRestDays: parseInt(e.target.value, 10),
                              })
                            }
                            className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl px-3 py-1.5 text-xs text-white"
                          >
                            <option value={1}>Every 1 Day</option>
                            <option value={2}>Every 2 Days</option>
                            <option value={3}>Every 3 Days</option>
                            <option value={4}>Every 4 Days</option>
                            <option value={5}>Every 5 Days</option>
                            <option value={7}>Every 7 Days</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-[#cbd5e1] mb-1">
                            Description
                          </label>
                          <input
                            type="text"
                            value={inlineEditingRoutine.description}
                            onChange={(e) =>
                              setInlineEditingRoutine({
                                ...inlineEditingRoutine,
                                description: e.target.value,
                              })
                            }
                            placeholder="Split focus..."
                            className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl px-3 py-1.5 text-xs text-white"
                          />
                        </div>
                      </div>

                      {/* Exercises in Routine */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-white uppercase tracking-wider">
                            Exercises ({inlineEditingRoutine.exercises.length})
                          </label>
                          <button
                            type="button"
                            onClick={handleAddInlineExercise}
                            className="text-xs text-[#8bb4cb] font-bold hover:underline flex items-center space-x-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Row</span>
                          </button>
                        </div>

                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                          {inlineEditingRoutine.exercises.map((ex, exIdx) => (
                            <div
                              key={exIdx}
                              className="bg-[#2d4554] border border-[#3f5d70] p-2 rounded-xl flex items-center gap-1.5"
                            >
                              <input
                                type="text"
                                placeholder="Exercise name"
                                value={ex.name}
                                onChange={(e) => {
                                  const updated = [...inlineEditingRoutine.exercises];
                                  updated[exIdx].name = e.target.value;
                                  setInlineEditingRoutine({
                                    ...inlineEditingRoutine,
                                    exercises: updated,
                                  });
                                }}
                                className="flex-1 bg-[#3d5a6c] border border-[#4e7085] rounded-lg px-2.5 py-1 text-xs text-white"
                              />

                              <select
                                value={ex.muscle}
                                onChange={(e) => {
                                  const updated = [...inlineEditingRoutine.exercises];
                                  updated[exIdx].muscle = e.target.value;
                                  setInlineEditingRoutine({
                                    ...inlineEditingRoutine,
                                    exercises: updated,
                                  });
                                }}
                                className="w-24 bg-[#3d5a6c] border border-[#4e7085] rounded-lg px-2 py-1 text-xs text-white"
                              >
                                {muscleGroups.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>

                              <input
                                type="number"
                                min={1}
                                max={15}
                                value={ex.targetSets}
                                onChange={(e) => {
                                  const updated = [...inlineEditingRoutine.exercises];
                                  updated[exIdx].targetSets = parseInt(e.target.value, 10) || 3;
                                  setInlineEditingRoutine({
                                    ...inlineEditingRoutine,
                                    exercises: updated,
                                  });
                                }}
                                className="w-12 bg-[#3d5a6c] border border-[#4e7085] rounded-lg px-1.5 py-1 text-xs text-center text-white font-mono"
                                title="Target sets"
                              />

                              <button
                                type="button"
                                onClick={() => {
                                  const updated = inlineEditingRoutine.exercises.filter(
                                    (_, i) => i !== exIdx
                                  );
                                  setInlineEditingRoutine({
                                    ...inlineEditingRoutine,
                                    exercises: updated,
                                  });
                                }}
                                className="p-1 text-[#94a3b8] hover:text-[#cc8d8d]"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 pt-2 border-t border-[#4e7085]">
                        <button
                          type="button"
                          onClick={() => setInlineEditingRoutine(null)}
                          className="flex-1 bg-[#2d4554] hover:bg-[#223541] text-white border border-[#3f5d70] font-bold py-2 rounded-xl text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveInlineEdit}
                          className="flex-1 flex items-center justify-center space-x-1.5 bg-[#8fb89e] hover:bg-[#7ea98d] text-[#0e2a18] border border-[#78a387] font-extrabold py-2 rounded-xl text-xs"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={routine.id}
                    className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-base font-extrabold text-white">{routine.name}</h3>
                            <span className="text-xs bg-[#2d4554] text-[#cbd5e1] border border-[#3f5d70] px-2 py-0.5 rounded-md font-mono">
                              {routine.exercises?.length || 0} exercises
                            </span>
                          </div>
                          {routine.description && (
                            <p className="text-xs text-[#cbd5e1] mt-0.5 font-medium">
                              {routine.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleStartInlineEdit(routine.id)}
                            className="p-1.5 text-[#cbd5e1] hover:text-white rounded-lg hover:bg-[#2d4554] transition"
                            title="Edit Routine Details & Exercises"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
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
                      </div>

                      <div className="mt-2.5 flex items-center space-x-2 text-xs text-[#8bb4cb] font-mono font-bold">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Cadence: repeat every {routine.target_rest_days || 3} days</span>
                      </div>

                      {/* Exercises list */}
                      <div className="mt-4 space-y-1.5">
                        <div className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">
                          Configured Exercises
                        </div>
                        <div className="space-y-1.5">
                          {routine.exercises && routine.exercises.length > 0 ? (
                            routine.exercises.map((re, idx) => (
                              <div
                                key={idx}
                                className="bg-[#2d4554] px-3 py-2 rounded-xl text-xs text-[#f1f5f9] flex items-center justify-between border border-[#3f5d70]"
                              >
                                <div className="flex items-center space-x-2">
                                  <Dumbbell className="w-3.5 h-3.5 text-[#8bb4cb]" />
                                  <span className="font-bold">{re.exercise?.name || 'Exercise'}</span>
                                  <span className="text-[10px] bg-[#3d5a6c] px-2 py-0.5 rounded text-[#cbd5e1] border border-[#4e7085]">
                                    {re.exercise?.target_muscle_group || 'General'}
                                  </span>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <span className="text-[#94a3b8] font-mono text-[11px] font-bold">
                                    {re.target_sets} sets
                                  </span>
                                  <button
                                    onClick={() => removeExerciseFromRoutine(routine.id, idx)}
                                    className="text-[#94a3b8] hover:text-[#cc8d8d] p-1"
                                    title="Remove from routine"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-[#94a3b8] italic py-1">
                              No exercises added yet. Use the Quick Add bar above.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: MASTER EXERCISE MATRIX */}
      {activeViewMode === 'matrix' && (
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-white">All Configured Exercises</h3>
              <p className="text-xs text-[#cbd5e1]">
                Spreadsheet overview — reassign exercises to different routines or change target sets.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#4e7085] text-[#94a3b8] uppercase text-[10px] font-extrabold tracking-wider">
                  <th className="py-2.5 px-3">Exercise Name</th>
                  <th className="py-2.5 px-3">Target Muscle</th>
                  <th className="py-2.5 px-3">Assigned Routine Split</th>
                  <th className="py-2.5 px-3 text-center">Target Sets</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#4e7085]/60">
                {routines.flatMap((r) =>
                  (r.exercises || []).map((re, idx) => (
                    <tr key={`${r.id}-${idx}`} className="hover:bg-[#344e5e]/50 transition">
                      <td className="py-2.5 px-3 font-bold text-white flex items-center space-x-2">
                        <Dumbbell className="w-3.5 h-3.5 text-[#8bb4cb]" />
                        <span>{re.exercise?.name || 'Exercise'}</span>
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="bg-[#2d4554] border border-[#3f5d70] px-2 py-0.5 rounded text-[11px] text-[#cbd5e1] font-medium">
                          {re.exercise?.target_muscle_group || 'General'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="bg-[#8bb4cb] text-[#0e2938] font-bold px-2 py-0.5 rounded text-[10px] uppercase border border-[#749fb7]">
                          {r.name}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center font-mono font-bold text-white">
                        {re.target_sets} sets
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => removeExerciseFromRoutine(r.id, idx)}
                          className="p-1 text-[#94a3b8] hover:text-[#cc8d8d] transition"
                          title="Remove exercise"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: BULK TEXT / PASTE IMPORTER */}
      {activeViewMode === 'text' && (
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
              <FileText className="w-4 h-4 text-[#8bb4cb]" />
              <span>Bulk Text & Routine Importer</span>
            </h3>
            <p className="text-xs text-[#cbd5e1]">
              Write or paste your workout routine in simple Markdown list format. Use headers (<code># Routine Name</code>) followed by exercises.
            </p>
          </div>

          <div className="space-y-2">
            <textarea
              rows={14}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full bg-[#223541] border border-[#3f5d70] rounded-xl p-4 text-xs font-mono text-white placeholder-[#94a3b8] focus:outline-none focus:border-[#8bb4cb] leading-relaxed"
              placeholder="# Split Name&#10;Exercise Name (Muscle, 3 sets)&#10;..."
            />
          </div>

          {bulkStatusMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-bold border ${
                bulkStatusMessage.startsWith('Error')
                  ? 'bg-[#cc8d8d] text-[#3b1212] border-[#b87676]'
                  : 'bg-[#8fb89e] text-[#0e2a18] border-[#78a387]'
              }`}
            >
              {bulkStatusMessage}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#4e7085]">
            <div className="text-[11px] text-[#cbd5e1] flex items-center space-x-1 font-medium">
              <HelpCircle className="w-3.5 h-3.5 text-[#8bb4cb]" />
              <span>Format: <code># Routine Name</code> followed by <code>Exercise Name (Muscle, 3 sets)</code></span>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setBulkText(starterTextTemplate)}
                className="flex-1 sm:flex-none px-3 py-2 bg-[#2d4554] hover:bg-[#253946] text-[#cbd5e1] hover:text-white rounded-xl text-xs font-bold border border-[#3f5d70] transition"
              >
                Reset Template
              </button>

              <button
                type="button"
                disabled={isBulkSaving || !bulkText.trim()}
                onClick={handleParseAndImportBulkText}
                className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 bg-[#8fb89e] hover:bg-[#7ea98d] text-[#0e2a18] border border-[#78a387] font-extrabold px-5 py-2 rounded-xl text-xs transition disabled:opacity-50 shadow-sm"
              >
                <FolderSync className="w-4 h-4" />
                <span>{isBulkSaving ? 'Saving...' : 'Parse & Save All Routines'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Routine Creator Modal */}
      {showEditor && <RoutineEditorModal onClose={() => setShowEditor(false)} />}
    </div>
  );
};
