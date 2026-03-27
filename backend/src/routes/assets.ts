import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import * as assetController from '../controllers/assetController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../validators/validate';
import { assetCreateSchema, assetUpdateSchema, exportSchema, uuidParamSchema } from '../validators/schemas';
import config from '../config';
import { sanitizeFileName } from '../utils/sanitizer';

const router = Router();

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: config.upload.dir,
  filename: (_req, file, cb) => {
    const safeName = sanitizeFileName(file.originalname);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeName}`);
  },
});

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = ['.csv', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV and Excel files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxSizeMb * 1024 * 1024 },
});

// Routes
router.use(authenticate);

router.get('/', authorize('assets:read'), assetController.list);
router.get('/import-logs', authorize('assets:import'), assetController.getImportLogs);
router.get('/field-values/:fieldKey', authorize('assets:read'), assetController.getFieldDistinctValues);
router.get('/:id', authorize('assets:read'), validate(uuidParamSchema, 'params'), assetController.getOne);
router.post('/', authorize('assets:create'), validate(assetCreateSchema), assetController.create);
router.put('/:id', authorize('assets:update'), validate(uuidParamSchema, 'params'), validate(assetUpdateSchema), assetController.update);
router.delete('/:id', authorize('assets:delete'), validate(uuidParamSchema, 'params'), assetController.remove);

// Import / Export
router.post('/import', authorize('assets:import'), upload.single('file'), assetController.importFile);
router.post('/export', authorize('assets:export'), validate(exportSchema), assetController.exportData);

export default router;
