import { getUserId } from '../middleware/auth';
import { parseQuery } from '../middleware/validate';
import * as service from '../services/category.service';
import { asyncHandler } from '../utils/asyncHandler';
import { categoryQuerySchema } from '../validators/schemas';

export const list = asyncHandler(async (req, res) => {
  const { type } = parseQuery(categoryQuerySchema, req.query);
  res.json(await service.listCategories(getUserId(req), type));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createCategory(getUserId(req), req.body));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await service.updateCategory(getUserId(req), req.params.id, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  res.json(await service.deleteCategory(getUserId(req), req.params.id));
});
