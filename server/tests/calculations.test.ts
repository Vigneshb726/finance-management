import { describe, expect, it } from 'vitest';
import {
  budgetStatus,
  calculateBudgetUsage,
  calculateGoalProgress,
  crossedMilestones,
  percentage,
} from '../src/utils/calculations';
import { monthRange, shiftMonth } from '../src/utils/dates';

describe('budget calculations', () => {
  it('matches the spec example (₹5,000 budget, ₹3,750 spent)', () => {
    expect(calculateBudgetUsage(5000, 3750)).toEqual({
      amount: 5000,
      spent: 3750,
      remaining: 1250,
      usage: 75,
      status: 'ON_TRACK',
    });
  });

  it('flags warning at 80% and exceeded above 100%', () => {
    expect(budgetStatus(79.99)).toBe('ON_TRACK');
    expect(budgetStatus(80)).toBe('WARNING');
    expect(budgetStatus(100)).toBe('WARNING');
    expect(budgetStatus(100.01)).toBe('EXCEEDED');
    expect(calculateBudgetUsage(1000, 1500).remaining).toBe(-500);
  });

  it('handles zero budgets safely', () => {
    expect(percentage(100, 0)).toBe(0);
  });
});

describe('goal calculations', () => {
  it('matches the spec example (₹80,000 target, ₹35,000 saved)', () => {
    expect(calculateGoalProgress(35000, 80000)).toEqual({ progress: 43.75, remaining: 45000, isCompleted: false });
  });

  it('detects completed goals', () => {
    expect(calculateGoalProgress(90000, 80000)).toMatchObject({ remaining: 0, isCompleted: true });
  });

  it('reports newly crossed milestones only', () => {
    expect(crossedMilestones(10, 60)).toEqual([25, 50]);
    expect(crossedMilestones(60, 74)).toEqual([]);
    expect(crossedMilestones(74, 100)).toEqual([75, 100]);
  });
});

describe('date helpers', () => {
  it('shifts months across year boundaries', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 10, -5)).toEqual({ year: 2026, month: 5 });
  });

  it('builds half-open month ranges in UTC', () => {
    const { start, end } = monthRange(2026, 2);
    expect(start.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });
});
