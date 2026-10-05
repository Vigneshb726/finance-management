import type { z } from 'zod';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { monthRange } from '../utils/dates';
import type { budgetQuerySchema, budgetSchema } from '../validators/schemas';
import { budgetInclude, withUsage } from './budgetUsage.service';
import { checkBudgetAlerts } from './notification.service';

type BudgetInput = z.infer<typeof budgetSchema>;

async function assertExpenseCategories(userId: string, categoryIds: string[]) {
  if (!categoryIds.length) return;
  const count = await prisma.category.count({
    where: { userId, type: 'EXPENSE', id: { in: categoryIds } },
  });
  if (count !== categoryIds.length) {
    throw AppError.badRequest('Budgets can only include your own expense categories');
  }
}

async function assertMonthAvailable(userId: string, year: number, month: number, excludeId?: string) {
  const clash = await prisma.budget.findFirst({
    where: { userId, year, month, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
  if (clash) throw AppError.conflict('A budget for this month already exists');
}

export async function listBudgets(userId: string, q: z.infer<typeof budgetQuerySchema>) {
  const budgets = await prisma.budget.findMany({
    where: { userId, ...(q.year ? { year: q.year } : {}), ...(q.month ? { month: q.month } : {}) },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: budgetInclude,
  });
  return Promise.all(budgets.map(withUsage));
}

export async function getBudget(userId: string, id: string) {
  const budget = await prisma.budget.findFirst({ where: { id, userId }, include: budgetInclude });
  if (!budget) throw AppError.notFound('Budget');
  return withUsage(budget);
}

export async function createBudget(userId: string, input: BudgetInput) {
  await assertMonthAvailable(userId, input.year, input.month);
  await assertExpenseCategories(userId, input.categories.map((c) => c.categoryId));

  const budget = await prisma.budget.create({
    data: {
      userId,
      month: input.month,
      year: input.year,
      totalAmount: input.totalAmount,
      notes: input.notes,
      categories: { create: input.categories },
    },
    include: budgetInclude,
  });
  await checkBudgetAlerts(userId, monthRange(budget.year, budget.month).start);
  return withUsage(budget);
}

export async function updateBudget(userId: string, id: string, input: BudgetInput) {
  const existing = await prisma.budget.findFirst({ where: { id, userId } });
  if (!existing) throw AppError.notFound('Budget');
  await assertMonthAvailable(userId, input.year, input.month, id);
  await assertExpenseCategories(userId, input.categories.map((c) => c.categoryId));

  const budget = await prisma.$transaction(async (tx) => {
    await tx.budgetCategory.deleteMany({ where: { budgetId: id } });
    return tx.budget.update({
      where: { id },
      data: {
        month: input.month,
        year: input.year,
        totalAmount: input.totalAmount,
        notes: input.notes,
        categories: { create: input.categories },
      },
      include: budgetInclude,
    });
  });
  await checkBudgetAlerts(userId, monthRange(budget.year, budget.month).start);
  return withUsage(budget);
}

export async function deleteBudget(userId: string, id: string) {
  const result = await prisma.budget.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw AppError.notFound('Budget');
}
