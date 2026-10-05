import { budgetQuerySchema, budgetService as service } from '@finora/core';
import { core } from '../config/db';
import { getUserId } from '../middleware/auth';
import { parseQuery } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listBudgets(core, getUserId(req), parseQuery(budgetQuerySchema, req.query)));
});

export const getOne = asyncHandler(async (req, res) => {
  res.json(await service.getBudget(core, getUserId(req), req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createBudget(core, getUserId(req), req.body));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await service.updateBudget(core, getUserId(req), req.params.id, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  await service.deleteBudget(core, getUserId(req), req.params.id);
  res.status(204).end();
});
