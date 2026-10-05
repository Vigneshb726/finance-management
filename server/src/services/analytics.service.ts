import { Prisma, type TransactionType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { percentage, round2 } from '../utils/calculations';
import { currentYearMonth, formatDateOnly, monthKey, monthRange, parseDateOnly, shiftMonth } from '../utils/dates';
import { getBudgetUsageForMonth } from './budgetUsage.service';
import { serializeTransaction } from './transaction.service';

interface Period {
  year?: number;
  month?: number;
}

const resolvePeriod = (p: Period) => {
  const now = currentYearMonth();
  return { year: p.year ?? now.year, month: p.month ?? now.month };
};

async function totalsByType(where: Prisma.TransactionWhereInput) {
  const groups = await prisma.transaction.groupBy({ by: ['type'], where, _sum: { amount: true }, _count: true });
  const income = groups.find((g) => g.type === 'INCOME');
  const expense = groups.find((g) => g.type === 'EXPENSE');
  return {
    income: round2(income?._sum.amount?.toNumber() ?? 0),
    expense: round2(expense?._sum.amount?.toNumber() ?? 0),
    count: (income?._count ?? 0) + (expense?._count ?? 0),
  };
}

const change = (current: number, previous: number): number | null =>
  previous === 0 ? null : round2(((current - previous) / Math.abs(previous)) * 100);

/** Dashboard summary — every figure is computed from the database on request. */
export async function getSummary(userId: string, period: Period) {
  const { year, month } = resolvePeriod(period);
  const cur = monthRange(year, month);
  const prevYm = shiftMonth(year, month, -1);
  const prev = monthRange(prevYm.year, prevYm.month);

  const [allTime, thisMonth, lastMonth, budget, goals, recent] = await Promise.all([
    totalsByType({ userId }),
    totalsByType({ userId, date: { gte: cur.start, lt: cur.end } }),
    totalsByType({ userId, date: { gte: prev.start, lt: prev.end } }),
    getBudgetUsageForMonth(userId, year, month),
    prisma.financialGoal.findMany({ where: { userId }, select: { targetAmount: true, currentAmount: true } }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 6,
      include: { category: { select: { id: true, name: true, color: true, icon: true, type: true } } },
    }),
  ]);

  const goalTarget = goals.reduce((s, g) => s + g.targetAmount.toNumber(), 0);
  const goalSaved = goals.reduce((s, g) => s + g.currentAmount.toNumber(), 0);
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
      completed: goals.filter((g) => g.currentAmount.gte(g.targetAmount)).length,
      totalTarget: round2(goalTarget),
      totalSaved: round2(goalSaved),
      progress: percentage(goalSaved, goalTarget),
    },
    recentTransactions: recent.map(serializeTransaction),
  };
}

/** Income, expenses, savings and budget per month for the last `months` months. */
export async function getMonthly(userId: string, params: Period & { months: number }) {
  const end = resolvePeriod(params);
  const first = shiftMonth(end.year, end.month, -(params.months - 1));
  const startDate = formatDateOnly(monthRange(first.year, first.month).start);
  const endDate = formatDateOnly(monthRange(end.year, end.month).end);

  // Parameterised query — values are bound, never string-interpolated
  const rows = await prisma.$queryRaw<{ month: string; type: TransactionType; total: number }[]>(Prisma.sql`
    SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') AS month,
           "type"::text AS type,
           COALESCE(SUM("amount"), 0)::float8 AS total
    FROM "Transaction"
    WHERE "userId" = ${userId}
      AND "date" >= ${startDate}::date
      AND "date" < ${endDate}::date
    GROUP BY 1, 2
  `);

  const budgets = await prisma.budget.findMany({
    where: {
      userId,
      OR: Array.from({ length: params.months }, (_, i) => shiftMonth(first.year, first.month, i)),
    },
    select: { year: true, month: true, totalAmount: true },
  });

  let cumulative = 0;
  return Array.from({ length: params.months }, (_, i) => {
    const { year, month } = shiftMonth(first.year, first.month, i);
    const key = monthKey(year, month);
    const income = round2(rows.find((r) => r.month === key && r.type === 'INCOME')?.total ?? 0);
    const expense = round2(rows.find((r) => r.month === key && r.type === 'EXPENSE')?.total ?? 0);
    const savings = round2(income - expense);
    cumulative = round2(cumulative + savings);
    const budget = budgets.find((b) => b.year === year && b.month === month)?.totalAmount.toNumber() ?? null;
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
export async function getCategoryBreakdown(
  userId: string,
  params: { type: TransactionType; startDate?: string; endDate?: string },
) {
  const now = currentYearMonth();
  const range = monthRange(now.year, now.month);
  const start = params.startDate ? parseDateOnly(params.startDate) : range.start;
  const endInclusive = params.endDate ? parseDateOnly(params.endDate) : new Date(range.end.getTime() - 86_400_000);

  const groups = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: { userId, type: params.type, date: { gte: start, lte: endInclusive } },
    _sum: { amount: true },
    _count: true,
  });

  const categories = await prisma.category.findMany({
    where: { userId, id: { in: groups.map((g) => g.categoryId) } },
    select: { id: true, name: true, color: true, icon: true },
  });

  const total = groups.reduce((s, g) => s + (g._sum.amount?.toNumber() ?? 0), 0);
  const data = groups
    .map((g) => {
      const category = categories.find((c) => c.id === g.categoryId);
      const amount = round2(g._sum.amount?.toNumber() ?? 0);
      return {
        categoryId: g.categoryId,
        name: category?.name ?? 'Unknown',
        color: category?.color ?? '#64748b',
        icon: category?.icon ?? 'tag',
        total: amount,
        count: g._count,
        percentage: percentage(amount, total),
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    type: params.type,
    startDate: formatDateOnly(start),
    endDate: formatDateOnly(endInclusive),
    total: round2(total),
    data,
  };
}

/** Day-by-day spending for a month, with a running cumulative total. */
export async function getDailyTrend(userId: string, period: Period) {
  const { year, month } = resolvePeriod(period);
  const { start, end } = monthRange(year, month);
  const groups = await prisma.transaction.groupBy({
    by: ['date', 'type'],
    where: { userId, date: { gte: start, lt: end } },
    _sum: { amount: true },
  });

  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  let cumulativeExpense = 0;
  return Array.from({ length: days }, (_, i) => {
    const date = formatDateOnly(new Date(start.getTime() + i * 86_400_000));
    const sumFor = (type: TransactionType) =>
      groups.find((g) => g.type === type && formatDateOnly(g.date) === date)?._sum.amount?.toNumber() ?? 0;
    const expense = round2(sumFor('EXPENSE'));
    cumulativeExpense = round2(cumulativeExpense + expense);
    return { date, day: i + 1, income: round2(sumFor('INCOME')), expense, cumulativeExpense };
  });
}
