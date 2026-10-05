import type { CoreContext } from '../context';
import type { TransactionType } from '../types';
import { change, percentage, round2 } from '../utils/calculations';
import { addDays, currentYearMonth, daysInMonth, monthBounds, monthKey, shiftMonth } from '../utils/dates';
import { fromPaise } from '../utils/money';
import type { CategoryAnalyticsQuery, MonthlyQuery, PeriodQuery } from '../validators/schemas';
import { getBudgetUsageForMonth } from './budgetUsage.service';
import { selectTransactions, serializeTransaction, transactionsWithCategory } from './transaction.service';

const resolvePeriod = (ctx: CoreContext, p: PeriodQuery) => {
  const now = currentYearMonth(ctx.now());
  return { year: p.year ?? now.year, month: p.month ?? now.month };
};

/** Income/expense totals (rupees) and transaction count, optionally within [start, end). */
export async function totalsByType(ctx: CoreContext, userId: string, range?: { start: string; end: string }) {
  let query = ctx.db
    .selectFrom('Transaction')
    .select((eb) => ['type', eb.fn.sum<number>('amount').as('total'), eb.fn.countAll<number>().as('count')])
    .where('userId', '=', userId);
  if (range) query = query.where('date', '>=', range.start).where('date', '<', range.end);
  const groups = await query.groupBy('type').execute();

  const income = groups.find((g) => g.type === 'INCOME');
  const expense = groups.find((g) => g.type === 'EXPENSE');
  return {
    income: round2(fromPaise(income?.total)),
    expense: round2(fromPaise(expense?.total)),
    count: Number(income?.count ?? 0) + Number(expense?.count ?? 0),
  };
}

/** Dashboard summary — every figure is computed from the database on request. */
export async function getSummary(ctx: CoreContext, userId: string, period: PeriodQuery) {
  const { year, month } = resolvePeriod(ctx, period);
  const prevYm = shiftMonth(year, month, -1);

  const [allTime, thisMonth, lastMonth, budget, goals, recent] = await Promise.all([
    totalsByType(ctx, userId),
    totalsByType(ctx, userId, monthBounds(year, month)),
    totalsByType(ctx, userId, monthBounds(prevYm.year, prevYm.month)),
    getBudgetUsageForMonth(ctx, userId, year, month),
    ctx.db.selectFrom('FinancialGoal').select(['targetAmount', 'currentAmount']).where('userId', '=', userId).execute(),
    selectTransactions(transactionsWithCategory(ctx, userId))
      .orderBy('t.date', 'desc')
      .orderBy('t.createdAt', 'desc')
      .orderBy('t.id', 'desc')
      .limit(6)
      .execute(),
  ]);

  const goalTarget = goals.reduce((s, g) => s + fromPaise(g.targetAmount), 0);
  const goalSaved = goals.reduce((s, g) => s + fromPaise(g.currentAmount), 0);
  const netSavings = round2(thisMonth.income - thisMonth.expense);
  const prevNet = round2(lastMonth.income - lastMonth.expense);

  return {
    period: { year, month },
    // Total Balance = Total Income − Total Expenses (all time)
    totalBalance: round2(allTime.income - allTime.expense),
    totalIncome: allTime.income,
    totalExpenses: allTime.expense,
    month: {
      income: thisMonth.income,
      expenses: thisMonth.expense,
      // Net Savings = Income − Expenses (selected month)
      netSavings,
      savingsRate: percentage(Math.max(netSavings, 0), thisMonth.income),
      transactionCount: thisMonth.count,
      incomeChange: change(thisMonth.income, lastMonth.income),
      expenseChange: change(thisMonth.expense, lastMonth.expense),
      netSavingsChange: change(netSavings, prevNet),
    },
    budget: budget
      ? {
          id: budget.id,
          amount: budget.amount,
          spent: budget.spent,
          remaining: budget.remaining,
          usage: budget.usage,
          status: budget.status,
          categories: budget.categories,
        }
      : null,
    goals: {
      count: goals.length,
      completed: goals.filter((g) => Number(g.currentAmount) >= Number(g.targetAmount)).length,
      totalTarget: round2(goalTarget),
      totalSaved: round2(goalSaved),
      progress: percentage(goalSaved, goalTarget),
    },
    recentTransactions: recent.map(serializeTransaction),
  };
}

/** Daily income/expense sums (paise) in [start, end). */
async function dailyTotals(ctx: CoreContext, userId: string, start: string, end: string) {
  return ctx.db
    .selectFrom('Transaction')
    .select((eb) => ['date', 'type', eb.fn.sum<number>('amount').as('total')])
    .where('userId', '=', userId)
    .where('date', '>=', start)
    .where('date', '<', end)
    .groupBy(['date', 'type'])
    .execute();
}

/** Income, expenses, savings and budget per month for the last `months` months. */
export async function getMonthly(ctx: CoreContext, userId: string, params: MonthlyQuery) {
  const end = resolvePeriod(ctx, params);
  const first = shiftMonth(end.year, end.month, -(params.months - 1));
  const startDate = monthBounds(first.year, first.month).start;
  const endDate = monthBounds(end.year, end.month).end;

  // Grouped by day in SQL, by month here — keeps the query identical on PostgreSQL and SQLite
  const days = await dailyTotals(ctx, userId, startDate, endDate);
  const sums = new Map<string, number>();
  for (const d of days) {
    const key = `${d.date.slice(0, 7)}:${d.type}`;
    sums.set(key, (sums.get(key) ?? 0) + Number(d.total));
  }

  const budgets = await ctx.db
    .selectFrom('Budget')
    .select(['year', 'month', 'totalAmount'])
    .where('userId', '=', userId)
    .where('year', '>=', first.year)
    .where('year', '<=', end.year)
    .execute();

  let cumulative = 0;
  return Array.from({ length: params.months }, (_, i) => {
    const { year, month } = shiftMonth(first.year, first.month, i);
    const key = monthKey(year, month);
    const income = round2(fromPaise(sums.get(`${key}:INCOME`)));
    const expense = round2(fromPaise(sums.get(`${key}:EXPENSE`)));
    const savings = round2(income - expense);
    cumulative = round2(cumulative + savings);
    const row = budgets.find((b) => b.year === year && b.month === month);
    const budget = row ? fromPaise(row.totalAmount) : null;
    return {
      month: key,
      year,
      monthIndex: month,
      income,
      expense,
      savings,
      cumulativeSavings: cumulative,
      savingsRate: percentage(Math.max(savings, 0), income),
      budget,
      budgetUsage: budget ? percentage(expense, budget) : null,
    };
  });
}

/** Spending (or income) grouped by category for a date range (defaults to the current month). */
export async function getCategoryBreakdown(ctx: CoreContext, userId: string, params: CategoryAnalyticsQuery) {
  const now = currentYearMonth(ctx.now());
  const range = monthBounds(now.year, now.month);
  const start = params.startDate ?? range.start;
  const endInclusive = params.endDate ?? addDays(range.end, -1);

  const groups = await ctx.db
    .selectFrom('Transaction as t')
    .innerJoin('Category as c', 'c.id', 't.categoryId')
    .select((eb) => [
      't.categoryId',
      'c.name',
      'c.color',
      'c.icon',
      eb.fn.sum<number>('t.amount').as('total'),
      eb.fn.countAll<number>().as('count'),
    ])
    .where('t.userId', '=', userId)
    .where('t.type', '=', params.type)
    .where('t.date', '>=', start)
    .where('t.date', '<=', endInclusive)
    .groupBy(['t.categoryId', 'c.name', 'c.color', 'c.icon'])
    .execute();

  const total = groups.reduce((s, g) => s + fromPaise(g.total), 0);
  const data = groups
    .map((g) => {
      const amount = round2(fromPaise(g.total));
      return {
        categoryId: g.categoryId,
        name: g.name,
        color: g.color,
        icon: g.icon,
        total: amount,
        count: Number(g.count),
        percentage: percentage(amount, total),
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return { type: params.type as TransactionType, startDate: start, endDate: endInclusive, total: round2(total), data };
}

/** Day-by-day spending for a month, with a running cumulative total. */
export async function getDailyTrend(ctx: CoreContext, userId: string, period: PeriodQuery) {
  const { year, month } = resolvePeriod(ctx, period);
  const { start, end } = monthBounds(year, month);
  const groups = await dailyTotals(ctx, userId, start, end);

  let cumulativeExpense = 0;
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => {
    const date = addDays(start, i);
    const sumFor = (type: TransactionType) =>
      fromPaise(groups.find((g) => g.type === type && g.date === date)?.total);
    const expense = round2(sumFor('EXPENSE'));
    cumulativeExpense = round2(cumulativeExpense + expense);
    return { date, day: i + 1, income: round2(sumFor('INCOME')), expense, cumulativeExpense };
  });
}
