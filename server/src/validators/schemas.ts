import { z } from 'zod';
import {
  dateString,
  hexColor,
  money,
  monthSchema,
  nonNegativeMoney,
  optionalText,
  paymentMethod,
  transactionType,
  yearSchema,
} from './common';

// ---------- Auth ----------
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
const name = z.string().trim().min(2, 'Name must be at least 2 characters').max(80);

export const registerSchema = z.object({ name, email, password });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(128),
});

export const SUPPORTED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED'] as const;

export const updateProfileSchema = z
  .object({
    name,
    email,
    currency: z.enum(SUPPORTED_CURRENCIES),
    theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']),
    notifyBudgetAlerts: z.boolean(),
    notifyGoalMilestones: z.boolean(),
    notifyMonthlySummary: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Current password is required'), newPassword: password })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

export const deleteAccountSchema = z.object({ password: z.string().min(1, 'Password is required') });

// ---------- Transactions ----------
export const transactionSchema = z.object({
  type: transactionType,
  amount: money,
  categoryId: z.string().min(1, 'Category is required'),
  description: z.string().trim().min(1, 'Description is required').max(200),
  date: dateString,
  paymentMethod: paymentMethod.default('CASH'),
  notes: optionalText(1000),
});

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
  type: transactionType.optional(),
  categoryId: z.string().optional(),
  paymentMethod: paymentMethod.optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  sortBy: z.enum(['date', 'amount', 'description', 'category', 'createdAt']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ---------- Categories ----------
export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(40),
  type: transactionType.default('EXPENSE'),
  color: hexColor.default('#64748b'),
  icon: z.string().trim().min(1).max(40).default('tag'),
});

export const updateCategorySchema = createCategorySchema
  .omit({ type: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const categoryQuerySchema = z.object({ type: transactionType.optional() });

// ---------- Budgets ----------
export const budgetSchema = z
  .object({
    month: monthSchema,
    year: yearSchema,
    totalAmount: money,
    notes: optionalText(500),
    categories: z
      .array(z.object({ categoryId: z.string().min(1), amount: money }))
      .max(50)
      .default([]),
  })
  .superRefine((v, ctx) => {
    const ids = v.categories.map((c) => c.categoryId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: 'Each category can only be budgeted once', path: ['categories'] });
    }
    const allocated = v.categories.reduce((s, c) => s + c.amount, 0);
    if (allocated > v.totalAmount + 0.001) {
      ctx.addIssue({
        code: 'custom',
        message: 'Category allocations cannot exceed the total monthly budget',
        path: ['categories'],
      });
    }
  });

export const budgetQuerySchema = z.object({ month: monthSchema.optional(), year: yearSchema.optional() });

// ---------- Goals ----------
export const goalSchema = z.object({
  name: z.string().trim().min(1, 'Goal name is required').max(80),
  targetAmount: money,
  currentAmount: nonNegativeMoney.default(0),
  targetDate: dateString.optional().nullable().transform((v) => v ?? null),
  description: optionalText(500),
  color: hexColor.default('#4f46e5'),
});

export const updateGoalSchema = goalSchema.partial().refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const contributeSchema = z.object({
  amount: z.coerce
    .number()
    .finite()
    .refine((v) => v !== 0, 'Amount cannot be zero')
    .transform((v) => Math.round(v * 100) / 100),
});

// ---------- Analytics ----------
export const periodQuerySchema = z.object({ month: monthSchema.optional(), year: yearSchema.optional() });

export const monthlyQuerySchema = periodQuerySchema.extend({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

export const categoryAnalyticsQuerySchema = z.object({
  type: transactionType.default('EXPENSE'),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
});

// ---------- Notifications ----------
export const notificationQuerySchema = z.object({
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
