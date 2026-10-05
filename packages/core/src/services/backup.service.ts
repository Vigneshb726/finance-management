import { z } from 'zod';
import { inTransaction, type CoreContext } from '../context';
import { dbBool } from '../db/schema';
import { SCHEMA_VERSION } from '../db/sqliteMigrations';
import { AppError } from '../errors';
import {
  NOTIFICATION_TYPES,
  PAYMENT_METHODS,
  RECURRENCE_FREQUENCIES,
  THEMES,
  TRANSACTION_TYPES,
} from '../types';
import { dateString, hexColor } from '../validators/common';
import { SUPPORTED_CURRENCIES } from '../validators/schemas';
import { getFallbackCategory } from './category.service';

/**
 * Portable backup: one JSON document with all of a user's data. The same file
 * restores into the web app, the desktop app or the mobile app. Amounts are
 * integer paise. Ids are remapped on restore, so a backup can be restored into
 * any account without clashing with existing records.
 */
export const BACKUP_FORMAT = 1;

const id = z.string().min(1).max(64);
const paise = z.number().int().min(0).max(99_999_999_999_999);
const positivePaise = paise.refine((v) => v > 0, 'Amount must be greater than 0');
const timestamp = z.string().min(10).max(40);
const text = (max: number) => z.string().max(max);

const backupSchema = z.object({
  app: z.literal('finora'),
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int().min(1),
  exportedAt: timestamp,
  amountsIn: z.literal('paise'),
  profile: z.object({
    name: text(80),
    currency: z.enum(SUPPORTED_CURRENCIES),
    theme: z.enum(THEMES),
    notifyBudgetAlerts: z.boolean(),
    notifyGoalMilestones: z.boolean(),
    notifyMonthlySummary: z.boolean(),
  }),
  categories: z
    .array(
      z.object({
        id,
        name: text(40).min(1),
        type: z.enum(TRANSACTION_TYPES),
        color: hexColor,
        icon: text(40).min(1),
        isDefault: z.boolean(),
      }),
    )
    .max(1000),
  transactions: z
    .array(
      z.object({
        id,
        type: z.enum(TRANSACTION_TYPES),
        amount: positivePaise,
        description: text(200).min(1),
        date: dateString,
        paymentMethod: z.enum(PAYMENT_METHODS),
        notes: text(1000).nullable(),
        categoryId: id,
        recurringId: id.nullable(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    )
    .max(200_000),
  recurring: z
    .array(
      z.object({
        id,
        type: z.enum(TRANSACTION_TYPES),
        amount: positivePaise,
        description: text(200).min(1),
        categoryId: id,
        paymentMethod: z.enum(PAYMENT_METHODS),
        notes: text(1000).nullable(),
        frequency: z.enum(RECURRENCE_FREQUENCIES),
        interval: z.number().int().min(1).max(365),
        startDate: dateString,
        endDate: dateString.nullable(),
        nextDate: dateString.nullable(),
        occurrenceCount: z.number().int().min(0),
        isActive: z.boolean(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    )
    .max(1000),
  budgets: z
    .array(
      z.object({
        id,
        month: z.number().int().min(1).max(12),
        year: z.number().int().min(2000).max(2100),
        totalAmount: positivePaise,
        notes: text(500).nullable(),
        createdAt: timestamp,
        updatedAt: timestamp,
        categories: z.array(z.object({ categoryId: id, amount: positivePaise })).max(50),
      }),
    )
    .max(1200),
  goals: z
    .array(
      z.object({
        id,
        name: text(80).min(1),
        targetAmount: positivePaise,
        currentAmount: paise,
        targetDate: dateString.nullable(),
        description: text(500).nullable(),
        color: hexColor,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    )
    .max(1000),
  notifications: z
    .array(
      z.object({
        type: z.enum(NOTIFICATION_TYPES),
        title: text(200),
        message: text(1000),
        isRead: z.boolean(),
        dedupeKey: text(200).nullable(),
        createdAt: timestamp,
      }),
    )
    .max(5000),
});

export type BackupFile = z.infer<typeof backupSchema>;

export async function createBackup(ctx: CoreContext, userId: string): Promise<BackupFile> {
  const db = ctx.db;
  const [user, categories, transactions, recurring, budgets, budgetCategories, goals, notifications] = await Promise.all([
    db.selectFrom('User').selectAll().where('id', '=', userId).executeTakeFirst(),
    db.selectFrom('Category').select(['id', 'name', 'type', 'color', 'icon', 'isDefault']).where('userId', '=', userId).execute(),
    db
      .selectFrom('Transaction')
      .select(['id', 'type', 'amount', 'description', 'date', 'paymentMethod', 'notes', 'categoryId', 'recurringId', 'createdAt', 'updatedAt'])
      .where('userId', '=', userId)
      .orderBy('date')
      .orderBy('createdAt')
      .execute(),
    db.selectFrom('RecurringTransaction').selectAll().where('userId', '=', userId).execute(),
    db.selectFrom('Budget').selectAll().where('userId', '=', userId).orderBy('year').orderBy('month').execute(),
    db
      .selectFrom('BudgetCategory as bc')
      .innerJoin('Budget as b', 'b.id', 'bc.budgetId')
      .select(['bc.budgetId', 'bc.categoryId', 'bc.amount'])
      .where('b.userId', '=', userId)
      .execute(),
    db.selectFrom('FinancialGoal').selectAll().where('userId', '=', userId).execute(),
    db
      .selectFrom('Notification')
      .select(['type', 'title', 'message', 'isRead', 'dedupeKey', 'createdAt'])
      .where('userId', '=', userId)
      .orderBy('createdAt')
      .execute(),
  ]);
  if (!user) throw AppError.notFound('User');

  return {
    app: 'finora',
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: ctx.now().toISOString(),
    amountsIn: 'paise',
    profile: {
      name: user.name,
      currency: user.currency as BackupFile['profile']['currency'],
      theme: user.theme,
      notifyBudgetAlerts: !!user.notifyBudgetAlerts,
      notifyGoalMilestones: !!user.notifyGoalMilestones,
      notifyMonthlySummary: !!user.notifyMonthlySummary,
    },
    categories: categories.map((c) => ({ ...c, isDefault: !!c.isDefault })),
    transactions: transactions.map((t) => ({ ...t, amount: Number(t.amount) })),
    recurring: recurring.map((r) => ({
      id: r.id,
      type: r.type,
      amount: Number(r.amount),
      description: r.description,
      categoryId: r.categoryId,
      paymentMethod: r.paymentMethod,
      notes: r.notes,
      frequency: r.frequency,
      interval: r.interval,
      startDate: r.startDate,
      endDate: r.endDate,
      nextDate: r.nextDate,
      occurrenceCount: r.occurrenceCount,
      isActive: !!r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    budgets: budgets.map((b) => ({
      id: b.id,
      month: b.month,
      year: b.year,
      totalAmount: Number(b.totalAmount),
      notes: b.notes,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      categories: budgetCategories
        .filter((bc) => bc.budgetId === b.id)
        .map((bc) => ({ categoryId: bc.categoryId, amount: Number(bc.amount) })),
    })),
    goals: goals.map((g) => ({
      id: g.id,
      name: g.name,
      targetAmount: Number(g.targetAmount),
      currentAmount: Number(g.currentAmount),
      targetDate: g.targetDate,
      description: g.description,
      color: g.color,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    })),
    notifications: notifications.map((n) => ({ ...n, isRead: !!n.isRead })),
  };
}

/** Parses and checks a backup document, including references between records. */
export function parseBackup(data: unknown): BackupFile {
  const result = backupSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw AppError.badRequest(
      `This is not a valid Finora backup file${issue ? ` (${issue.path.join('.') || 'file'}: ${issue.message})` : ''}`,
    );
  }
  const backup = result.data;
  if (backup.schemaVersion > SCHEMA_VERSION) {
    throw AppError.badRequest('This backup was made by a newer version of Finora. Please update the app first.');
  }

  const categoryType = new Map(backup.categories.map((c) => [c.id, c.type]));
  const names = new Set<string>();
  for (const c of backup.categories) {
    const key = `${c.type}:${c.name.toLowerCase()}`;
    if (names.has(key)) throw AppError.badRequest(`Backup contains the category "${c.name}" twice`);
    names.add(key);
  }
  const recurringIds = new Set(backup.recurring.map((r) => r.id));
  const checkCategory = (categoryId: string, type: string, what: string) => {
    if (categoryType.get(categoryId) !== type) throw AppError.badRequest(`Backup is inconsistent: ${what} has an unknown category`);
  };
  for (const t of backup.transactions) {
    checkCategory(t.categoryId, t.type, `transaction "${t.description}"`);
    if (t.recurringId && !recurringIds.has(t.recurringId)) {
      throw AppError.badRequest(`Backup is inconsistent: transaction "${t.description}" refers to a missing recurring rule`);
    }
  }
  for (const r of backup.recurring) checkCategory(r.categoryId, r.type, `recurring "${r.description}"`);
  for (const b of backup.budgets) {
    for (const bc of b.categories) checkCategory(bc.categoryId, 'EXPENSE', `budget ${b.month}/${b.year}`);
  }
  return backup;
}

const CHUNK = 50;
async function insertChunked<T>(items: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += CHUNK) await insert(items.slice(i, i + CHUNK));
}

/**
 * Replaces ALL of the user's data with the backup's contents (profile settings
 * included; name, email and password are kept). Runs in one transaction.
 */
export async function restoreBackup(ctx: CoreContext, userId: string, data: unknown) {
  const backup = parseBackup(data);

  return inTransaction(ctx, async (tx) => {
    const db = tx.db;
    const ids = new Map<string, string>();
    const map = (old: string) => {
      let next = ids.get(old);
      if (!next) {
        next = tx.newId();
        ids.set(old, next);
      }
      return next;
    };
    const now = tx.now().toISOString();

    // Clear existing data (children first)
    await db.deleteFrom('Notification').where('userId', '=', userId).execute();
    await db.deleteFrom('Transaction').where('userId', '=', userId).execute();
    await db.deleteFrom('RecurringTransaction').where('userId', '=', userId).execute();
    await db.deleteFrom('Budget').where('userId', '=', userId).execute();
    await db.deleteFrom('FinancialGoal').where('userId', '=', userId).execute();
    await db.deleteFrom('Category').where('userId', '=', userId).execute();

    await db
      .updateTable('User')
      .set({
        currency: backup.profile.currency,
        theme: backup.profile.theme,
        notifyBudgetAlerts: dbBool(backup.profile.notifyBudgetAlerts),
        notifyGoalMilestones: dbBool(backup.profile.notifyGoalMilestones),
        notifyMonthlySummary: dbBool(backup.profile.notifyMonthlySummary),
        updatedAt: now,
      })
      .where('id', '=', userId)
      .execute();

    await insertChunked(backup.categories, (chunk) =>
      db
        .insertInto('Category')
        .values(chunk.map((c) => ({ ...c, id: map(c.id), userId, isDefault: dbBool(c.isDefault), createdAt: now, updatedAt: now })))
        .execute(),
    );
    // Restored data must always include the "Other" fallback categories
    await getFallbackCategory(tx, userId, 'EXPENSE');
    await getFallbackCategory(tx, userId, 'INCOME');

    await insertChunked(backup.recurring, (chunk) =>
      db
        .insertInto('RecurringTransaction')
        .values(
          chunk.map((r) => ({
            ...r,
            id: map(r.id),
            userId,
            categoryId: map(r.categoryId),
            isActive: dbBool(r.isActive),
          })),
        )
        .execute(),
    );

    await insertChunked(backup.transactions, (chunk) =>
      db
        .insertInto('Transaction')
        .values(
          chunk.map((t) => ({
            ...t,
            id: map(t.id),
            userId,
            categoryId: map(t.categoryId),
            recurringId: t.recurringId ? map(t.recurringId) : null,
          })),
        )
        .execute(),
    );

    for (const b of backup.budgets) {
      const budgetId = map(b.id);
      await db
        .insertInto('Budget')
        .values({
          id: budgetId,
          userId,
          month: b.month,
          year: b.year,
          totalAmount: b.totalAmount,
          notes: b.notes,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        })
        .execute();
      if (b.categories.length) {
        await db
          .insertInto('BudgetCategory')
          .values(b.categories.map((bc) => ({ id: tx.newId(), budgetId, categoryId: map(bc.categoryId), amount: bc.amount })))
          .execute();
      }
    }

    await insertChunked(backup.goals, (chunk) =>
      db
        .insertInto('FinancialGoal')
        .values(chunk.map((g) => ({ ...g, id: map(g.id), userId })))
        .execute(),
    );

    // Dedupe keys embed record ids ("budget:<id>:<categoryId>:warning") — remap them too
    const remapKey = (key: string | null) =>
      key
        ? key
            .split(':')
            .map((part) => ids.get(part) ?? part)
            .join(':')
        : null;
    await insertChunked(backup.notifications, (chunk) =>
      db
        .insertInto('Notification')
        .values(
          chunk.map((n) => ({
            ...n,
            id: tx.newId(),
            userId,
            isRead: dbBool(n.isRead),
            dedupeKey: remapKey(n.dedupeKey),
          })),
        )
        .onConflict((oc) => oc.columns(['userId', 'dedupeKey']).doNothing())
        .execute(),
    );

    return {
      categories: backup.categories.length,
      transactions: backup.transactions.length,
      recurring: backup.recurring.length,
      budgets: backup.budgets.length,
      goals: backup.goals.length,
      notifications: backup.notifications.length,
    };
  });
}
