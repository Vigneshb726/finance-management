import { recurringService as service } from '@finora/core';
import { core } from '../config/db';
import { getUserId } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listRecurring(core, getUserId(req)));
});

export const getOne = asyncHandler(async (req, res) => {
  res.json(await service.getRecurring(core, getUserId(req), req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createRecurring(core, getUserId(req), req.body));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await service.updateRecurring(core, getUserId(req), req.params.id, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  await service.deleteRecurring(core, getUserId(req), req.params.id);
  res.status(204).end();
});
