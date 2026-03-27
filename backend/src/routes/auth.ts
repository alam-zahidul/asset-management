import { Router } from 'express';
import * as authController from '../controllers/authController';
import { validate } from '../validators/validate';
import { loginSchema, refreshTokenSchema } from '../validators/schemas';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
