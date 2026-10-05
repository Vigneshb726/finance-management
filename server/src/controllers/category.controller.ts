import { categoryQuerySchema, categoryService as service } from '@finora/core';
import { core } from '../config/db';
import { getUserId } from '../middleware/auth';
import { parseQuery } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';

export const list = asyncHandler(async (req, res) => {
  const { type } = parseQuery(categoryQuerySchema, req.query);
  res.json(await service.listCategories(core, getUserId(req), type));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createCategory(core, getUserId(req), req.body));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await service.updateCategory(core, getUserId(req), req.params.id, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  res.json(await service.deleteCategory(core, getUserId(req), req.params.id));
});
