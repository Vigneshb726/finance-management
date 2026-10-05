import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '../services/api';
import {
  analyticsApi,
  budgetsApi,
  categoriesApi,
  goalsApi,
  notificationsApi,
  transactionsApi,
} from '../services/endpoints';
import type { BudgetInput, Category, GoalInput, TransactionFilters, TransactionInput, TransactionType } from '../types';

export const keys = {
  transactions: ['transactions'] as const,
  categories: ['categories'] as const,
  budgets: ['budgets'] as const,
  goals: ['goals'] as const,
  analytics: ['analytics'] as const,
  notifications: ['notifications'] as const,
};

/**
 * Any change to money data invalidates every derived view so the dashboard,
 * budgets and analytics recalculate immediately from the API.
 */
function useInvalidateFinance() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.transactions }),
      qc.invalidateQueries({ queryKey: keys.budgets }),
      qc.invalidateQueries({ queryKey: keys.analytics }),
      qc.invalidateQueries({ queryKey: keys.notifications }),
      qc.invalidateQueries({ queryKey: keys.categories }),
      qc.invalidateQueries({ queryKey: keys.goals }),
    ]);
}

const onError = (fallback: string) => (err: unknown) => toast.error(getErrorMessage(err, fallback));

// ---------- Transactions ----------
export const useTransactions = (filters: TransactionFilters) =>
  useQuery({
    queryKey: [...keys.transactions, filters],
    queryFn: () => transactionsApi.list(filters),
    placeholderData: keepPreviousData,
  });

export function useSaveTransaction() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: TransactionInput }) =>
      id ? transactionsApi.update(id, data) : transactionsApi.create(data),
    onSuccess: (_d, vars) => {
      toast.success(vars.id ? 'Transaction updated' : 'Transaction added');
      return invalidate();
    },
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: transactionsApi.remove,
    onSuccess: () => {
      toast.success('Transaction deleted');
      return invalidate();
    },
    onError: onError('Could not delete transaction'),
  });
}

// ---------- Categories ----------
export const useCategories = (type?: TransactionType) =>
  useQuery({
    queryKey: [...keys.categories, type ?? 'all'],
    queryFn: () => categoriesApi.list(type),
    staleTime: 60_000,
  });

export function useSaveCategory() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Pick<Category, 'name' | 'type' | 'color' | 'icon'> }) =>
      id ? categoriesApi.update(id, { name: data.name, color: data.color, icon: data.icon }) : categoriesApi.create(data),
    onSuccess: (_d, vars) => {
      toast.success(vars.id ? 'Category updated' : 'Category created');
      return invalidate();
    },
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: categoriesApi.remove,
    onSuccess: (res) => {
      toast.success(
        res.reassignedTransactions
          ? `Category deleted · ${res.reassignedTransactions} transaction(s) moved to "${res.reassignedTo}"`
          : 'Category deleted',
      );
      return invalidate();
    },
    onError: onError('Could not delete category'),
  });
}

// ---------- Budgets ----------
export const useBudgets = (params: { year?: number; month?: number } = {}) =>
  useQuery({ queryKey: [...keys.budgets, params], queryFn: () => budgetsApi.list(params) });

export function useSaveBudget() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: BudgetInput }) =>
      id ? budgetsApi.update(id, data) : budgetsApi.create(data),
    onSuccess: (_d, vars) => {
      toast.success(vars.id ? 'Budget updated' : 'Budget created');
      return invalidate();
    },
  });
}

export function useDeleteBudget() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: budgetsApi.remove,
    onSuccess: () => {
      toast.success('Budget deleted');
      return invalidate();
    },
    onError: onError('Could not delete budget'),
  });
}

// ---------- Goals ----------
export const useGoals = () => useQuery({ queryKey: keys.goals, queryFn: goalsApi.list });

export function useSaveGoal() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: GoalInput }) => (id ? goalsApi.update(id, data) : goalsApi.create(data)),
    onSuccess: (_d, vars) => {
      toast.success(vars.id ? 'Goal updated' : 'Goal created');
      return invalidate();
    },
  });
}

export function useContributeGoal() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => goalsApi.contribute(id, amount),
    onSuccess: (goal, vars) => {
      toast.success(vars.amount > 0 ? `Added to "${goal.name}"` : `Withdrawn from "${goal.name}"`);
      return invalidate();
    },
  });
}

export function useDeleteGoal() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: goalsApi.remove,
    onSuccess: () => {
      toast.success('Goal deleted');
      return invalidate();
    },
    onError: onError('Could not delete goal'),
  });
}

// ---------- Analytics ----------
export const useSummary = (period: { year: number; month: number }) =>
  useQuery({
    queryKey: [...keys.analytics, 'summary', period],
    queryFn: () => analyticsApi.summary(period),
    placeholderData: keepPreviousData,
  });

export const useMonthly = (params: { year?: number; month?: number; months: number }) =>
  useQuery({
    queryKey: [...keys.analytics, 'monthly', params],
    queryFn: () => analyticsApi.monthly(params),
    placeholderData: keepPreviousData,
  });

export const useCategoryBreakdown = (params: { type: TransactionType; startDate?: string; endDate?: string }) =>
  useQuery({
    queryKey: [...keys.analytics, 'categories', params],
    queryFn: () => analyticsApi.categories(params),
    placeholderData: keepPreviousData,
  });

export const useDaily = (period: { year: number; month: number }) =>
  useQuery({
    queryKey: [...keys.analytics, 'daily', period],
    queryFn: () => analyticsApi.daily(period),
    placeholderData: keepPreviousData,
  });

// ---------- Notifications ----------
export const useNotifications = () =>
  useQuery({ queryKey: keys.notifications, queryFn: notificationsApi.list, refetchInterval: 60_000 });

export function useNotificationActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: keys.notifications });
  return {
    markRead: useMutation({ mutationFn: notificationsApi.markRead, onSuccess: refresh }),
    markAllRead: useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: refresh }),
    remove: useMutation({ mutationFn: notificationsApi.remove, onSuccess: refresh }),
  };
}
