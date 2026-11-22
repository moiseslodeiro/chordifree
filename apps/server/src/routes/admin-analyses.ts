import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { AuthContext } from '../services/auth';
import { authenticateUser, requireAdmin } from '../services/auth';
import type { AnalysisLogStore } from '../services/analysis-log';

/** Read-only activity feed for administrators: who analyzed what. */
export function createAdminAnalysesRouter(auth: AuthContext, log: AnalysisLogStore): Router {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.authUser?.uid ?? req.ip ?? 'unknown',
    message: { code: 'RATE_LIMITED', message: 'Too many activity requests' },
  });
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(authenticateUser(auth), requireAdmin(auth));

  router.get('/', limiter, async (req, res, next) => {
    try {
      const limit = Number(req.query.limit ?? 100);
      res.json({ entries: await log.list(limit) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
