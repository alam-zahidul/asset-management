import { Request, Response } from 'express';
import * as authService from '../services/authService';
import { loginSchema, refreshTokenSchema } from '../validators/schemas';

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;
  const tokens = await authService.login(username, password);

  res.json({
    status: 'success',
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    },
  });
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;
  const tokens = await authService.refreshAccessToken(refreshToken);

  res.json({
    status: 'success',
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    },
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(req.user!.userId);
  res.json({ status: 'success', message: 'Logged out' });
}

export async function me(req: Request, res: Response): Promise<void> {
  res.json({
    status: 'success',
    data: {
      userId: req.user!.userId,
      username: req.user!.username,
      roles: req.user!.roles,
      permissions: req.user!.permissions,
    },
  });
}
