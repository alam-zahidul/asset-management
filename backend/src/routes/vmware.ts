import { Router } from 'express';
import * as vmwareController from '../controllers/vmwareController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../validators/validate';
import {
  vmwareConnectionCreateSchema,
  vmwareConnectionUpdateSchema,
  vmwareTestDirectSchema,
  vmwareSyncLogQuerySchema,
  uuidParamSchema,
} from '../validators/schemas';

const router = Router();

router.use(authenticate);

// List all connections
router.get('/connections', authorize('vmware:read'), vmwareController.listConnections);

// Get single connection
router.get('/connections/:id', authorize('vmware:read'), validate(uuidParamSchema, 'params'), vmwareController.getConnection);

// Create connection (admin only)
router.post('/connections', authorize('vmware:manage'), validate(vmwareConnectionCreateSchema), vmwareController.createConnection);

// Update connection (admin only)
router.put('/connections/:id', authorize('vmware:manage'), validate(uuidParamSchema, 'params'), validate(vmwareConnectionUpdateSchema), vmwareController.updateConnection);

// Delete connection (admin only)
router.delete('/connections/:id', authorize('vmware:manage'), validate(uuidParamSchema, 'params'), vmwareController.deleteConnection);

// Toggle active status
router.patch('/connections/:id/toggle-active', authorize('vmware:manage'), validate(uuidParamSchema, 'params'), vmwareController.toggleActive);

// Test existing connection
router.post('/connections/:id/test', authorize('vmware:read'), validate(uuidParamSchema, 'params'), vmwareController.testConnection);

// Test connection with provided credentials (no save)
router.post('/test', authorize('vmware:manage'), validate(vmwareTestDirectSchema), vmwareController.testConnectionDirect);

// Trigger sync
router.post('/connections/:id/sync', authorize('vmware:sync'), validate(uuidParamSchema, 'params'), vmwareController.triggerSync);

// Sync logs
router.get('/sync-logs', authorize('vmware:read'), validate(vmwareSyncLogQuerySchema, 'query'), vmwareController.getSyncLogs);

export default router;
