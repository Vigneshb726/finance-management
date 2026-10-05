import { api } from '../api';
import type { FinanceApi } from './types';

/** Drops empty values so they are not sent as query params. */
const clean = <T extends object>(params: T) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null));

const filenameFrom = (header: unknown, fallback: string) =>
  typeof header === 'string' ? (/filename="([^"]+)"/.exec(header)?.[1] ?? fallback) : fallback;

/** Browser build: talks to the Express API (PostgreSQL) over HTTPS. */
export const httpApi: FinanceApi = {
  auth: {
    login: (body) => api.post('/auth/login', body).then((r) => r.data),
    register: (body) => api.post('/auth/register', body).then((r) => r.data),
    logout: async () => undefined, // JWTs are stateless; the token is dropped client-side
    me: () => api.get('/auth/me').then((r) => r.data.user),
    updateProfile: (body) => api.put('/auth/profile', body).then((r) => r.data.user),
    changePassword: (body) => api.put('/auth/password', body).then((r) => r.data),
    deleteAccount: (password) => api.delete('/auth/account', { data: { password } }),
  },
  transactions: {
    list: (filters) => api.get('/transactions', { params: clean(filters) }).then((r) => r.data),
    create: (body) => api.post('/transactions', body).then((r) => r.data),
    update: (id, body) => api.put(`/transactions/${id}`, body).then((r) => r.data),
    remove: (id) => api.delete(`/transactions/${id}`),
    exportCsv: (filters) =>
      api
        .get<string>('/transactions/export', { params: clean(filters), responseType: 'text', timeout: 60_000 })
        .then((r) => ({
          filename: filenameFrom(r.headers['content-disposition'], 'finora-transactions.csv'),
          content: r.data,
        })),
  },
  recurring: {
    list: () => api.get('/recurring').then((r) => r.data),
    create: (body) => api.post('/recurring', body).then((r) => r.data),
    update: (id, body) => api.put(`/recurring/${id}`, body).then((r) => r.data),
    remove: (id) => api.delete(`/recurring/${id}`),
  },
  categories: {
    list: (type) => api.get('/categories', { params: clean({ type }) }).then((r) => r.data),
    create: (body) => api.post('/categories', body).then((r) => r.data),
    update: (id, body) => api.put(`/categories/${id}`, body).then((r) => r.data),
    remove: (id) => api.delete(`/categories/${id}`).then((r) => r.data),
  },
  budgets: {
    list: (params = {}) => api.get('/budgets', { params: clean(params) }).then((r) => r.data),
    create: (body) => api.post('/budgets', body).then((r) => r.data),
    update: (id, body) => api.put(`/budgets/${id}`, body).then((r) => r.data),
    remove: (id) => api.delete(`/budgets/${id}`),
  },
  goals: {
    list: () => api.get('/goals').then((r) => r.data),
    create: (body) => api.post('/goals', body).then((r) => r.data),
    update: (id, body) => api.put(`/goals/${id}`, body).then((r) => r.data),
    contribute: (id, amount) => api.post(`/goals/${id}/contribute`, { amount }).then((r) => r.data),
    remove: (id) => api.delete(`/goals/${id}`),
  },
  analytics: {
    summary: (params) => api.get('/analytics/summary', { params }).then((r) => r.data),
    monthly: (params) => api.get('/analytics/monthly', { params: clean(params) }).then((r) => r.data),
    categories: (params) => api.get('/analytics/categories', { params: clean(params) }).then((r) => r.data),
    daily: (params) => api.get('/analytics/daily', { params }).then((r) => r.data),
  },
  reports: {
    monthly: (params) => api.get('/reports/monthly', { params }).then((r) => r.data),
  },
  notifications: {
    list: () => api.get('/notifications').then((r) => r.data),
    markRead: (id) => api.put(`/notifications/${id}/read`).then((r) => r.data),
    markAllRead: () => api.put('/notifications/read-all').then((r) => r.data),
    remove: (id) => api.delete(`/notifications/${id}`),
  },
  backup: {
    create: () => api.get('/backup', { timeout: 120_000 }).then((r) => r.data),
    restore: (data) => api.post('/backup/restore', data, { timeout: 120_000 }).then((r) => r.data),
  },
};
