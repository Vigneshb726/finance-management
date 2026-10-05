import { inTransaction, type CoreContext } from '../context';
import { AppError } from '../errors';
import { toPaise } from '../utils/money';
import type { BudgetInput, BudgetQuery } from '../validators/schemas';
import { getBudgetCategoryRows, withUsage } from './budgetUsage.service';
import { checkBudgetAlerts } from './notification.service';

async function assertExpenseCategories(ctx: CoreContext, userId: string, categoryIds: string[]) {
  if (!categoryIds.length) return;
  const { count } = await ctx.db
    .selectFrom('Category')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('userId', '=', userId)
    .where('type', '=', 'EXPENSE')
    .where('id', 'in', categoryIds)
    .executeTakeFirstOrThrow();
  if (Number(count) !== categoryIds.length) {
    throw AppError.badRequest('Budgets can only include your own expense categories');
  }
}

async function assertMonthAvailable(ctx: CoreContext, userId: string, year: number, month: number, excludeId?: string) {
  let query = ctx.db
    .selectFrom('Budget')
    .select('id')
    .where('userId', '=', userId)
    .where('year', '=', year)
    .where('month', '=', month);
  if (excludeId) query = query.where('id', '!=', excludeId);
  if (await query.executeTakeFirst()) throw AppError.conflict('A budget for this month already exists');
}

async function findOwned(ctx: CoreContext, userId: string, id: string) {
  const budget = await ctx.db
    .selectFrom('Budget')
    .selectAll()
    .where('id', '=', id)
    .where('userId', '=', userId)
    .executeTakeFirst();
  if (!budget) throw AppError.notFound('Budget');
  return budget;
}

export async function listBudgets(ctx: CoreContext, userId: string, q: BudgetQuery) {
  let query = ctx.db.selectFrom('Budget').selectAll().where('userId', '=', userId);
  if (q.year) query = query.where('year', '=', q.year);
  if (q.month) query = query.where('month', '=', q.month);
  const budgets = await query.orderBy('year', 'desc').orderBy('month', 'desc').execute();

  const categoryRows = await getBudgetCategoryRows(ctx, budgets.map((b) => b.id));
  const result = [];
  for (const budget of budgets) result.push(await withUsage(ctx, budget, categoryRows));
  return result;
}

export async function getBudget(ctx: CoreContext, userId: string, id: string) {
  return withUsage(ctx, await findOwned(ctx, userId, id));
}

async function insertCategoryLimits(ctx: CoreContext, budgetId: string, categories: BudgetInput['categories']) {
  if (!categories.length) return;
  await ctx.db
    .insertInto('BudgetCategory')
    .values(categories.map((c) => ({ id: ctx.newId(), budgetId, categoryId: c.categoryId, amount: toPaise(c.amount) })))
    .execute();
}

export async function createBudget(ctx: CoreContext, userId: string, input: BudgetInput) {
  await assertMonthAvailable(ctx, userId, input.year, input.month);
  await assertExpenseCategories(ctx, userId, input.categories.map((c) => c.categoryId));

  const id = ctx.newId();
  const now = ctx.now().toISOString();
  await inTransaction(ctx, async (tx) => {
    await tx.db
      .insertInto('Budget')
      .values({
        id,
        userId,
        month: input.month,
        year: input.year,
        totalAmount: toPaise(input.totalAmount),
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      })
      .execute();
    await insertCategoryLimits(tx, id, input.categories);
  });
  await checkBudgetAlerts(ctx, userId, input.year, input.month);
  return getBudget(ctx, userId, id);
}

export async function updateBudget(ctx: CoreContext, userId: string, id: string, input: BudgetInput) {
  await findOwned(ctx, userId, id);
  await assertMonthAvailable(ctx, userId, input.year, input.month, id);
  await assertExpenseCategories(ctx, userId, input.categories.map((c) => c.categoryId));

  await inTransaction(ctx, async (tx) => {
    await tx.db.deleteFrom('BudgetCategory').where('budgetId', '=', id).execute();
    await tx.db
      .updateTable('Budget')
      .set({
        month: input.month,
        year: input.year,
        totalAmount: toPaise(input.totalAmount),
        notes: input.notes,
        updatedAt: ctx.now().toISOString(),
      })
      .where('id', '=', id)
      .where('userId', '=', userId)
      .execute();
    await insertCategoryLimits(tx, id, input.categories);
  });
  await checkBudgetAlerts(ctx, userId, input.year, input.month);
  return getBudget(ctx, userId, id);
}

export async function deleteBudget(ctx: CoreContext, userId: string, id: string) {
  const result = await ctx.db.deleteFrom('Budget').where('id', '=', id).where('userId', '=', userId).executeTakeFirst();
  if (Number(result.numDeletedRows) === 0) throw AppError.notFound('Budget');
}
