import { Router } from 'express';
import type { AuthContext } from '../services/auth';
import { authenticateUser, requireAdmin } from '../services/auth';
import type { AnalysisLogStore } from '../services/analysis-log';

/** Read-only activity feed for administrators: who analyzed what. */
export function createAdminAnalysesRouter(auth: AuthContext, log: AnalysisLogStore): Router {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(authenticateUser(auth), requireAdmin(auth));

  router.get('/', async (req, res, next) => {
    try {
      const limit = Number(req.query.limit ?? 100);
      res.json({ entries: await log.list(limit) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
