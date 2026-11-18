import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { CollabCreateBodySchema, CollabRevisionBodySchema, type Song } from '@chordifree/contracts';
import { ApiError } from '../errors';
import type { CollabStore } from '../services/collab';
import { resolveNickname, type ProfileStore } from '../services/profiles';
import { requireUser } from './profile';

export interface CollabRouterDeps {
  collab: CollabStore;
  profiles: ProfileStore;
}

/**
 * A shared song is a small revision history. Every signed-in member of the
 * allowlist who has the link can read it and publish a new revision, and the
 * server rejects writes based on a stale revision (last writer never wins by
 * accident).
 */
export function createCollabRouter({ collab, profiles }: CollabRouterDeps): Router {
  const router = Router();
  const writeLimiter = rateLimit({
    windowMs: 60_000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.authUser?.uid ?? req.ip ?? 'unknown',
    message: { code: 'RATE_LIMITED', message: 'Too many collaborative edits' },
  });

  router.post('/', writeLimiter, async (req, res, next) => {
    try {
      const user = requireUser(req.authUser);
      const parsed = CollabCreateBodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError('INVALID_REQUEST', 'The shared song is not valid');
      }
      const nickname = await resolveNickname(profiles, user);
      const share = await collab.create(
        { uid: user.uid, nickname },
        parsed.data.song as unknown as Song,
      );
      res.status(201).json(share);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      requireUser(req.authUser);
      res.json(await collab.get(req.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id/revisions/:revisionId', async (req, res, next) => {
    try {
      requireUser(req.authUser);
      res.json(await collab.getRevision(req.params.id, req.params.revisionId));
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/revisions', writeLimiter, async (req, res, next) => {
    try {
      const user = requireUser(req.authUser);
      const parsed = CollabRevisionBodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError('INVALID_REQUEST', 'The shared version is not valid');
      }
      const share = await collab.get(req.params.id);
      const song = parsed.data.song as unknown as Song;
      if (song.id !== share.songId) {
        throw new ApiError('INVALID_REQUEST', 'The shared version belongs to another song');
      }
      const nickname = await resolveNickname(profiles, user);
      const revision = await collab.append(
        req.params.id,
        { uid: user.uid, nickname },
        parsed.data.baseRevisionId,
        song,
      );
      res.status(201).json(revision);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
