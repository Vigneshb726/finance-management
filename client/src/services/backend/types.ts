import type {
  AppNotification,
  AuthResponse,
  BackupFile,
  Budget,
  BudgetInput,
  Category,
  CategoryBreakdown,
  CsvExport,
  DailyPoint,
  ExportFilters,
  Goal,
  GoalInput,
  MonthlyPoint,
  MonthlyReport,
  Paginated,
  RecurringInput,
  RecurringTransaction,
  RestoreResult,
  Summary,
  Transaction,
  TransactionFilters,
  TransactionInput,
  TransactionType,
  User,
} from '../../types';

/**
 * Everything the UI can ask of the data layer. Three implementations:
 * HTTP (browser → Express/PostgreSQL), in-process SQLite (Android/iOS) and
 * IPC to the Electron main process (Windows/macOS/Linux).
 */
export interface FinanceApi {
  auth: {
    login(body: { email: string; password: string }): Promise<AuthResponse>;
    register(body: { name: string; email: string; password: string }): Promise<AuthResponse>;
    logout(): Promise<void>;
    me(): Promise<User>;
    updateProfile(body: Partial<User>): Promise<User>;
    changePassword(body: { currentPassword: string; newPassword: string }): Promise<{ message: string }>;
    deleteAccount(password: string): Promise<unknown>;
  };
  transactions: {
    list(filters: TransactionFilters): Promise<Paginated<Transaction>>;
    create(body: TransactionInput): Promise<Transaction>;
    update(id: string, body: TransactionInput): Promise<Transaction>;
    remove(id: string): Promise<unknown>;
    exportCsv(filters: ExportFilters): Promise<CsvExport>;
  };
  recurring: {
    list(): Promise<RecurringTransaction[]>;
    create(body: RecurringInput): Promise<RecurringTransaction>;
    update(id: string, body: RecurringInput): Promise<RecurringTransaction>;
    remove(id: string): Promise<unknown>;
  };
  categories: {
    list(type?: TransactionType): Promise<Category[]>;
    create(body: Pick<Category, 'name' | 'type' | 'color' | 'icon'>): Promise<Category>;
    update(id: string, body: Partial<Pick<Category, 'name' | 'color' | 'icon'>>): Promise<Category>;
    remove(id: string): Promise<{ reassignedTransactions: number; reassignedTo: string }>;
  };
  budgets: {
    list(params?: { year?: number; month?: number }): Promise<Budget[]>;
    create(body: BudgetInput): Promise<Budget>;
    update(id: string, body: BudgetInput): Promise<Budget>;
    remove(id: string): Promise<unknown>;
  };
  goals: {
    list(): Promise<Goal[]>;
    create(body: GoalInput): Promise<Goal>;
    update(id: string, body: Partial<GoalInput>): Promise<Goal>;
    contribute(id: string, amount: number): Promise<Goal>;
    remove(id: string): Promise<unknown>;
  };
  analytics: {
    summary(params: { year: number; month: number }): Promise<Summary>;
    monthly(params: { year?: number; month?: number; months: number }): Promise<MonthlyPoint[]>;
    categories(params: { type: TransactionType; startDate?: string; endDate?: string }): Promise<CategoryBreakdown>;
    daily(params: { year: number; month: number }): Promise<DailyPoint[]>;
  };
  reports: {
    monthly(params: { year: number; month: number }): Promise<MonthlyReport>;
  };
  notifications: {
    list(): Promise<{ data: AppNotification[]; unreadCount: number }>;
    markRead(id: string): Promise<unknown>;
    markAllRead(): Promise<{ updated: number }>;
    remove(id: string): Promise<unknown>;
  };
  backup: {
    create(): Promise<BackupFile>;
    restore(data: unknown): Promise<RestoreResult>;
  };
}

export type BackendKind = 'web' | 'desktop' | 'mobile';
