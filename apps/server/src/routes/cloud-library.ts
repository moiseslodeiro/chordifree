import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { CloudLibraryBodySchema } from '@chordifree/contracts';
import { ApiError, errorBody } from '../errors';
import type { CloudLibraryStore } from '../services/cloud-library';

export function createCloudLibraryRouter(store: CloudLibraryStore | null): Router {
  const router = Router();
  // The library sync is a single-user write; keep Firestore safe from runaway clients.
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.authUser?.uid ?? req.ip ?? 'unknown',
    handler: (_req, res) => {
      res.setHeader('Retry-After', '60');
      res.status(429).json(errorBody('RATE_LIMITED', 'Too many sync requests.'));
    },
  });

  router.get('/library', limiter, async (req, res, next) => {
    try {
      if (!store) throw new ApiError('CLOUD_DISABLED', 'The cloud library is not enabled');
      const user = req.authUser;
      if (!user) throw new ApiError('UNAUTHENTICATED', 'Sign in with Google to continue');
      const data = await store.load(user.uid);
      res.json({ ...data, updatedAt: new Date().toISOString() });
    } catch (error) {
      next(error);
    }
  });

  router.put('/library', limiter, async (req, res, next) => {
    try {
      if (!store) throw new ApiError('CLOUD_DISABLED', 'The cloud library is not enabled');
      const user = req.authUser;
      if (!user) throw new ApiError('UNAUTHENTICATED', 'Sign in with Google to continue');
      const parsed = CloudLibraryBodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError('INVALID_REQUEST', 'The cloud library payload is not valid');
      }
      await store.replace(user.uid, parsed.data);
      res.json({
        saved: true,
        songs: parsed.data.songs.length,
        setlists: parsed.data.setlists.length,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
