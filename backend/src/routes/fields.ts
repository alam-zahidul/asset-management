import { Router } from 'express';
import * as fieldController from '../controllers/fieldController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../validators/validate';
import { fieldCreateSchema, fieldUpdateSchema, uuidParamSchema } from '../validators/schemas';

const router = Router();

router.use(authenticate);

router.get('/', authorize('fields:read'), fieldController.list);
router.get('/active', authorize('fields:read'), fieldController.getActive);
router.get('/:id', authorize('fields:read'), validate(uuidParamSchema, 'params'), fieldController.getOne);
router.post('/', authorize('fields:create'), validate(fieldCreateSchema), fieldController.create);
router.put('/:id', authorize('fields:update'), validate(uuidParamSchema, 'params'), validate(fieldUpdateSchema), fieldController.update);
router.delete('/:id', authorize('fields:delete'), validate(uuidParamSchema, 'params'), fieldController.remove);

export default router;
