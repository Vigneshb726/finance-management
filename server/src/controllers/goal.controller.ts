import { getUserId } from '../middleware/auth';
import * as service from '../services/goal.service';
import { asyncHandler } from '../utils/asyncHandler';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listGoals(getUserId(req)));
});

export const getOne = asyncHandler(async (req, res) => {
  res.json(await service.getGoal(getUserId(req), req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createGoal(getUserId(req), req.body));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await service.updateGoal(getUserId(req), req.params.id, req.body));
});

export const contribute = asyncHandler(async (req, res) => {
  res.json(await service.contributeToGoal(getUserId(req), req.params.id, req.body.amount));
});

export const remove = asyncHandler(async (req, res) => {
  await service.deleteGoal(getUserId(req), req.params.id);
  res.status(204).end();
});
