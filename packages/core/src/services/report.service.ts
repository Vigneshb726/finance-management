import type { CoreContext } from '../context';
import { change, percentage, round2 } from '../utils/calculations';
import { addDays, monthBounds, monthName, shiftMonth } from '../utils/dates';
import { getCategoryBreakdown, getMonthly, totalsByType } from './analytics.service';
import { getBudgetUsageForMonth } from './budgetUsage.service';
import { listGoals } from './goal.service';
import { findTransactions } from './transaction.service';

/** Most transactions listed in a report (totals always include everything). */
export const REPORT_TRANSACTION_LIMIT = 1000;

/**
 * All figures for the printable monthly report: income, expenses and savings,
 * category breakdowns, budget performance, transaction summary and goals.
 */
export async function getMonthlyReport(ctx: CoreContext, userId: string, params: { year: number; month: number }) {
  const { year, month } = params;
  const bounds = monthBounds(year, month);
  const lastDay = addDays(bounds.end, -1);
  const prev = shiftMonth(year, month, -1);

  const [user, current, previous, expenseCategories, incomeCategories, budget, trend, goals, transactions] =
    await Promise.all([
      ctx.db.selectFrom('User').select(['name', 'email', 'currency']).where('id', '=', userId).executeTakeFirstOrThrow(),
      totalsByType(ctx, userId, bounds),
      totalsByType(ctx, userId, monthBounds(prev.year, prev.month)),
      getCategoryBreakdown(ctx, userId, { type: 'EXPENSE', startDate: bounds.start, endDate: lastDay }),
      getCategoryBreakdown(ctx, userId, { type: 'INCOME', startDate: bounds.start, endDate: lastDay }),
      getBudgetUsageForMonth(ctx, userId, year, month),
      getMonthly(ctx, userId, { year, month, months: 6 }),
      listGoals(ctx, userId),
      findTransactions(
        ctx,
        userId,
        { startDate: bounds.start, endDate: lastDay, sortBy: 'date', sortOrder: 'asc' },
        REPORT_TRANSACTION_LIMIT + 1,
      ),
    ]);

  const netSavings = round2(current.income - current.expense);
  const prevNet = round2(previous.income - previous.expense);
  const listed = transactions.slice(0, REPORT_TRANSACTION_LIMIT);
  const expenses = transactions.filter((t) => t.type === 'EXPENSE');

  const byPayment = new Map<string, { method: string; count: number; total: number }>();
  for (const t of expenses) {
    const row = byPayment.get(t.paymentMethod) ?? { method: t.paymentMethod, count: 0, total: 0 };
    row.count++;
    row.total = round2(row.total + t.amount);
    byPayment.set(t.paymentMethod, row);
  }

  return {
    generatedAt: ctx.now().toISOString(),
    period: { year, month, label: `${monthName(month)} ${year}`, startDate: bounds.start, endDate: lastDay },
    user: { name: user.name, email: user.email, currency: user.currency },
    summary: {
      income: current.income,
      expenses: current.expense,
      netSavings,
      savingsRate: percentage(Math.max(netSavings, 0), current.income),
      transactionCount: current.count,
      previous: { income: previous.income, expenses: previous.expense, netSavings: prevNet },
      incomeChange: change(current.income, previous.income),
      expenseChange: change(current.expense, previous.expense),
      netSavingsChange: change(netSavings, prevNet),
    },
    expenseCategories,
    incomeCategories,
    budget,
    trend,
    goals: goals.map((g) => ({
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      progress: g.progress,
      status: g.status,
      targetDate: g.targetDate,
    })),
    transactions: {
      count: current.count,
      incomeCount: transactions.filter((t) => t.type === 'INCOME').length,
      expenseCount: expenses.length,
      averageExpense: expenses.length ? round2(current.expense / expenses.length) : 0,
      largestExpenses: [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5),
      byPaymentMethod: [...byPayment.values()].sort((a, b) => b.total - a.total),
      list: listed,
      truncated: transactions.length > REPORT_TRANSACTION_LIMIT,
    },
  };
}

export type MonthlyReport = Awaited<ReturnType<typeof getMonthlyReport>>;
