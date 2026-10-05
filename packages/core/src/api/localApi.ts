import type { CoreContext } from '../context';
import { AppError, normalizeError, type ApiErrorBody } from '../errors';
import type { TransactionType } from '../types';
import {
  budgetQuerySchema,
  budgetSchema,
  categoryAnalyticsQuerySchema,
  categoryQuerySchema,
  changePasswordSchema,
  contributeSchema,
  createCategorySchema,
  deleteAccountSchema,
  goalSchema,
  loginSchema,
  monthlyQuerySchema,
  notificationQuerySchema,
  periodQuerySchema,
  recurringSchema,
  registerSchema,
  reportQuerySchema,
  transactionFilterSchema,
  transactionQuerySchema,
  transactionSchema,
  updateCategorySchema,
  updateGoalSchema,
  updateProfileSchema,
} from '../validators/schemas';
import * as analytics from '../services/analytics.service';
import * as auth from '../services/auth.service';
import * as backup from '../services/backup.service';
import * as budgets from '../services/budget.service';
import * as categories from '../services/category.service';
import * as csv from '../services/csv.service';
import * as goals from '../services/goal.service';
import * as notifications from '../services/notification.service';
import * as recurring from '../services/recurring.service';
import * as reports from '../services/report.service';
import * as transactions from '../services/transaction.service';

/** Error thrown by the local API — the same status/body the HTTP API would send. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
  ) {
    super(body.message);
    this.name = 'ApiError';
  }
}

/** Where the signed-in user id is remembered between app launches (secure storage on devices). */
export interface SessionStore {
  get(): Promise<string | null>;
  set(userId: string | null): Promise<void>;
}

/** How often due recurring transactions are generated while the app is open. */
const DUE_TASK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * The finance API running in-process on SQLite — used by the desktop and mobile
 * apps instead of HTTP. Same inputs, outputs and validation as the REST API.
 */
export function createLocalApi(ctx: CoreContext, session: SessionStore, options: { onError?: (err: unknown) => void } = {}) {
  let lastDueRun = { userId: '', at: 0, day: '' };

  /** Runs `fn`, converting any failure into an ApiError with an HTTP-like status. */
  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      const normalized = normalizeError(err);
      if (normalized.unexpected) options.onError?.(err);
      throw new ApiError(normalized.status, normalized.body);
    }
  };

  const currentUser = async (): Promise<string> => {
    const userId = await session.get();
    if (!userId || !(await auth.userExists(ctx, userId))) {
      if (userId) await session.set(null);
      throw AppError.unauthorized('Please sign in to continue');
    }
    return userId;
  };

  /** Generates due recurring transactions at most every 15 minutes (and on a new day). */
  const runDueTasks = async (userId: string) => {
    const now = ctx.now();
    const day = now.toISOString().slice(0, 10);
    if (lastDueRun.userId === userId && lastDueRun.day === day && now.getTime() - lastDueRun.at < DUE_TASK_INTERVAL_MS) return;
    lastDueRun = { userId, at: now.getTime(), day };
    await recurring.processDueRecurring(ctx, userId);
  };

  /** Authenticated call: resolves the user, runs due tasks, then `fn`. */
  const authed = <T>(fn: (userId: string) => Promise<T>) =>
    run(async () => {
      const userId = await currentUser();
      await runDueTasks(userId);
      return fn(userId);
    });

  const signIn = async (user: auth.PublicUser) => {
    await session.set(user.id);
    lastDueRun = { userId: '', at: 0, day: '' };
    await runDueTasks(user.id);
    // No bearer token on devices — the session lives in secure storage
    return { user, token: 'local' };
  };

  return {
    auth: {
      register: (body: unknown) =>
        run(async () => signIn(await auth.register(ctx, registerSchema.parse(body)))),
      login: (body: unknown) =>
        run(async () => {
          const { email, password } = loginSchema.parse(body);
          return signIn(await auth.login(ctx, email, password));
        }),
      logout: () => run(() => session.set(null)),
      me: () => authed((userId) => auth.getMe(ctx, userId)),
      updateProfile: (body: unknown) => authed((userId) => auth.updateProfile(ctx, userId, updateProfileSchema.parse(body))),
      changePassword: (body: unknown) =>
        authed(async (userId) => {
          const input = changePasswordSchema.parse(body);
          await auth.changePassword(ctx, userId, input.currentPassword, input.newPassword);
          return { message: 'Password updated successfully' };
        }),
      deleteAccount: (password: unknown) =>
        authed(async (userId) => {
          await auth.deleteAccount(ctx, userId, deleteAccountSchema.parse({ password }).password);
          await session.set(null);
        }),
    },
    transactions: {
      list: (filters: unknown) => authed((userId) => transactions.listTransactions(ctx, userId, transactionQuerySchema.parse(filters ?? {}))),
      create: (body: unknown) => authed((userId) => transactions.createTransaction(ctx, userId, transactionSchema.parse(body))),
      update: (id: string, body: unknown) =>
        authed((userId) => transactions.updateTransaction(ctx, userId, id, transactionSchema.parse(body))),
      remove: (id: string) => authed((userId) => transactions.deleteTransaction(ctx, userId, id)),
      exportCsv: (filters: unknown) =>
        authed((userId) => csv.exportTransactionsCsv(ctx, userId, transactionFilterSchema.parse(filters ?? {}))),
    },
    recurring: {
      list: () => authed((userId) => recurring.listRecurring(ctx, userId)),
      create: (body: unknown) => authed((userId) => recurring.createRecurring(ctx, userId, recurringSchema.parse(body))),
      update: (id: string, body: unknown) =>
        authed((userId) => recurring.updateRecurring(ctx, userId, id, recurringSchema.parse(body))),
      remove: (id: string) => authed((userId) => recurring.deleteRecurring(ctx, userId, id)),
    },
    categories: {
      list: (type?: TransactionType) =>
        authed((userId) => categories.listCategories(ctx, userId, categoryQuerySchema.parse({ type }).type)),
      create: (body: unknown) => authed((userId) => categories.createCategory(ctx, userId, createCategorySchema.parse(body))),
      update: (id: string, body: unknown) =>
        authed((userId) => categories.updateCategory(ctx, userId, id, updateCategorySchema.parse(body))),
      remove: (id: string) => authed((userId) => categories.deleteCategory(ctx, userId, id)),
    },
    budgets: {
      list: (params: unknown = {}) => authed((userId) => budgets.listBudgets(ctx, userId, budgetQuerySchema.parse(params ?? {}))),
      create: (body: unknown) => authed((userId) => budgets.createBudget(ctx, userId, budgetSchema.parse(body))),
      update: (id: string, body: unknown) => authed((userId) => budgets.updateBudget(ctx, userId, id, budgetSchema.parse(body))),
      remove: (id: string) => authed((userId) => budgets.deleteBudget(ctx, userId, id)),
    },
    goals: {
      list: () => authed((userId) => goals.listGoals(ctx, userId)),
      create: (body: unknown) => authed((userId) => goals.createGoal(ctx, userId, goalSchema.parse(body))),
      update: (id: string, body: unknown) => authed((userId) => goals.updateGoal(ctx, userId, id, updateGoalSchema.parse(body))),
      contribute: (id: string, amount: unknown) =>
        authed((userId) => goals.contributeToGoal(ctx, userId, id, contributeSchema.parse({ amount }).amount)),
      remove: (id: string) => authed((userId) => goals.deleteGoal(ctx, userId, id)),
    },
    analytics: {
      summary: (params: unknown) => authed((userId) => analytics.getSummary(ctx, userId, periodQuerySchema.parse(params ?? {}))),
      monthly: (params: unknown) => authed((userId) => analytics.getMonthly(ctx, userId, monthlyQuerySchema.parse(params ?? {}))),
      categories: (params: unknown) =>
        authed((userId) => analytics.getCategoryBreakdown(ctx, userId, categoryAnalyticsQuerySchema.parse(params ?? {}))),
      daily: (params: unknown) => authed((userId) => analytics.getDailyTrend(ctx, userId, periodQuerySchema.parse(params ?? {}))),
    },
    reports: {
      monthly: (params: unknown) => authed((userId) => reports.getMonthlyReport(ctx, userId, reportQuerySchema.parse(params))),
    },
    notifications: {
      list: () => authed((userId) => notifications.listNotifications(ctx, userId, notificationQuerySchema.parse({}))),
      markRead: (id: string) => authed((userId) => notifications.markRead(ctx, userId, id)),
      markAllRead: () => authed((userId) => notifications.markAllRead(ctx, userId)),
      remove: (id: string) => authed((userId) => notifications.deleteNotification(ctx, userId, id)),
    },
    backup: {
      create: () => authed((userId) => backup.createBackup(ctx, userId)),
      restore: (data: unknown) => authed((userId) => backup.restoreBackup(ctx, userId, data)),
    },
  };
}

export type LocalApi = ReturnType<typeof createLocalApi>;

/** "group.method" names of every LocalApi method — the allow-list for Electron IPC. */
export const LOCAL_API_METHODS = [
  'auth.register', 'auth.login', 'auth.logout', 'auth.me', 'auth.updateProfile', 'auth.changePassword', 'auth.deleteAccount',
  'transactions.list', 'transactions.create', 'transactions.update', 'transactions.remove', 'transactions.exportCsv',
  'recurring.list', 'recurring.create', 'recurring.update', 'recurring.remove',
  'categories.list', 'categories.create', 'categories.update', 'categories.remove',
  'budgets.list', 'budgets.create', 'budgets.update', 'budgets.remove',
  'goals.list', 'goals.create', 'goals.update', 'goals.contribute', 'goals.remove',
  'analytics.summary', 'analytics.monthly', 'analytics.categories', 'analytics.daily',
  'reports.monthly',
  'notifications.list', 'notifications.markRead', 'notifications.markAllRead', 'notifications.remove',
  'backup.create', 'backup.restore',
] as const satisfies readonly {
  [G in keyof LocalApi]: `${G & string}.${keyof LocalApi[G] & string}`;
}[keyof LocalApi][];

export type LocalApiMethod = (typeof LOCAL_API_METHODS)[number];

/** Calls a LocalApi method by its "group.method" name. */
export function invokeLocalApi(api: LocalApi, method: string, args: unknown[]): Promise<unknown> {
  if (!(LOCAL_API_METHODS as readonly string[]).includes(method)) {
    return Promise.reject(new ApiError(404, { message: `Unknown operation ${method}` }));
  }
  const [group, name] = method.split('.') as [keyof LocalApi, string];
  const fn = (api[group] as Record<string, (...a: unknown[]) => Promise<unknown>>)[name];
  return fn(...args);
}
