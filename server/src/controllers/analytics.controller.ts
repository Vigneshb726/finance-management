import { getUserId } from '../middleware/auth';
import { parseQuery } from '../middleware/validate';
import * as service from '../services/analytics.service';
import { asyncHandler } from '../utils/asyncHandler';
import { categoryAnalyticsQuerySchema, monthlyQuerySchema, periodQuerySchema } from '../validators/schemas';

export const summary = asyncHandler(async (req, res) => {
  res.json(await service.getSummary(getUserId(req), parseQuery(periodQuerySchema, req.query)));
});

export const monthly = asyncHandler(async (req, res) => {
  res.json(await service.getMonthly(getUserId(req), parseQuery(monthlyQuerySchema, req.query)));
});

export const categories = asyncHandler(async (req, res) => {
  res.json(await service.getCategoryBreakdown(getUserId(req), parseQuery(categoryAnalyticsQuerySchema, req.query)));
});

export const daily = asyncHandler(async (req, res) => {
  res.json(await service.getDailyTrend(getUserId(req), parseQuery(periodQuerySchema, req.query)));
});
