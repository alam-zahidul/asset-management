import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { importExportService } from '../services/import-export.service';
import { exportSchema } from '../utils/validators';
import { config } from '../config';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxSizeMB * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  },
});

router.use(authenticate);

// Import assets from file
router.post(
  '/import',
  authorize('assets.import'),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const fileType = ext === '.csv' ? 'csv' : 'xlsx';
      const ip = req.ip || req.socket.remoteAddress || '';
      const userAgent = req.get('user-agent') || '';

      const result = await importExportService.importFromBuffer(
        req.file.buffer,
        fileType as 'csv' | 'xlsx',
        req.file.originalname,
        req.user!.userId,
        ip,
        userAgent
      );

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Import failed', message: (err as Error).message });
    }
  }
);

// Export assets
router.post('/export', authorize('assets.export'), validate(exportSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.get('user-agent') || '';

    const buffer = await importExportService.exportAssets(req.body, req.user!.userId, ip, userAgent);

    const { format } = req.body;
    const contentTypes: Record<string, string> = {
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      pdf: 'application/pdf',
    };

    const filename = `asset-export-${Date.now()}.${format}`;

    res.setHeader('Content-Type', contentTypes[format]);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Export failed', message: (err as Error).message });
  }
});

// Get import logs
router.get('/imports', authorize('assets.import'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const logs = await importExportService.getImportLogs(page, limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch import logs' });
  }
});

export default router;
