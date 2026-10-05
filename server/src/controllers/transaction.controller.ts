import { getUserId } from '../middleware/auth';
import { parseQuery } from '../middleware/validate';
import * as service from '../services/transaction.service';
import { asyncHandler } from '../utils/asyncHandler';
import { transactionQuerySchema } from '../validators/schemas';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listTransactions(getUserId(req), parseQuery(transactionQuerySchema, req.query)));
});

export const getOne = asyncHandler(async (req, res) => {
  res.json(await service.getTransaction(getUserId(req), req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createTransaction(getUserId(req), req.body));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await service.updateTransaction(getUserId(req), req.params.id, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  await service.deleteTransaction(getUserId(req), req.params.id);
  res.status(204).end();
});
