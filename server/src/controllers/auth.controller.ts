import { authService } from '@finora/core';
import { core } from '../config/db';
import { getUserId } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { signToken } from '../utils/jwt';

export const register = asyncHandler(async (req, res) => {
  const user = await authService.register(core, req.body);
  res.status(201).json({ user, token: signToken(user.id) });
});

export const login = asyncHandler(async (req, res) => {
  const user = await authService.login(core, req.body.email, req.body.password);
  res.json({ user, token: signToken(user.id) });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: await authService.getMe(core, getUserId(req)) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  res.json({ user: await authService.updateProfile(core, getUserId(req), req.body) });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(core, getUserId(req), req.body.currentPassword, req.body.newPassword);
  res.json({ message: 'Password updated successfully' });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  await authService.deleteAccount(core, getUserId(req), req.body.password);
  res.status(204).end();
});
