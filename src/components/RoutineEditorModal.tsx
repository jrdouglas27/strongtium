import React, { useState } from 'react';
import { X, Plus, Trash2, Dumbbell, Save } from 'lucide-react';
import { useWorkout } from '../context/WorkoutContext';
import { MUSCLE_GROUPS } from '../types/workout';

interface RoutineEditorModalProps {
  onClose: () => void;
}

export const RoutineEditorModal: React.FC<RoutineEditorModalProps> = ({ onClose }) => {
  const { createRoutine } = useWorkout();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [restDays, setRestDays] = useState(3);
  const [exercises, setExercises] = useState<
    { name: string; muscle: string; targetSets: number }[]
  >([
    { name: '', muscle: 'General', targetSets: 3 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddExercise = () => {
    setExercises([...exercises, { name: '', muscle: 'General', targetSets: 3 }]);
  };

  const handleRemoveExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const handleUpdateExercise = (
    index: number,
    field: 'name' | 'muscle' | 'targetSets',
    val: any
  ) => {
    const updated = [...exercises];
    updated[index] = { ...updated[index], [field]: val };
    setExercises(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please provide a routine name.');
      return;
    }

    const validExercises = exercises.filter((e) => e.name.trim().length > 0);
    if (validExercises.length === 0) {
      alert('Please add at least one exercise.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createRoutine(name.trim(), description.trim(), restDays, validExercises);
      onClose();
    } catch (err) {
      console.error('Failed to create routine:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-[#4e7085] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#8bb4cb] text-[#0e2938] border border-[#749fb7] flex items-center justify-center">
              <Dumbbell className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-white">Create Custom Routine</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#2d4554] rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* Routine Name */}
          <div>
            <label className="block text-xs font-bold text-white mb-1">
              Routine Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Upper Body Focus, Push Day, Legs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#94a3b8] focus:outline-none focus:border-[#8bb4cb]"
            />
          </div>

          {/* Description & Rest Cadence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-white mb-1">
                Description (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Compound presses and arms"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#94a3b8] focus:outline-none focus:border-[#8bb4cb]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-white mb-1">
                Due Cadence (Target Rest Days)
              </label>
              <select
                value={restDays}
                onChange={(e) => setRestDays(parseInt(e.target.value, 10))}
                className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#8bb4cb]"
              >
                <option value={1}>Every 1 Day (Daily)</option>
                <option value={2}>Every 2 Days</option>
                <option value={3}>Every 3 Days (Standard)</option>
                <option value={4}>Every 4 Days</option>
                <option value={5}>Every 5 Days</option>
                <option value={7}>Every 7 Days (Weekly)</option>
              </select>
            </div>
          </div>

          {/* Exercises Section */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#94a3b8]">
                Exercises
              </label>
              <button
                type="button"
                onClick={handleAddExercise}
                className="flex items-center space-x-1 text-xs font-bold text-[#8bb4cb] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Exercise</span>
              </button>
            </div>

            <div className="space-y-2">
              {exercises.map((ex, idx) => (
                <div
                  key={idx}
                  className="bg-[#2d4554] border border-[#3f5d70] p-2.5 rounded-xl flex items-center gap-2"
                >
                  <span className="w-5 text-center text-xs font-mono font-bold text-[#94a3b8]">
                    {idx + 1}
                  </span>

                  <input
                    type="text"
                    required
                    placeholder="Exercise name (e.g. Barbell Squat)"
                    value={ex.name}
                    onChange={(e) => handleUpdateExercise(idx, 'name', e.target.value)}
                    className="flex-1 bg-[#3d5a6c] border border-[#3f5d70] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#94a3b8] focus:outline-none focus:border-[#8bb4cb]"
                  />

                  <select
                    value={ex.muscle}
                    onChange={(e) => handleUpdateExercise(idx, 'muscle', e.target.value)}
                    className="w-28 bg-[#3d5a6c] border border-[#3f5d70] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {MUSCLE_GROUPS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={ex.targetSets}
                    onChange={(e) =>
                      handleUpdateExercise(idx, 'targetSets', parseInt(e.target.value, 10) || 3)
                    }
                    className="w-16 bg-[#3d5a6c] border border-[#3f5d70] rounded-lg px-2 py-1.5 text-xs text-center text-white font-mono font-bold"
                    title="Target Sets"
                  />

                  {exercises.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveExercise(idx)}
                      className="p-1.5 text-[#94a3b8] hover:text-[#cc8d8d] rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-3 border-t border-[#4e7085] flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[#2d4554] hover:bg-[#253946] text-white border border-[#3f5d70] font-bold py-2.5 rounded-xl text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center space-x-1.5 bg-[#8fb89e] hover:bg-[#7ea98d] text-[#0e2a18] border border-[#78a387] font-extrabold py-2.5 rounded-xl text-xs transition disabled:opacity-50 shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Creating...' : 'Save Routine'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
