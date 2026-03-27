import { Router, Response } from 'express';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware';
import { fieldService } from '../services/field.service';

const router = Router();

router.use(authenticate);

// Get active field definitions (needed by frontend for form rendering)
router.get('/fields', authorize('fields.read'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const fields = await fieldService.getActiveFields();
    res.json(fields);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch field definitions' });
  }
});

// Get field groups
router.get('/field-groups', authorize('fields.read'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const groups = await fieldService.getFieldGroups();
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch field groups' });
  }
});

export default router;
