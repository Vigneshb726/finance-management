import {
  analyticsService as service,
  categoryAnalyticsQuerySchema,
  monthlyQuerySchema,
  periodQuerySchema,
  reportQuerySchema,
  reportService,
} from '@finora/core';
import { core } from '../config/db';
import { getUserId } from '../middleware/auth';
import { parseQuery } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';

export const summary = asyncHandler(async (req, res) => {
  res.json(await service.getSummary(core, getUserId(req), parseQuery(periodQuerySchema, req.query)));
});

export const monthly = asyncHandler(async (req, res) => {
  res.json(await service.getMonthly(core, getUserId(req), parseQuery(monthlyQuerySchema, req.query)));
});

export const categories = asyncHandler(async (req, res) => {
  res.json(await service.getCategoryBreakdown(core, getUserId(req), parseQuery(categoryAnalyticsQuerySchema, req.query)));
});

export const daily = asyncHandler(async (req, res) => {
  res.json(await service.getDailyTrend(core, getUserId(req), parseQuery(periodQuerySchema, req.query)));
});

/** Data for the printable monthly report (the PDF is generated on the client). */
export const monthlyReport = asyncHandler(async (req, res) => {
  res.json(await reportService.getMonthlyReport(core, getUserId(req), parseQuery(reportQuerySchema, req.query)));
});
