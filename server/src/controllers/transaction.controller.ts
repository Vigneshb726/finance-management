import { csvService, transactionFilterSchema, transactionQuerySchema, transactionService as service } from '@finora/core';
import { core } from '../config/db';
import { getUserId } from '../middleware/auth';
import { parseQuery } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listTransactions(core, getUserId(req), parseQuery(transactionQuerySchema, req.query)));
});

export const getOne = asyncHandler(async (req, res) => {
  res.json(await service.getTransaction(core, getUserId(req), req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createTransaction(core, getUserId(req), req.body));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await service.updateTransaction(core, getUserId(req), req.params.id, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  await service.deleteTransaction(core, getUserId(req), req.params.id);
  res.status(204).end();
});

/** Transactions matching the filters as a CSV download. */
export const exportCsv = asyncHandler(async (req, res) => {
  const filters = parseQuery(transactionFilterSchema, req.query);
  const { filename, content } = await csvService.exportTransactionsCsv(core, getUserId(req), filters);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(content);
});
