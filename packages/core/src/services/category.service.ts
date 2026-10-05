import type { Selectable } from 'kysely';
import { inTransaction, type CoreContext } from '../context';
import { DEFAULT_CATEGORIES, FALLBACK_CATEGORY_NAME } from '../defaultCategories';
import { equalsInsensitive } from '../db/helpers';
import { dbBool, type CategoryTable } from '../db/schema';
import { AppError } from '../errors';
import type { TransactionType } from '../types';
import type { CreateCategoryInput, UpdateCategoryInput } from '../validators/schemas';

export const serializeCategory = (c: Selectable<CategoryTable>) => ({ ...c, isDefault: !!c.isDefault });

/** Creates the default income and expense categories for a new account. */
export async function createDefaultCategories(ctx: CoreContext, userId: string) {
  const now = ctx.now().toISOString();
  await ctx.db
    .insertInto('Category')
    .values(
      DEFAULT_CATEGORIES.map((c) => ({
        ...c,
        id: ctx.newId(),
        userId,
        isDefault: dbBool(true),
        createdAt: now,
        updatedAt: now,
      })),
    )
    .execute();
}

export async function listCategories(ctx: CoreContext, userId: string, type?: TransactionType) {
  let query = ctx.db
    .selectFrom('Category as c')
    .selectAll('c')
    .select((eb) =>
      eb
        .selectFrom('Transaction as t')
        .select(eb.fn.countAll<number>().as('n'))
        .whereRef('t.categoryId', '=', 'c.id')
        .as('transactionCount'),
    )
    .where('c.userId', '=', userId);
  if (type) query = query.where('c.type', '=', type);

  const rows = await query
    .orderBy((eb) => eb.case().when('c.type', '=', 'INCOME').then(eb.lit(0)).else(eb.lit(1)).end())
    .orderBy('c.isDefault', 'desc')
    .orderBy('c.name', 'asc')
    .execute();

  return rows.map(({ transactionCount, ...c }) => ({ ...serializeCategory(c), transactionCount: Number(transactionCount ?? 0) }));
}

async function findOwned(ctx: CoreContext, userId: string, id: string) {
  const category = await ctx.db
    .selectFrom('Category')
    .selectAll()
    .where('id', '=', id)
    .where('userId', '=', userId)
    .executeTakeFirst();
  if (!category) throw AppError.notFound('Category');
  return category;
}

export async function createCategory(ctx: CoreContext, userId: string, input: CreateCategoryInput) {
  await assertNameAvailable(ctx, userId, input.type, input.name);
  const now = ctx.now().toISOString();
  const id = ctx.newId();
  await ctx.db
    .insertInto('Category')
    .values({ ...input, id, userId, isDefault: dbBool(false), createdAt: now, updatedAt: now })
    .execute();
  return serializeCategory(await findOwned(ctx, userId, id));
}

export async function updateCategory(ctx: CoreContext, userId: string, id: string, input: UpdateCategoryInput) {
  const category = await findOwned(ctx, userId, id);

  if (input.name && input.name.toLowerCase() !== category.name.toLowerCase()) {
    if (category.isDefault) throw AppError.badRequest('Default categories cannot be renamed');
    await assertNameAvailable(ctx, userId, category.type, input.name, id);
  }
  await ctx.db
    .updateTable('Category')
    .set({ ...input, updatedAt: ctx.now().toISOString() })
    .where('id', '=', id)
    .where('userId', '=', userId)
    .execute();
  return serializeCategory(await findOwned(ctx, userId, id));
}

/** Finds — or recreates — the "Other" category of a type. */
export async function getFallbackCategory(ctx: CoreContext, userId: string, type: TransactionType) {
  const existing = await ctx.db
    .selectFrom('Category')
    .select(['id', 'name'])
    .where('userId', '=', userId)
    .where('type', '=', type)
    .where('name', '=', FALLBACK_CATEGORY_NAME)
    .executeTakeFirst();
  if (existing) return existing;

  const defaults = DEFAULT_CATEGORIES.find((c) => c.name === FALLBACK_CATEGORY_NAME && c.type === type)!;
  const now = ctx.now().toISOString();
  const id = ctx.newId();
  await ctx.db
    .insertInto('Category')
    .values({ ...defaults, id, userId, isDefault: dbBool(true), createdAt: now, updatedAt: now })
    .execute();
  return { id, name: defaults.name };
}

/** Deletes a custom category; its transactions and recurring rules move to "Other" of the same type. */
export async function deleteCategory(ctx: CoreContext, userId: string, id: string) {
  const category = await findOwned(ctx, userId, id);
  if (category.isDefault) throw AppError.badRequest('Default categories cannot be deleted');

  return inTransaction(ctx, async (tx) => {
    const fallback = await getFallbackCategory(tx, userId, category.type);
    const moved = await tx.db
      .updateTable('Transaction')
      .set({ categoryId: fallback.id })
      .where('userId', '=', userId)
      .where('categoryId', '=', id)
      .executeTakeFirst();
    await tx.db
      .updateTable('RecurringTransaction')
      .set({ categoryId: fallback.id })
      .where('userId', '=', userId)
      .where('categoryId', '=', id)
      .execute();
    await tx.db.deleteFrom('Category').where('id', '=', id).where('userId', '=', userId).execute();
    return { reassignedTransactions: Number(moved.numUpdatedRows), reassignedTo: fallback.name };
  });
}

async function assertNameAvailable(
  ctx: CoreContext,
  userId: string,
  type: TransactionType,
  name: string,
  excludeId?: string,
) {
  let query = ctx.db
    .selectFrom('Category')
    .select('id')
    .where('userId', '=', userId)
    .where('type', '=', type)
    .where((eb) => equalsInsensitive(eb.ref('name'), name));
  if (excludeId) query = query.where('id', '!=', excludeId);
  const clash = await query.executeTakeFirst();
  if (clash) throw AppError.conflict(`A ${type.toLowerCase()} category named "${name}" already exists`);
}
