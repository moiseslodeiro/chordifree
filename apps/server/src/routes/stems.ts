import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ApiError, errorBody } from '../errors';
import type { StemJobs } from '../services/stem-jobs';
import type { StemCache, StemCacheEntry } from '../services/stem-cache';
import type { StemEngine } from '../services/stems';
import type { StemInstallerLike } from '../services/stem-installer';
import { isVideoId } from '../youtube';

const JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Local stem separation: status, start and result streaming. The engine is a
 * plugin installed by the desktop user, so the API answers `available: false`
 * everywhere else.
 */
function publicEntry(entry: StemCacheEntry) {
  return {
    key: entry.key,
    videoId: entry.videoId,
    ...(entry.title ? { title: entry.title } : {}),
    plugin: entry.plugin,
    stems: entry.stems,
    midi: entry.midi,
    createdAt: entry.createdAt,
    bytes: entry.bytes,
  };
}

export function createStemsRouter(
  engine: StemEngine,
  jobs: StemJobs,
  cache: StemCache,
  setup?: StemInstallerLike,
): Router {
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
      const title =
        typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 200) : undefined;
      res.status(202).json(await jobs.start(videoId, title || undefined));
    } catch (error) {
      next(error);
    }
  });

  router.get('/jobs', (_req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ jobs: jobs.list() });
    } catch (error) {
      next(error);
    }
  });

  router.post('/jobs/:id/cancel', (req, res, next) => {
    try {
      if (!JOB_ID_PATTERN.test(req.params.id)) {
        throw new ApiError('NOT_FOUND', 'The separation job does not exist');
      }
      const job = jobs.cancel(req.params.id);
      if (!job) throw new ApiError('NOT_FOUND', 'The separation job does not exist');
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  router.get('/setup', async (_req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      if (!setup) {
        res.json({ supported: false, installed: false, managed: false });
        return;
      }
      res.json(await setup.status());
    } catch (error) {
      next(error);
    }
  });

  router.post('/setup/install', async (_req, res, next) => {
    try {
      if (!setup) {
        throw new ApiError('STEMS_SETUP_UNAVAILABLE', 'The plugin installer is not available');
      }
      res.status(202).json(await setup.install());
    } catch (error) {
      next(error);
    }
  });

  router.post('/setup/cancel', (req, res, next) => {
    try {
      if (!setup) {
        throw new ApiError('STEMS_SETUP_UNAVAILABLE', 'The plugin installer is not available');
      }
      const job = setup.cancel();
      if (!job) throw new ApiError('NOT_FOUND', 'There is no installation to cancel');
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/setup', async (_req, res, next) => {
    try {
      if (!setup) {
        throw new ApiError('STEMS_SETUP_UNAVAILABLE', 'The plugin installer is not available');
      }
      await setup.uninstall();
      res.json({ removed: true });
    } catch (error) {
      next(error);
    }
  });

  router.get('/cache', async (_req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ entries: (await cache.list()).map(publicEntry) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/cache/:videoId', async (req, res, next) => {
    try {
      const entry = await cache.get(req.params.videoId);
      if (!entry) throw new ApiError('NOT_FOUND', 'That song is not cached');
      res.setHeader('Cache-Control', 'no-store');
      res.json(publicEntry(entry));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/cache', async (_req, res, next) => {
    try {
      res.json({ removed: await cache.clear() });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/cache/:videoId', async (req, res, next) => {
    try {
      res.json({ removed: await cache.remove(req.params.videoId) });
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

  router.get('/jobs/:id/notes/:stem', (req, res, next) => {
    try {
      if (!JOB_ID_PATTERN.test(req.params.id)) {
        throw new ApiError('NOT_FOUND', 'The separation job does not exist');
      }
      const notes = jobs.notes(req.params.id, req.params.stem);
      if (!notes) throw new ApiError('NOT_FOUND', 'Those notes are not ready');
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ notes });
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
