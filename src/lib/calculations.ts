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


