import { Router, Response } from 'express';
import { authService } from '../services/auth.service';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { loginSchema } from '../utils/validators';
import { logger } from '../utils/logger';

const router = Router();

router.post('/login', validate(loginSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.get('user-agent') || '';

    const result = await authService.login(username, password, ip, userAgent);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth/refresh',
    });

    res.json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'Invalid credentials') {
      res.status(401).json({ error: message });
    } else {
      logger.error('Login error', { error: message });
      res.status(503).json({ error: 'Authentication service unavailable' });
    }
  }
});

router.post('/refresh', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    const result = await authService.refreshAccessToken(refreshToken);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh',
    });

    res.json({ accessToken: result.accessToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.get('user-agent') || '';

    await authService.logout(req.user!.userId, ip, userAgent);

    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    logger.error('Logout error', { error: (err as Error).message });
    res.status(500).json({ error: 'Logout failed' });
  }
});

router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router;
