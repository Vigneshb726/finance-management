import type { TransactionType } from '@prisma/client';

export interface DefaultCategory {
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
}

/** Name of the fallback category (per type) that cannot be deleted. */
export const FALLBACK_CATEGORY_NAME = 'Other';

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Food', type: 'EXPENSE', color: '#f97316', icon: 'utensils' },
  { name: 'Transport', type: 'EXPENSE', color: '#0ea5e9', icon: 'car' },
  { name: 'Shopping', type: 'EXPENSE', color: '#ec4899', icon: 'shopping-bag' },
  { name: 'Education', type: 'EXPENSE', color: '#8b5cf6', icon: 'graduation-cap' },
  { name: 'Bills', type: 'EXPENSE', color: '#eab308', icon: 'receipt' },
  { name: 'Entertainment', type: 'EXPENSE', color: '#14b8a6', icon: 'film' },
  { name: 'Health', type: 'EXPENSE', color: '#ef4444', icon: 'heart-pulse' },
  { name: 'Travel', type: 'EXPENSE', color: '#06b6d4', icon: 'plane' },
  { name: 'Rent', type: 'EXPENSE', color: '#6366f1', icon: 'home' },
  { name: 'Other', type: 'EXPENSE', color: '#64748b', icon: 'tag' },
  { name: 'Salary', type: 'INCOME', color: '#10b981', icon: 'briefcase' },
  { name: 'Freelance', type: 'INCOME', color: '#22c55e', icon: 'laptop' },
  { name: 'Investments', type: 'INCOME', color: '#0d9488', icon: 'trending-up' },
  { name: 'Gifts', type: 'INCOME', color: '#f59e0b', icon: 'gift' },
  { name: 'Other', type: 'INCOME', color: '#64748b', icon: 'tag' },
];
