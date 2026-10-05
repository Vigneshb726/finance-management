import type { Selectable } from 'kysely';
import type { CoreContext } from '../context';
import type { BudgetTable } from '../db/schema';
import { calculateBudgetUsage, round2, type BudgetUsage } from '../utils/calculations';
import { monthBounds } from '../utils/dates';
import { fromPaise } from '../utils/money';

export interface BudgetCategoryUsage extends BudgetUsage {
  id: string;
  categoryId: string;
  category: { id: string; name: string; color: string; icon: string };
}

export interface BudgetWithUsage extends BudgetUsage {
  id: string;
  month: number;
  year: number;
  totalAmount: number;
  notes: string | null;
  allocated: number;
  categories: BudgetCategoryUsage[];
  createdAt: string;
  updatedAt: string;
}

export type BudgetRow = Selectable<BudgetTable>;

/** Expense totals per category for a given month (rupees): Map<categoryId, total> and grand total. */
export async function getMonthlyExpenseTotals(ctx: CoreContext, userId: string, year: number, month: number) {
  const { start, end } = monthBounds(year, month);
  const groups = await ctx.db
    .selectFrom('Transaction')
    .select((eb) => ['categoryId', eb.fn.sum<number>('amount').as('total')])
    .where('userId', '=', userId)
    .where('type', '=', 'EXPENSE')
    .where('date', '>=', start)
    .where('date', '<', end)
    .groupBy('categoryId')
    .execute();

  const byCategory = new Map<string, number>();
  let total = 0;
  for (const g of groups) {
    const value = fromPaise(g.total);
    byCategory.set(g.categoryId, value);
    total += value;
  }
  return { byCategory, total: round2(total) };
}

/** Category limits of the given budgets, largest first. */
export async function getBudgetCategoryRows(ctx: CoreContext, budgetIds: string[]) {
  if (!budgetIds.length) return [];
  return ctx.db
    .selectFrom('BudgetCategory as bc')
    .innerJoin('Category as c', 'c.id', 'bc.categoryId')
    .select(['bc.id', 'bc.budgetId', 'bc.categoryId', 'bc.amount', 'c.name', 'c.color', 'c.icon'])
    .where('bc.budgetId', 'in', budgetIds)
    .orderBy('bc.amount', 'desc')
    .orderBy('c.name', 'asc')
    .execute();
}

type BudgetCategoryRow = Awaited<ReturnType<typeof getBudgetCategoryRows>>[number];

/** Budget Remaining = Budget − Expenses; Usage % = Expenses / Budget × 100 */
export async function withUsage(
  ctx: CoreContext,
  budget: BudgetRow,
  categoryRows?: BudgetCategoryRow[],
): Promise<BudgetWithUsage> {
  const rows = categoryRows ?? (await getBudgetCategoryRows(ctx, [budget.id]));
  const { byCategory, total } = await getMonthlyExpenseTotals(ctx, budget.userId, budget.year, budget.month);
  const totalAmount = fromPaise(budget.totalAmount);

  const categories = rows
    .filter((r) => r.budgetId === budget.id)
    .map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      category: { id: r.categoryId, name: r.name, color: r.color, icon: r.icon },
      ...calculateBudgetUsage(fromPaise(r.amount), byCategory.get(r.categoryId) ?? 0),
    }));

  return {
    id: budget.id,
    month: budget.month,
    year: budget.year,
    totalAmount,
    notes: budget.notes,
    allocated: round2(categories.reduce((s, c) => s + c.amount, 0)),
    categories,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
    ...calculateBudgetUsage(totalAmount, total),
  };
}

export async function getBudgetUsageForMonth(ctx: CoreContext, userId: string, year: number, month: number) {
  const budget = await ctx.db
    .selectFrom('Budget')
    .selectAll()
    .where('userId', '=', userId)
    .where('year', '=', year)
    .where('month', '=', month)
    .executeTakeFirst();
  return budget ? withUsage(ctx, budget) : null;
}
