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
