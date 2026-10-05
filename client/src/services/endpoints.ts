import { api } from './api';
import type {
  AppNotification,
  AuthResponse,
  Budget,
  BudgetInput,
  Category,
  CategoryBreakdown,
  DailyPoint,
  Goal,
  GoalInput,
  MonthlyPoint,
  Paginated,
  Summary,
  Transaction,
  TransactionFilters,
  TransactionInput,
  TransactionType,
  User,
} from '../types';

/** Drops empty values so they are not sent as query params. */
const clean = <T extends object>(params: T) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null));

export const authApi = {
  login: (body: { email: string; password: string }) => api.post<AuthResponse>('/auth/login', body).then((r) => r.data),
  register: (body: { name: string; email: string; password: string }) =>
    api.post<AuthResponse>('/auth/register', body).then((r) => r.data),
  me: () => api.get<{ user: User }>('/auth/me').then((r) => r.data.user),
  updateProfile: (body: Partial<User>) => api.put<{ user: User }>('/auth/profile', body).then((r) => r.data.user),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api.put<{ message: string }>('/auth/password', body).then((r) => r.data),
  deleteAccount: (password: string) => api.delete('/auth/account', { data: { password } }),
};

export const transactionsApi = {
  list: (filters: TransactionFilters) =>
    api.get<Paginated<Transaction>>('/transactions', { params: clean(filters) }).then((r) => r.data),
  create: (body: TransactionInput) => api.post<Transaction>('/transactions', body).then((r) => r.data),
  update: (id: string, body: TransactionInput) => api.put<Transaction>(`/transactions/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/transactions/${id}`),
};

export const categoriesApi = {
  list: (type?: TransactionType) => api.get<Category[]>('/categories', { params: clean({ type }) }).then((r) => r.data),
  create: (body: Pick<Category, 'name' | 'type' | 'color' | 'icon'>) =>
    api.post<Category>('/categories', body).then((r) => r.data),
  update: (id: string, body: Partial<Pick<Category, 'name' | 'color' | 'icon'>>) =>
    api.put<Category>(`/categories/${id}`, body).then((r) => r.data),
  remove: (id: string) =>
    api.delete<{ reassignedTransactions: number; reassignedTo: string }>(`/categories/${id}`).then((r) => r.data),
};

export const budgetsApi = {
  list: (params: { year?: number; month?: number } = {}) =>
    api.get<Budget[]>('/budgets', { params: clean(params) }).then((r) => r.data),
  create: (body: BudgetInput) => api.post<Budget>('/budgets', body).then((r) => r.data),
  update: (id: string, body: BudgetInput) => api.put<Budget>(`/budgets/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/budgets/${id}`),
};

export const goalsApi = {
  list: () => api.get<Goal[]>('/goals').then((r) => r.data),
  create: (body: GoalInput) => api.post<Goal>('/goals', body).then((r) => r.data),
  update: (id: string, body: Partial<GoalInput>) => api.put<Goal>(`/goals/${id}`, body).then((r) => r.data),
  contribute: (id: string, amount: number) => api.post<Goal>(`/goals/${id}/contribute`, { amount }).then((r) => r.data),
  remove: (id: string) => api.delete(`/goals/${id}`),
};

export const analyticsApi = {
  summary: (params: { year: number; month: number }) =>
    api.get<Summary>('/analytics/summary', { params }).then((r) => r.data),
  monthly: (params: { year?: number; month?: number; months: number }) =>
    api.get<MonthlyPoint[]>('/analytics/monthly', { params: clean(params) }).then((r) => r.data),
  categories: (params: { type: TransactionType; startDate?: string; endDate?: string }) =>
    api.get<CategoryBreakdown>('/analytics/categories', { params: clean(params) }).then((r) => r.data),
  daily: (params: { year: number; month: number }) =>
    api.get<DailyPoint[]>('/analytics/daily', { params }).then((r) => r.data),
};

export const notificationsApi = {
  list: () => api.get<{ data: AppNotification[]; unreadCount: number }>('/notifications').then((r) => r.data),
  markRead: (id: string) => api.put<AppNotification>(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.put<{ updated: number }>('/notifications/read-all').then((r) => r.data),
  remove: (id: string) => api.delete(`/notifications/${id}`),
};
