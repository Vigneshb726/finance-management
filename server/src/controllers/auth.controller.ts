import { getUserId } from '../middleware/auth';
import * as authService from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';

export const register = asyncHandler(async (req, res) => {
  res.status(201).json(await authService.register(req.body));
});

export const login = asyncHandler(async (req, res) => {
  res.json(await authService.login(req.body.email, req.body.password));
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: await authService.getMe(getUserId(req)) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  res.json({ user: await authService.updateProfile(getUserId(req), req.body) });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(getUserId(req), req.body.currentPassword, req.body.newPassword);
  res.json({ message: 'Password updated successfully' });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  await authService.deleteAccount(getUserId(req), req.body.password);
  res.status(204).end();
});
