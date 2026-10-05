import type { Budget, BudgetCategory, Category } from '@prisma/client';
import { prisma } from '../config/prisma';
import { calculateBudgetUsage, round2, type BudgetUsage } from '../utils/calculations';
import { monthRange } from '../utils/dates';

type BudgetWithCategories = Budget & { categories: (BudgetCategory & { category: Category })[] };

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
  createdAt: Date;
  updatedAt: Date;
}

export const budgetInclude = {
  categories: { include: { category: true }, orderBy: { amount: 'desc' as const } },
};

/** Expense totals per category for a given month: Map<categoryId, total> and grand total. */
export async function getMonthlyExpenseTotals(userId: string, year: number, month: number) {
  const { start, end } = monthRange(year, month);
  const groups = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: { userId, type: 'EXPENSE', date: { gte: start, lt: end } },
    _sum: { amount: true },
  });
  const byCategory = new Map<string, number>();
  let total = 0;
  for (const g of groups) {
    const value = g._sum.amount?.toNumber() ?? 0;
    byCategory.set(g.categoryId, value);
    total += value;
  }
  return { byCategory, total: round2(total) };
}

/** Budget Remaining = Budget − Expenses; Usage % = Expenses / Budget × 100 */
export async function withUsage(budget: BudgetWithCategories): Promise<BudgetWithUsage> {
  const { byCategory, total } = await getMonthlyExpenseTotals(budget.userId, budget.year, budget.month);
  const totalAmount = budget.totalAmount.toNumber();

  const categories = budget.categories.map((bc) => ({
    id: bc.id,
    categoryId: bc.categoryId,
    category: { id: bc.category.id, name: bc.category.name, color: bc.category.color, icon: bc.category.icon },
    ...calculateBudgetUsage(bc.amount.toNumber(), byCategory.get(bc.categoryId) ?? 0),
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

export async function getBudgetUsageForMonth(userId: string, year: number, month: number) {
  const budget = await prisma.budget.findUnique({
    where: { userId_year_month: { userId, year, month } },
    include: budgetInclude,
  });
  return budget ? withUsage(budget) : null;
}
