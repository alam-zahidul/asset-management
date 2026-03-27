import { Router, Response } from 'express';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { assetService } from '../services/asset.service';
import { assetFilterSchema, assetCreateSchema, assetUpdateSchema } from '../utils/validators';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List assets with filtering, searching, pagination
router.get('/', authorize('assets.read'), validate(assetFilterSchema, 'query'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await assetService.list(req.query as any);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Get single asset
router.get('/:id', authorize('assets.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uuidSchema = z.string().uuid();
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid asset ID' });
      return;
    }

    const asset = await assetService.getById(req.params.id);
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }
    res.json(asset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// Create asset
router.post('/', authorize('assets.create'), validate(assetCreateSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.get('user-agent') || '';

    const asset = await assetService.create(req.body, req.user!.userId, ip, userAgent);
    res.status(201).json(asset);
  } catch (err) {
    const message = (err as Error).message;
    if (message.startsWith('Validation failed') || message.includes('must be unique')) {
      res.status(400).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to create asset' });
    }
  }
});

// Update asset
router.put('/:id', authorize('assets.update'), validate(assetUpdateSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uuidSchema = z.string().uuid();
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid asset ID' });
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.get('user-agent') || '';

    const asset = await assetService.update(req.params.id, req.body, req.user!.userId, ip, userAgent);
    res.json(asset);
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'Asset not found') {
      res.status(404).json({ error: message });
    } else if (message.startsWith('Validation failed') || message.includes('must be unique')) {
      res.status(400).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to update asset' });
    }
  }
});

// Delete asset
router.delete('/:id', authorize('assets.delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uuidSchema = z.string().uuid();
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid asset ID' });
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.get('user-agent') || '';

    await assetService.delete(req.params.id, req.user!.userId, ip, userAgent);
    res.status(204).send();
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'Asset not found') {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to delete asset' });
    }
  }
});

// Get asset history
router.get('/:id/history', authorize('assets.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uuidSchema = z.string().uuid();
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid asset ID' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const history = await assetService.getHistory(req.params.id, page, limit);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch asset history' });
  }
});

export default router;
