/** Domain enums shared by every platform (stored as TEXT in SQLite, as enums in PostgreSQL). */

export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PAYMENT_METHODS = ['CASH', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const NOTIFICATION_TYPES = [
  'BUDGET_EXCEEDED',
  'BUDGET_WARNING',
  'GOAL_MILESTONE',
  'MONTHLY_SUMMARY',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const THEMES = ['LIGHT', 'DARK', 'SYSTEM'] as const;
export type ThemePreference = (typeof THEMES)[number];

export const RECURRENCE_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];
