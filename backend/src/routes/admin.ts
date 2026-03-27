import { Router } from 'express';
import * as userController from '../controllers/userController';
import * as auditController from '../controllers/auditController';
import * as templateController from '../controllers/templateController';
import { authenticate, authorize, requireRole } from '../middleware/auth';
import { validate } from '../validators/validate';
import { userRoleSchema, uuidParamSchema, auditQuerySchema, exportTemplateSchema } from '../validators/schemas';

const router = Router();

router.use(authenticate);

// User management (admin only)
router.get('/users', authorize('users:read'), userController.listUsers);
router.get('/roles', authorize('roles:manage'), userController.listRoles);
router.post('/users/roles/assign', authorize('roles:manage'), validate(userRoleSchema), userController.assignRole);
router.post('/users/roles/remove', authorize('roles:manage'), validate(userRoleSchema), userController.removeRole);
router.patch('/users/:id/toggle-active', authorize('users:manage'), validate(uuidParamSchema, 'params'), userController.toggleUserActive);

// Audit logs (admin only)
router.get('/audit-logs', authorize('audit:read'), validate(auditQuerySchema, 'query'), auditController.list);

// Export templates
router.get('/templates', authorize('templates:read'), templateController.list);
router.get('/templates/:id', authorize('templates:read'), validate(uuidParamSchema, 'params'), templateController.getOne);
router.post('/templates', authorize('templates:create'), validate(exportTemplateSchema), templateController.create);
router.put('/templates/:id', authorize('templates:update'), validate(uuidParamSchema, 'params'), templateController.update);
router.delete('/templates/:id', authorize('templates:delete'), validate(uuidParamSchema, 'params'), templateController.remove);

export default router;
