import { getUserId } from '../middleware/auth';
import { parseQuery } from '../middleware/validate';
import * as service from '../services/budget.service';
import { asyncHandler } from '../utils/asyncHandler';
import { budgetQuerySchema } from '../validators/schemas';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listBudgets(getUserId(req), parseQuery(budgetQuerySchema, req.query)));
});

export const getOne = asyncHandler(async (req, res) => {
  res.json(await service.getBudget(getUserId(req), req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createBudget(getUserId(req), req.body));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await service.updateBudget(getUserId(req), req.params.id, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  await service.deleteBudget(getUserId(req), req.params.id);
  res.status(204).end();
});
