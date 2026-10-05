import { backupService } from '@finora/core';
import { core } from '../config/db';
import { getUserId } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

/** Full JSON backup of the signed-in user's data. */
export const create = asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await backupService.createBackup(core, getUserId(req)));
});

/** Replaces the signed-in user's data with a backup file's contents. */
export const restore = asyncHandler(async (req, res) => {
  res.json(await backupService.restoreBackup(core, getUserId(req), req.body));
});
