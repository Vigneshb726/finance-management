import { sql, type Kysely } from 'kysely';
import type { Database } from './schema';

/**
 * SQLite schema for the offline desktop and mobile apps. It mirrors the PostgreSQL
 * schema managed by Prisma Migrate in server/prisma (same tables and columns —
 * enforced by the schema tests). Append new migrations; never edit applied ones.
 */
export interface SqliteMigration {
  id: string;
  statements: string[];
}

export const SQLITE_MIGRATIONS: SqliteMigration[] = [
  {
    id: '0001_init',
    statements: [
      `CREATE TABLE "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "currency" TEXT NOT NULL DEFAULT 'INR',
        "theme" TEXT NOT NULL DEFAULT 'SYSTEM' CHECK ("theme" IN ('LIGHT', 'DARK', 'SYSTEM')),
        "notifyBudgetAlerts" INTEGER NOT NULL DEFAULT 1,
        "notifyGoalMilestones" INTEGER NOT NULL DEFAULT 1,
        "notifyMonthlySummary" INTEGER NOT NULL DEFAULT 1,
        "createdAt" TEXT NOT NULL,
        "updatedAt" TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX "User_email_key" ON "User"("email")`,

      `CREATE TABLE "Category" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL DEFAULT 'EXPENSE' CHECK ("type" IN ('INCOME', 'EXPENSE')),
        "color" TEXT NOT NULL DEFAULT '#64748b',
        "icon" TEXT NOT NULL DEFAULT 'tag',
        "isDefault" INTEGER NOT NULL DEFAULT 0,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "createdAt" TEXT NOT NULL,
        "updatedAt" TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX "Category_userId_type_name_key" ON "Category"("userId", "type", "name")`,
      `CREATE INDEX "Category_userId_type_idx" ON "Category"("userId", "type")`,

      `CREATE TABLE "RecurringTransaction" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "type" TEXT NOT NULL CHECK ("type" IN ('INCOME', 'EXPENSE')),
        "amount" INTEGER NOT NULL,
        "description" TEXT NOT NULL,
        "categoryId" TEXT NOT NULL REFERENCES "Category"("id") ON DELETE NO ACTION,
        "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
        "notes" TEXT,
        "frequency" TEXT NOT NULL CHECK ("frequency" IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
        "interval" INTEGER NOT NULL DEFAULT 1,
        "startDate" TEXT NOT NULL,
        "endDate" TEXT,
        "nextDate" TEXT,
        "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
        "isActive" INTEGER NOT NULL DEFAULT 1,
        "createdAt" TEXT NOT NULL,
        "updatedAt" TEXT NOT NULL
      )`,
      `CREATE INDEX "RecurringTransaction_userId_isActive_nextDate_idx" ON "RecurringTransaction"("userId", "isActive", "nextDate")`,
      `CREATE INDEX "RecurringTransaction_categoryId_idx" ON "RecurringTransaction"("categoryId")`,

      `CREATE TABLE "Transaction" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "type" TEXT NOT NULL CHECK ("type" IN ('INCOME', 'EXPENSE')),
        "amount" INTEGER NOT NULL,
        "description" TEXT NOT NULL,
        "date" TEXT NOT NULL,
        "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
        "notes" TEXT,
        "categoryId" TEXT NOT NULL REFERENCES "Category"("id") ON DELETE NO ACTION,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "recurringId" TEXT REFERENCES "RecurringTransaction"("id") ON DELETE SET NULL,
        "createdAt" TEXT NOT NULL,
        "updatedAt" TEXT NOT NULL
      )`,
      `CREATE INDEX "Transaction_userId_date_idx" ON "Transaction"("userId", "date" DESC)`,
      `CREATE INDEX "Transaction_userId_type_date_idx" ON "Transaction"("userId", "type", "date")`,
      `CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId")`,
      `CREATE UNIQUE INDEX "Transaction_recurringId_date_key" ON "Transaction"("recurringId", "date")`,

      `CREATE TABLE "Budget" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "month" INTEGER NOT NULL,
        "year" INTEGER NOT NULL,
        "totalAmount" INTEGER NOT NULL,
        "notes" TEXT,
        "createdAt" TEXT NOT NULL,
        "updatedAt" TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX "Budget_userId_year_month_key" ON "Budget"("userId", "year", "month")`,

      `CREATE TABLE "BudgetCategory" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "budgetId" TEXT NOT NULL REFERENCES "Budget"("id") ON DELETE CASCADE,
        "categoryId" TEXT NOT NULL REFERENCES "Category"("id") ON DELETE CASCADE,
        "amount" INTEGER NOT NULL
      )`,
      `CREATE UNIQUE INDEX "BudgetCategory_budgetId_categoryId_key" ON "BudgetCategory"("budgetId", "categoryId")`,
      `CREATE INDEX "BudgetCategory_categoryId_idx" ON "BudgetCategory"("categoryId")`,

      `CREATE TABLE "FinancialGoal" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "name" TEXT NOT NULL,
        "targetAmount" INTEGER NOT NULL,
        "currentAmount" INTEGER NOT NULL DEFAULT 0,
        "targetDate" TEXT,
        "description" TEXT,
        "color" TEXT NOT NULL DEFAULT '#4f46e5',
        "createdAt" TEXT NOT NULL,
        "updatedAt" TEXT NOT NULL
      )`,
      `CREATE INDEX "FinancialGoal_userId_idx" ON "FinancialGoal"("userId")`,

      `CREATE TABLE "Notification" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "type" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "isRead" INTEGER NOT NULL DEFAULT 0,
        "dedupeKey" TEXT,
        "createdAt" TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey")`,
      `CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt" DESC)`,
    ],
  },
];

/** Latest schema version this build understands (stored in backups). */
export const SCHEMA_VERSION = SQLITE_MIGRATIONS.length;

/**
 * Applies pending SQLite migrations, each in its own transaction.
 * Returns the ids that were applied. Callers should back up the database file
 * first when `pendingSqliteMigrations()` is non-empty.
 */
export async function migrateSqlite(db: Kysely<Database>): Promise<string[]> {
  const pending = await pendingSqliteMigrations(db);
  for (const migration of pending) {
    await db.transaction().execute(async (trx) => {
      for (const statement of migration.statements) await sql.raw(statement).execute(trx);
      await sql`INSERT INTO "_migrations" ("id", "appliedAt") VALUES (${migration.id}, ${new Date().toISOString()})`.execute(trx);
    });
  }
  return pending.map((m) => m.id);
}

export async function pendingSqliteMigrations(db: Kysely<Database>): Promise<SqliteMigration[]> {
  await sql`CREATE TABLE IF NOT EXISTS "_migrations" ("id" TEXT NOT NULL PRIMARY KEY, "appliedAt" TEXT NOT NULL)`.execute(db);
  const applied = await sql<{ id: string }>`SELECT "id" FROM "_migrations"`.execute(db);
  const done = new Set(applied.rows.map((r) => r.id));
  const unknown = [...done].filter((id) => !SQLITE_MIGRATIONS.some((m) => m.id === id));
  if (unknown.length) {
    throw new Error(`This database was created by a newer version of the app (${unknown.join(', ')}). Please update the app.`);
  }
  return SQLITE_MIGRATIONS.filter((m) => !done.has(m.id));
}
