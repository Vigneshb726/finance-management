import { errorStatus, notifyUnauthorized } from './api';
import { backend, isOfflineApp, type FinanceApi } from './backend';

/**
 * Typed entry points used by hooks and pages. Each call is forwarded to the
 * active data layer (HTTP, desktop IPC or on-device SQLite), chosen at start-up.
 */
function delegate<G extends keyof FinanceApi>(group: G): FinanceApi[G] {
  return new Proxy({} as FinanceApi[G], {
    get: (_target, method) =>
      async (...args: unknown[]) => {
        const fn = (backend()[group] as Record<string, (...a: unknown[]) => Promise<unknown>>)[String(method)];
        try {
          return await fn(...args);
        } catch (error) {
          // The HTTP client handles its own 401s; offline sessions end the same way
          const signingIn = group === 'auth' && (method === 'login' || method === 'register');
          if (isOfflineApp() && !signingIn && errorStatus(error) === 401) notifyUnauthorized();
          throw error;
        }
      },
  });
}

export const authApi = delegate('auth');
export const transactionsApi = delegate('transactions');
export const recurringApi = delegate('recurring');
export const categoriesApi = delegate('categories');
export const budgetsApi = delegate('budgets');
export const goalsApi = delegate('goals');
export const analyticsApi = delegate('analytics');
export const reportsApi = delegate('reports');
export const notificationsApi = delegate('notifications');
export const backupApi = delegate('backup');
