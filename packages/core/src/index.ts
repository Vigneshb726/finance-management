/**
 * @finora/core — the single implementation of Finora's business logic.
 * Runs on the server (PostgreSQL) and inside the desktop and mobile apps (SQLite).
 */

// Query builder and dialects, re-exported so every package shares one Kysely copy
export {
  Kysely,
  PostgresDialect,
  SqliteDialect,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  CompiledQuery,
  sql,
  type DatabaseConnection,
  type Dialect as KyselyDialect,
  type Driver,
  type QueryResult,
  type TransactionSettings,
} from 'kysely';

export * from './types';
export * from './errors';
export * from './context';
export * from './hashing';
export * from './defaultCategories';

export * from './db/schema';
export * from './db/helpers';
export * from './db/sqliteMigrations';

export * from './utils/calculations';
export * from './utils/dates';
export * from './utils/format';
export * from './utils/money';

export * from './validators/common';
export * from './validators/schemas';

export * as analyticsService from './services/analytics.service';
export * as authService from './services/auth.service';
export * as backupService from './services/backup.service';
export * as budgetService from './services/budget.service';
export * as categoryService from './services/category.service';
export * as csvService from './services/csv.service';
export * as goalService from './services/goal.service';
export * as notificationService from './services/notification.service';
export * as recurringService from './services/recurring.service';
export * as reportService from './services/report.service';
export * as transactionService from './services/transaction.service';

export type { BackupFile } from './services/backup.service';
export type { MonthlyReport } from './services/report.service';
export type { PublicUser } from './services/auth.service';

export * from './api/localApi';
