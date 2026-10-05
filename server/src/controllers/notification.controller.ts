import { notificationQuerySchema, notificationService as service } from '@finora/core';
import { core } from '../config/db';
import { getUserId } from '../middleware/auth';
import { parseQuery } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listNotifications(core, getUserId(req), parseQuery(notificationQuerySchema, req.query)));
});

export const markRead = asyncHandler(async (req, res) => {
  res.json(await service.markRead(core, getUserId(req), req.params.id));
});

export const markAllRead = asyncHandler(async (req, res) => {
  res.json(await service.markAllRead(core, getUserId(req)));
});

export const remove = asyncHandler(async (req, res) => {
  await service.deleteNotification(core, getUserId(req), req.params.id);
  res.status(204).end();
});
