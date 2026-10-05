import { getUserId } from '../middleware/auth';
import { parseQuery } from '../middleware/validate';
import * as service from '../services/notification.service';
import { asyncHandler } from '../utils/asyncHandler';
import { notificationQuerySchema } from '../validators/schemas';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listNotifications(getUserId(req), parseQuery(notificationQuerySchema, req.query)));
});

export const markRead = asyncHandler(async (req, res) => {
  res.json(await service.markRead(getUserId(req), req.params.id));
});

export const markAllRead = asyncHandler(async (req, res) => {
  res.json(await service.markAllRead(getUserId(req)));
});

export const remove = asyncHandler(async (req, res) => {
  await service.deleteNotification(getUserId(req), req.params.id);
  res.status(204).end();
});
