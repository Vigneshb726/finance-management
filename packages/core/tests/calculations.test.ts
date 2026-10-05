import { describe, expect, it } from 'vitest';
import {
  budgetStatus,
  calculateBudgetUsage,
  calculateGoalProgress,
  crossedMilestones,
  fromPaise,
  monthRange,
  percentage,
  shiftMonth,
  toPaise,
} from '../src';
import { occurrenceDate } from '../src/services/recurring.service';
import { csvCell } from '../src/services/csv.service';

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

describe('money in paise', () => {
  it('converts without floating-point drift', () => {
    expect(toPaise(0.1) + toPaise(0.2)).toBe(30);
    expect(fromPaise(toPaise(0.1) + toPaise(0.2))).toBe(0.3);
    expect(toPaise(1234.56)).toBe(123456);
    expect(fromPaise('4500000')).toBe(45000);
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

describe('recurring schedule', () => {
  it('keeps month-end dates without drifting', () => {
    const dates = [0, 1, 2, 3].map((k) => occurrenceDate('2026-01-31', 'MONTHLY', 1, k));
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('supports daily, weekly, every-N and yearly rules', () => {
    expect(occurrenceDate('2026-10-05', 'DAILY', 1, 3)).toBe('2026-10-08');
    expect(occurrenceDate('2026-10-05', 'WEEKLY', 2, 1)).toBe('2026-10-19');
    expect(occurrenceDate('2026-10-05', 'MONTHLY', 3, 1)).toBe('2027-01-05');
    expect(occurrenceDate('2028-02-29', 'YEARLY', 1, 1)).toBe('2029-02-28');
  });
});

describe('CSV cells', () => {
  it('quotes and neutralises formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('-1200.00', { text: false })).toBe('-1200.00');
    expect(csvCell(null)).toBe('');
  });
});
