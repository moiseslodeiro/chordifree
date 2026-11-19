import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ApiError, errorBody } from '../errors';
import type { StemJobs } from '../services/stem-jobs';
import type { StemEngine } from '../services/stems';
import { isVideoId } from '../youtube';

const JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Local stem separation: status, start and result streaming. The engine is a
 * plugin installed by the desktop user, so the API answers `available: false`
 * everywhere else.
 */
export function createStemsRouter(engine: StemEngine, jobs: StemJobs): Router {
  const router = Router();
  const startLimiter = rateLimit({
    windowMs: 60_000,
    limit: 6,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.authUser?.uid ?? req.ip ?? 'unknown',
    handler: (_req, res) => {
      res.setHeader('Retry-After', '60');
      res.status(429).json(errorBody('RATE_LIMITED', 'Too many separation requests'));
    },
  });

  router.get('/', async (_req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await engine.status());
    } catch (error) {
      next(error);
    }
  });

  router.post('/:videoId', startLimiter, async (req, res, next) => {
    try {
      const videoId = req.params.videoId;
      if (!isVideoId(videoId)) {
        throw new ApiError('INVALID_REQUEST', 'A valid videoId is required');
      }
      const status = await engine.status();
      if (!status.available) {
        throw new ApiError(
          'STEMS_UNAVAILABLE',
          status.error ?? 'The stems plugin is not installed. See docs/STEMS_PLUGIN.md.',
        );
      }
      res.status(202).json(await jobs.start(videoId));
    } catch (error) {
      next(error);
    }
  });

  router.get('/jobs/:id', (req, res, next) => {
    try {
      if (!JOB_ID_PATTERN.test(req.params.id)) {
        throw new ApiError('NOT_FOUND', 'The separation job does not exist');
      }
      const job = jobs.get(req.params.id);
      if (!job) throw new ApiError('NOT_FOUND', 'The separation job does not exist');
      res.setHeader('Cache-Control', 'no-store');
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  router.get('/jobs/:id/:stem', (req, res, next) => {
    try {
      if (!JOB_ID_PATTERN.test(req.params.id)) {
        throw new ApiError('NOT_FOUND', 'The separation job does not exist');
      }
      const path = jobs.file(req.params.id, req.params.stem);
      if (!path) throw new ApiError('NOT_FOUND', 'That stem is not ready');
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'private, no-store');
      res.sendFile(path, (error) => {
        if (!error || res.headersSent) return;
        next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
