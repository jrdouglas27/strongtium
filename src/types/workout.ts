export interface Routine {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  target_rest_days: number;
  last_completed_at?: string | null;
  order_index: number;
  created_at: string;
  exercises?: RoutineExercise[];
}

export interface Exercise {
  id: string;
  user_id: string;
  name: string;
  target_muscle_group?: string;
  default_unit: 'kg' | 'lbs';
  created_at: string;
}

export interface RoutineExercise {
  id: string;
  routine_id: string;
  exercise_id: string;
  target_sets: number;
  order_index: number;
  exercise?: Exercise;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  routine_id?: string | null;
  routine_name: string;
  started_at: string;
  completed_at?: string | null;
  session_notes?: string;
  logged_exercises?: LoggedExercise[];
}

export interface LoggedExercise {
  id: string;
  session_id: string;
  exercise_id?: string | null;
  exercise_name: string;
  exercise_notes?: string;
  order_index: number;
  sets: LoggedSet[];
}

export interface LoggedSet {
  id: string;
  logged_exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  is_pr?: boolean;
  created_at: string;
}

export interface LastExercisePerformance {
  exercise_name: string;
  last_performed_at: string;
  notes?: string;
  sets: {
    set_number: number;
    weight: number;
    reps: number;
  }[];
  best_estimated_1rm: number;
  max_weight: number;
}

export interface PersonalRecord {
  exercise_id?: string;
  exercise_name: string;
  max_weight: number;
  max_reps_at_max_weight: number;
  best_estimated_1rm: number;
  achieved_at: string;
}

export interface RoutineDueStatus {
  status: 'due' | 'upcoming' | 'ready' | 'never_done';
  daysSinceLast: number | null;
  daysUntilDue: number | null;
  dueDate: Date | null;
  badgeText: string;
  badgeColor: 'red' | 'amber' | 'green' | 'blue' | 'gray';
}

export interface LogExercisePayload {
  exerciseId?: string;
  exerciseName: string;
  targetMuscleGroup?: string;
  routineId?: string;
  routineName?: string;
  exerciseNotes?: string;
  sets: {
    setNumber: number;
    weight: number;
    reps: number;
  }[];
  loggedAt?: string;
}

export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Hands / Wrists',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Shins (Tibialis)',
  'Feet / Ankles',
  'Core / Abs',
  'Neck / Traps',
  'Hips / Adductors',
  'Full Body',
  'General',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];


