/** Pure financial calculations shared by services (unit tested). */

export const BUDGET_WARNING_THRESHOLD = 80;
export const GOAL_MILESTONES = [25, 50, 75, 100] as const;

export type BudgetStatus = 'ON_TRACK' | 'WARNING' | 'EXCEEDED';

export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/** (part / whole) × 100, rounded to 2 decimals. Returns 0 when whole is 0. */
export function percentage(part: number, whole: number): number {
  if (!whole || whole <= 0) return 0;
  return round2((part / whole) * 100);
}

export function budgetStatus(usage: number): BudgetStatus {
  if (usage > 100) return 'EXCEEDED';
  if (usage >= BUDGET_WARNING_THRESHOLD) return 'WARNING';
  return 'ON_TRACK';
}

export interface BudgetUsage {
  amount: number;
  spent: number;
  remaining: number;
  usage: number;
  status: BudgetStatus;
}

/** Budget Remaining = Budget − Spent; Usage % = Spent / Budget × 100 */
export function calculateBudgetUsage(amount: number, spent: number): BudgetUsage {
  const usage = percentage(spent, amount);
  return {
    amount: round2(amount),
    spent: round2(spent),
    remaining: round2(amount - spent),
    usage,
    status: budgetStatus(usage),
  };
}

/** Goal Progress % = Current / Target × 100 */
export function calculateGoalProgress(current: number, target: number) {
  const progress = percentage(current, target);
  return {
    progress,
    remaining: round2(Math.max(target - current, 0)),
    isCompleted: target > 0 && current >= target,
  };
}

/** Milestones newly reached when progress moves from `before` to `after`. */
export function crossedMilestones(before: number, after: number): number[] {
  return GOAL_MILESTONES.filter((m) => before < m && after >= m);
}

/** Month-over-month change in %, or null when there is no previous value. */
export const change = (current: number, previous: number): number | null =>
  previous === 0 ? null : round2(((current - previous) / Math.abs(previous)) * 100);
