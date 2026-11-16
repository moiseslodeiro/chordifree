import { Router } from 'express';
import { CloudLibraryBodySchema } from '@chordifree/contracts';
import { ApiError } from '../errors';
import type { CloudLibraryStore } from '../services/cloud-library';

export function createCloudLibraryRouter(store: CloudLibraryStore | null): Router {
  const router = Router();

  router.get('/library', async (req, res, next) => {
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

  router.put('/library', async (req, res, next) => {
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
