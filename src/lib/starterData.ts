import { Routine } from '../types/workout';

export const STARTER_ROUTINES: Omit<Routine, 'user_id' | 'id' | 'created_at'>[] = [
  {
    name: 'Push (Chest, Shoulders & Triceps)',
    description: 'Upper body pushing power and hypertrophy',
    target_rest_days: 3,
    order_index: 0,
    exercises: [
      {
        id: 'ex-bench-press',
        routine_id: 'sample-push',
        exercise_id: 'ex-bench-press',
        target_sets: 3,
        order_index: 0,
        exercise: {
          id: 'ex-bench-press',
          user_id: 'sample',
          name: 'Barbell Bench Press',
          target_muscle_group: 'Chest',
          default_unit: 'kg',
          created_at: new Date().toISOString(),
        }
      },
      {
        id: 'ex-overhead-press',
        routine_id: 'sample-push',
        exercise_id: 'ex-overhead-press',
        target_sets: 3,
        order_index: 1,
        exercise: {
          id: 'ex-overhead-press',
          user_id: 'sample',
          name: 'Overhead Shoulder Press',
          target_muscle_group: 'Shoulders',
          default_unit: 'kg',
          created_at: new Date().toISOString(),
        }
      },
      {
        id: 'ex-incline-dumbbell-press',
        routine_id: 'sample-push',
        exercise_id: 'ex-incline-dumbbell-press',
        target_sets: 3,
        order_index: 2,
        exercise: {
          id: 'ex-incline-dumbbell-press',
          user_id: 'sample',
          name: 'Incline Dumbbell Press',
          target_muscle_group: 'Chest',
          default_unit: 'kg',
          created_at: new Date().toISOString(),
        }
      },
      {
        id: 'ex-tricep-pushdown',
        routine_id: 'sample-push',
        exercise_id: 'ex-tricep-pushdown',
        target_sets: 3,
        order_index: 3,
        exercise: {
          id: 'ex-tricep-pushdown',
          user_id: 'sample',
          name: 'Triceps Cable Pushdown',
          target_muscle_group: 'Triceps',
          default_unit: 'kg',
          created_at: new Date().toISOString(),
        }
      }
    ]
  },
  {
    name: 'Pull (Back & Biceps)',
    description: 'Back thickness, width and bicep growth',
    target_rest_days: 3,
    order_index: 1,
    exercises: [
      {
        id: 'ex-barbell-row',
        routine_id: 'sample-pull',
        exercise_id: 'ex-barbell-row',
        target_sets: 3,
        order_index: 0,
        exercise: {
          id: 'ex-barbell-row',
          user_id: 'sample',
          name: 'Barbell Bent-Over Row',
          target_muscle_group: 'Back',
          default_unit: 'kg',
          created_at: new Date().toISOString(),
        }
      },
      {
        id: 'ex-lat-pulldown',
        routine_id: 'sample-pull',
        exercise_id: 'ex-lat-pulldown',
        target_sets: 3,
        order_index: 1,
        exercise: {
          id: 'ex-lat-pulldown',
          user_id: 'sample',
          name: 'Lat Pulldown / Pull-Ups',
          target_muscle_group: 'Back',
          default_unit: 'kg',
          created_at: new Date().toISOString(),
        }
      },
      {
        id: 'ex-bicep-curl',
        routine_id: 'sample-pull',
        exercise_id: 'ex-bicep-curl',
        target_sets: 3,
        order_index: 2,
        exercise: {
          id: 'ex-bicep-curl',
          user_id: 'sample',
          name: 'Dumbbell Bicep Curls',
          target_muscle_group: 'Biceps',
          default_unit: 'kg',
          created_at: new Date().toISOString(),
        }
      },
      {
        id: 'ex-face-pull',
        routine_id: 'sample-pull',
        exercise_id: 'ex-face-pull',
        target_sets: 3,
        order_index: 3,
        exercise: {
          id: 'ex-face-pull',
          user_id: 'sample',
          name: 'Face Pulls',
          target_muscle_group: 'Rear Delts',
          default_unit: 'kg',
          created_at: new Date().toISOString(),
        }
      }
    ]
  },
  {
    name: 'Legs & Core',
    description: 'Lower body foundation and core stability',
    target_rest_days: 3,
    order_index: 2,
    exercises: [
      {
        id: 'ex-squat',
        routine_id: 'sample-legs',
        exercise_id: 'ex-squat',
        target_sets: 3,
        order_index: 0,
        exercise: {
          id: 'ex-squat',
          user_id: 'sample',
          name: 'Barbell Squat',
          target_muscle_group: 'Quads / Glutes',
          default_unit: 'kg',
          created_at: new Date().toISOString(),
        }
      },
      {
        id: 'ex-romanian-deadlift',
        routine_id: 'sample-legs',
        exercise_id: 'ex-romanian-deadlift',
        target_sets: 3,
        order_index: 1,
        exercise: {
          id: 'ex-romanian-deadlift',
          user_id: 'sample',
          name: 'Romanian Deadlift (RDL)',
          target_muscle_group: 'Hamstrings',
          default_unit: 'kg',
          created_at: new Date().toISOString(),
        }
      },
      {
        id: 'ex-leg-press',
        routine_id: 'sample-legs',
        exercise_id: 'ex-leg-press',
        target_sets: 3,
        order_index: 2,
        exercise: {
          id: 'ex-leg-press',
          user_id: 'sample',
          name: 'Leg Press / Bulgarian Split Squat',
          target_muscle_group: 'Quads',
          default_unit: 'kg',
          created_at: new Date().toISOString(),
        }
      },
      {
        id: 'ex-standing-calf-raise',
        routine_id: 'sample-legs',
        exercise_id: 'ex-standing-calf-raise',
        target_sets: 3,
        order_index: 3,
        exercise: {
          id: 'ex-standing-calf-raise',
          user_id: 'sample',
          name: 'Standing Calf Raise',
          target_muscle_group: 'Calves',
          default_unit: 'kg',
          created_at: new Date().toISOString(),
        }
      }
    ]
  }
];
