import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticate, authorize } from '../middleware/auth.middleware';
import { query } from '../config/database';

const router = Router();

router.use(authenticate);

// Get audit logs
router.get('/', authorize('audit.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let paramIdx = 1;

    if (req.query.action) {
      whereClause += ` AND al.action ILIKE $${paramIdx++}`;
      params.push(`%${req.query.action}%`);
    }

    if (req.query.resource) {
      whereClause += ` AND al.resource = $${paramIdx++}`;
      params.push(req.query.resource);
    }

    if (req.query.userId) {
      whereClause += ` AND al.user_id = $${paramIdx++}`;
      params.push(req.query.userId);
    }

    if (req.query.from) {
      whereClause += ` AND al.created_at >= $${paramIdx++}`;
      params.push(req.query.from);
    }

    if (req.query.to) {
      whereClause += ` AND al.created_at <= $${paramIdx++}`;
      params.push(req.query.to);
    }

    const result = await query(
      `SELECT al.*, u.display_name as user_name, u.username
       FROM auth.audit_logs al
       LEFT JOIN auth.users u ON u.id = al.user_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM auth.audit_logs al ${whereClause}`,
      params
    );

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
