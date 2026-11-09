import { RoutineDueStatus } from '../types/workout';

/**
 * Calculate Estimated 1 Rep Max (1RM) using Epley's formula.
 * Formula: 1RM = Weight * (1 + Reps / 30)
 */
export function calculate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  const epley = weight * (1 + reps / 30);
  return Math.round(epley * 10) / 10;
}

/**
 * Calculate total training volume for a set or exercise.
 */
export function calculateVolume(weight: number, reps: number): number {
  return (weight || 0) * (reps || 0);
}

/**
 * Calculates due status for a routine based on 3-day recovery rule.
 * Rule: Routine is due 3 days after completion, and stays 'Due' until done.
 */
export function calculateRoutineDueStatus(
  lastCompletedAt: string | null | undefined,
  targetRestDays: number = 3
): RoutineDueStatus {
  if (!lastCompletedAt) {
    return {
      status: 'never_done',
      daysSinceLast: null,
      daysUntilDue: 0,
      dueDate: null,
      badgeText: 'Ready to Start',
      badgeColor: 'blue',
    };
  }

  const lastDate = new Date(lastCompletedAt);
  const now = new Date();

  // Reset hours for accurate day-level difference
  const lastMidnight = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = todayMidnight.getTime() - lastMidnight.getTime();
  const daysSinceLast = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const daysUntilDue = targetRestDays - daysSinceLast;
  const dueDate = new Date(lastMidnight.getTime() + targetRestDays * 24 * 60 * 60 * 1000);

  if (daysSinceLast >= targetRestDays) {
    const overdueDays = daysSinceLast - targetRestDays;
    let badgeText = 'Due Today';
    if (overdueDays === 1) badgeText = '1 day overdue';
    else if (overdueDays > 1) badgeText = `${overdueDays} days overdue`;

    return {
      status: 'due',
      daysSinceLast,
      daysUntilDue: 0,
      dueDate,
      badgeText,
      badgeColor: overdueDays > 0 ? 'red' : 'amber',
    };
  } else if (daysSinceLast === targetRestDays - 1) {
    return {
      status: 'upcoming',
      daysSinceLast,
      daysUntilDue: 1,
      dueDate,
      badgeText: 'Due Tomorrow',
      badgeColor: 'blue',
    };
  } else {
    return {
      status: 'upcoming',
      daysSinceLast,
      daysUntilDue,
      dueDate,
      badgeText: `In ${daysUntilDue} days`,
      badgeColor: 'gray',
    };
  }
}

/**
 * Calculates due status for an individual exercise/movement based on 3-day recovery rule.
 * Rule: Exercise is repeated every 3 days. Returns days until repeat or how many days overdue.
 */
export function calculateMovementDueStatus(
  lastPerformedAt: string | null | undefined,
  targetRestDays: number = 3
): RoutineDueStatus {
  if (!lastPerformedAt) {
    return {
      status: 'never_done',
      daysSinceLast: null,
      daysUntilDue: 0,
      dueDate: null,
      badgeText: 'New Movement',
      badgeColor: 'blue',
    };
  }

  const lastDate = new Date(lastPerformedAt);
  const now = new Date();

  // Reset hours for accurate day-level difference
  const lastMidnight = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = todayMidnight.getTime() - lastMidnight.getTime();
  const daysSinceLast = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const daysUntilDue = targetRestDays - daysSinceLast;
  const dueDate = new Date(lastMidnight.getTime() + targetRestDays * 24 * 60 * 60 * 1000);

  if (daysSinceLast >= targetRestDays) {
    const overdueDays = daysSinceLast - targetRestDays;
    let badgeText = 'Repeat Today';
    if (overdueDays === 1) badgeText = '1 day overdue';
    else if (overdueDays > 1) badgeText = `${overdueDays} days overdue`;

    return {
      status: 'due',
      daysSinceLast,
      daysUntilDue: 0,
      dueDate,
      badgeText,
      badgeColor: overdueDays > 0 ? 'red' : 'amber',
    };
  } else if (daysSinceLast === targetRestDays - 1) {
    return {
      status: 'upcoming',
      daysSinceLast,
      daysUntilDue: 1,
      dueDate,
      badgeText: 'Due in 1 day',
      badgeColor: 'blue',
    };
  } else {
    return {
      status: 'upcoming',
      daysSinceLast,
      daysUntilDue,
      dueDate,
      badgeText: `Due in ${daysUntilDue} days`,
      badgeColor: 'gray',
    };
  }
}

/**
 * Format date nicely for human display
 */
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'Never';
  const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format relative time (e.g. "3 days ago", "Today")
 */
export function formatRelativeDays(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  const d = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

/**
 * Return date formatted as YYYY-MM-DD in local time
 */
export function toLocalISODate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Return yesterday's date formatted as YYYY-MM-DD in local time
 */
export function getYesterdayISODate(): string {
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  return toLocalISODate(yest);
}

/**
 * Format a YYYY-MM-DD string into a human-friendly label (e.g. "Today", "Yesterday", "Mon, Oct 12")
 */
export function formatWorkoutDateLabel(dateStr: string): string {
  const today = toLocalISODate(new Date());
  if (dateStr === today) return 'Today';

  const yesterday = getYesterdayISODate();
  if (dateStr === yesterday) return 'Yesterday';

  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Check if two dates represent the same calendar day
 */
export function isSameDate(d1: Date | string, d2: Date | string): boolean {
  const date1 = typeof d1 === 'string' ? new Date(d1.includes('T') ? d1 : `${d1}T12:00:00`) : d1;
  const date2 = typeof d2 === 'string' ? new Date(d2.includes('T') ? d2 : `${d2}T12:00:00`) : d2;
  return date1.toDateString() === date2.toDateString();
}

/**
 * Strips side indicators (e.g. "(Left Arm)", "(Right Leg)") to return the base exercise name
 */
export function getBaseExerciseName(name: string): string {
  if (!name) return '';
  return name.replace(/\s*\((Left|Right)(\s+(Arm|Leg|Side))?\)/i, '').trim();
}

/**
 * Detects if an exercise name indicates a unilateral movement (Left or Right side)
 */
export function isUnilateralExercise(name: string): {
  isUnilateral: boolean;
  side: 'left' | 'right' | null;
  label: string | null;
} {
  if (!name) return { isUnilateral: false, side: null, label: null };
  const match = name.match(/\((Left|Right)(\s+(Arm|Leg|Side))?\)/i);
  if (!match) return { isUnilateral: false, side: null, label: null };
  const side = match[1].toLowerCase() as 'left' | 'right';
  const limb = match[3] ? match[3] : 'Side';
  return {
    isUnilateral: true,
    side,
    label: `${match[1].toUpperCase()} ${limb.toUpperCase()}`,
  };
}

/**
 * Determines whether a muscle group typically splits by Arm or Leg
 */
export function getLimbTypeForMuscle(muscle: string): 'Arm' | 'Leg' {
  const lower = (muscle || '').toLowerCase();
  const legMuscles = ['quad', 'hamstring', 'calf', 'calves', 'shin', 'feet', 'ankle', 'glute', 'leg'];
  const isLeg = legMuscles.some((m) => lower.includes(m));
  return isLeg ? 'Leg' : 'Arm';
}

/**
 * Detects if an exercise is typically performed unilaterally (L & R sides)
 * Supports user custom preference overrides (exercise name -> boolean)
 */
export function isUnilateralMovement(
  name: string,
  muscle?: string,
  customPreferences?: Record<string, boolean>
): boolean {
  if (!name) return false;
  const baseName = getBaseExerciseName(name).trim().toLowerCase();

  // 1. Check user custom preference overrides first
  if (customPreferences) {
    if (baseName in customPreferences) {
      return Boolean(customPreferences[baseName]);
    }
    const match = Object.keys(customPreferences).find(
      (k) => k.trim().toLowerCase() === baseName
    );
    if (match !== undefined) {
      return Boolean(customPreferences[match]);
    }
  }

  // 2. Check explicit (Left/Right) indicator
  if (/\((left|right)(\s+(arm|leg|side))?\)/i.test(name)) return true;

  // 3. Common unilateral movements
  const unilateralKeywords = [
    'bicep curl',
    'dumbbell curl',
    'hammer curl',
    'concentration curl',
    'preacher curl',
    'single arm',
    'single leg',
    'one arm',
    'one leg',
    'lateral raise',
    'split squat',
    'lunge',
    'kickback',
    'bulgarian',
    'step up',
    'pistol squat',
  ];

  if (unilateralKeywords.some((kw) => baseName.includes(kw))) return true;

  // 4. Also if muscle is Biceps or Forearms and mentions dumbbell
  if (baseName.includes('dumbbell') && (baseName.includes('curl') || (muscle && /bicep|forearm/i.test(muscle)))) {
    return true;
  }

  return false;
}

/**
 * Generates continuous, evenly-spaced time ticks (Unix timestamps in ms)
 * for charts with continuous X axes.
 */
export function getTimeTicks(min: number, max: number): number[] {
  if (min >= max) return [min];
  const DAY = 86400000;
  const span = max - min;
  const spanDays = span / DAY;

  let intervalDays = 1;
  if (spanDays > 730) intervalDays = 180;
  else if (spanDays > 365) intervalDays = 90;
  else if (spanDays > 180) intervalDays = 60;
  else if (spanDays > 90) intervalDays = 30;
  else if (spanDays > 45) intervalDays = 14;
  else if (spanDays > 20) intervalDays = 7;
  else if (spanDays > 10) intervalDays = 3;
  else if (spanDays > 4) intervalDays = 2;
  else intervalDays = 1;

  const intervalMs = intervalDays * DAY;

  // Align starting point to midnight local time
  const startDate = new Date(min);
  startDate.setHours(0, 0, 0, 0);
  let curr = startDate.getTime();

  while (curr + intervalMs <= min) {
    curr += intervalMs;
  }

  const ticks: number[] = [];
  while (curr <= max + intervalMs * 0.1) {
    if (curr >= min - intervalMs * 0.1) {
      ticks.push(curr);
    }
    curr += intervalMs;
  }

  if (ticks.length === 0) return [min, max];
  return ticks;
}

/**
 * Calculates domain and clean ticks for a continuous time-series chart.
 */
export function getTimeDomain(
  timestamps: number[]
): { domain: [number, number]; ticks: number[]; isMultiYear: boolean } {
  if (!timestamps || timestamps.length === 0) {
    return { domain: [0, 0], ticks: [], isMultiYear: false };
  }
  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);

  if (min === max) {
    const pad = 86400000 * 2; // 2 days padding
    return {
      domain: [min - pad, max + pad],
      ticks: [min],
      isMultiYear: false,
    };
  }

  const span = max - min;
  const pad = Math.max(span * 0.05, 86400000 * 0.5); // 5% padding, at least 12h
  const domain: [number, number] = [min - pad, max + pad];
  const ticks = getTimeTicks(min, max);
  const isMultiYear = new Date(min).getFullYear() !== new Date(max).getFullYear();

  return { domain, ticks, isMultiYear };
}

export interface NormalizedProgressPoint {
  timestamp: number;
  date: string;
  rawDate: string;
  normalizedGrowthPercent: number; // e.g. 0% at baseline, +12.5%
  averageGrowthMultiplier: number; // e.g. 1.00 at baseline, 1.125
  coveredExercisesCount: number;
  contributingExercises: string[];
}

/**
 * Calculates normalized composite strength progression across all exercises over time.
 * For every completed session of an exercise, its strength (best 1RM) is compared to its original
 * baseline 1RM (first recorded session for that exercise).
 * To prevent bias from whichever specific split/exercises were done on a single day,
 * values are computed using a sliding coverage window (default 14 days, with carry-forward
 * of latest known performance for active exercises).
 */
export function calculateNormalizedProgression(
  sessions: {
    completed_at?: string | null;
    started_at?: string | null;
    logged_exercises?: {
      exercise_name: string;
      sets: { weight: number; reps: number }[];
    }[];
  }[]
): NormalizedProgressPoint[] {
  // 1. Gather all exercise performances grouped by exercise and date
  interface ExPerformance {
    timestamp: number;
    rawDate: string;
    best1RM: number;
  }

  const exercisePerfs = new Map<string, ExPerformance[]>();

  const sortedSessions = [...sessions]
    .filter((s) => s.completed_at || s.started_at)
    .sort(
      (a, b) =>
        new Date(a.completed_at || a.started_at!).getTime() -
        new Date(b.completed_at || b.started_at!).getTime()
    );

  const distinctSessionTimestamps: { timestamp: number; rawDate: string }[] = [];
  const seenDates = new Set<string>();

  sortedSessions.forEach((session) => {
    const dStr = session.completed_at || session.started_at;
    if (!dStr) return;
    const d = new Date(dStr);
    const ts = d.getTime();
    const dateKey = toLocalISODate(d);

    if (!seenDates.has(dateKey)) {
      seenDates.add(dateKey);
      distinctSessionTimestamps.push({ timestamp: ts, rawDate: dateKey });
    }

    session.logged_exercises?.forEach((le) => {
      const name = getBaseExerciseName(le.exercise_name || '').trim();
      if (!name) return;

      let best1RM = 0;
      le.sets?.forEach((st) => {
        const w = Number(st.weight) || 0;
        const r = Number(st.reps) || 0;
        const est = calculate1RM(w, r);
        if (est > best1RM) best1RM = est;
      });

      if (best1RM > 0) {
        if (!exercisePerfs.has(name)) {
          exercisePerfs.set(name, []);
        }
        exercisePerfs.get(name)!.push({ timestamp: ts, rawDate: dateKey, best1RM });
      }
    });
  });

  if (exercisePerfs.size === 0 || distinctSessionTimestamps.length === 0) {
    return [];
  }

  // 2. Determine original baseline 1RM for each exercise
  const baselineMap = new Map<string, number>();
  exercisePerfs.forEach((perfs, exName) => {
    // Sort chronologically
    perfs.sort((a, b) => a.timestamp - b.timestamp);
    if (perfs.length > 0) {
      baselineMap.set(exName, perfs[0].best1RM);
    }
  });

  // 3. For each date timestamp, evaluate the normalized score across all exercises
  // that have started by that date, carrying forward their most recent 1RM.
  const points: NormalizedProgressPoint[] = [];

  distinctSessionTimestamps.forEach(({ timestamp, rawDate }) => {
    const ratios: number[] = [];
    const contributing: string[] = [];

    exercisePerfs.forEach((perfs, exName) => {
      const baseline = baselineMap.get(exName);
      if (!baseline || baseline <= 0) return;

      // Find all performances on or before this timestamp
      const pastOrCurrentPerfs = perfs.filter((p) => p.timestamp <= timestamp);
      if (pastOrCurrentPerfs.length === 0) return; // Exercise hasn't started yet

      const latestPerf = pastOrCurrentPerfs[pastOrCurrentPerfs.length - 1];
      const ratio = latestPerf.best1RM / baseline;
      ratios.push(ratio);
      contributing.push(exName);
    });

    if (ratios.length > 0) {
      const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
      const growthPct = Math.round((avgRatio - 1.0) * 1000) / 10; // e.g. +8.5%

      const d = new Date(timestamp);
      points.push({
        timestamp,
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        rawDate,
        normalizedGrowthPercent: growthPct,
        averageGrowthMultiplier: Math.round(avgRatio * 100) / 100,
        coveredExercisesCount: ratios.length,
        contributingExercises: contributing,
      });
    }
  });

  return points;
}


