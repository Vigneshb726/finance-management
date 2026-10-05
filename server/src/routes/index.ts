import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  budgetSchema,
  changePasswordSchema,
  contributeSchema,
  createCategorySchema,
  deleteAccountSchema,
  goalSchema,
  loginSchema,
  recurringSchema,
  registerSchema,
  transactionSchema,
  updateCategorySchema,
  updateGoalSchema,
  updateProfileSchema,
} from '@finora/core';
import { env } from '../config/env';
import * as analytics from '../controllers/analytics.controller';
import * as auth from '../controllers/auth.controller';
import * as backup from '../controllers/backup.controller';
import * as budgets from '../controllers/budget.controller';
import * as categories from '../controllers/category.controller';
import * as goals from '../controllers/goal.controller';
import * as notifications from '../controllers/notification.controller';
import * as recurring from '../controllers/recurring.controller';
import * as transactions from '../controllers/transaction.controller';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

// Brute-force protection for credential endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
});

// Backups can be far larger than ordinary request bodies
export const BACKUP_RESTORE_PATH = '/backup/restore';
const backupBody = express.json({ limit: '25mb' });

// ---------- Auth ----------
router.post('/auth/register', authLimiter, validateBody(registerSchema), auth.register);
router.post('/auth/login', authLimiter, validateBody(loginSchema), auth.login);
router.get('/auth/me', requireAuth, auth.me);
router.put('/auth/profile', requireAuth, validateBody(updateProfileSchema), auth.updateProfile);
router.put('/auth/password', requireAuth, authLimiter, validateBody(changePasswordSchema), auth.changePassword);
router.delete('/auth/account', requireAuth, authLimiter, validateBody(deleteAccountSchema), auth.deleteAccount);

// Everything below requires authentication
router.use(requireAuth);

// ---------- Transactions ----------
router.get('/transactions', transactions.list);
router.get('/transactions/export', transactions.exportCsv);
router.get('/transactions/:id', transactions.getOne);
router.post('/transactions', validateBody(transactionSchema), transactions.create);
router.put('/transactions/:id', validateBody(transactionSchema), transactions.update);
router.delete('/transactions/:id', transactions.remove);

// ---------- Recurring transactions ----------
router.get('/recurring', recurring.list);
router.get('/recurring/:id', recurring.getOne);
router.post('/recurring', validateBody(recurringSchema), recurring.create);
router.put('/recurring/:id', validateBody(recurringSchema), recurring.update);
router.delete('/recurring/:id', recurring.remove);

// ---------- Categories ----------
router.get('/categories', categories.list);
router.post('/categories', validateBody(createCategorySchema), categories.create);
router.put('/categories/:id', validateBody(updateCategorySchema), categories.update);
router.delete('/categories/:id', categories.remove);

// ---------- Budgets ----------
router.get('/budgets', budgets.list);
router.get('/budgets/:id', budgets.getOne);
router.post('/budgets', validateBody(budgetSchema), budgets.create);
router.put('/budgets/:id', validateBody(budgetSchema), budgets.update);
router.delete('/budgets/:id', budgets.remove);

// ---------- Goals ----------
router.get('/goals', goals.list);
router.get('/goals/:id', goals.getOne);
router.post('/goals', validateBody(goalSchema), goals.create);
router.put('/goals/:id', validateBody(updateGoalSchema), goals.update);
router.post('/goals/:id/contribute', validateBody(contributeSchema), goals.contribute);
router.delete('/goals/:id', goals.remove);

// ---------- Analytics & reports ----------
router.get('/analytics/summary', analytics.summary);
router.get('/analytics/monthly', analytics.monthly);
router.get('/analytics/categories', analytics.categories);
router.get('/analytics/daily', analytics.daily);
router.get('/reports/monthly', analytics.monthlyReport);

// ---------- Notifications ----------
router.get('/notifications', notifications.list);
router.put('/notifications/read-all', notifications.markAllRead);
router.put('/notifications/:id/read', notifications.markRead);
router.delete('/notifications/:id', notifications.remove);

// ---------- Backup ----------
router.get('/backup', backup.create);
router.post(BACKUP_RESTORE_PATH, backupBody, backup.restore);

export default router;
