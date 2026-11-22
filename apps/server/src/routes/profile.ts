import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ProfileBodySchema, type AuthUser } from '@chordifree/contracts';
import { ApiError } from '../errors';
import type { AuthContext } from '../services/auth';
import { fallbackNickname, type ProfileStore } from '../services/profiles';

/** Nickname shown on collaborative edits. Falls back to the Google name. */
export function createProfileRouter(auth: AuthContext, profiles: ProfileStore): Router {
  const router = Router();
  const writeLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.authUser?.uid ?? req.ip ?? 'unknown',
    message: { code: 'RATE_LIMITED', message: 'Too many nickname changes' },
  });

  router.get('/', async (req, res, next) => {
    try {
      const user = requireUser(req.authUser);
      const stored = await profiles.get(user.uid);
      res.json({
        nickname: stored ?? fallbackNickname(user),
        custom: stored !== null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.put('/', writeLimiter, async (req, res, next) => {
    try {
      const user = requireUser(req.authUser);
      const parsed = ProfileBodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError('INVALID_REQUEST', 'The nickname is not valid');
      }
      await profiles.set(user.uid, parsed.data.nickname);
      res.json({ nickname: parsed.data.nickname, custom: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function requireUser(user: AuthUser | undefined): AuthUser {
  if (!user) throw new ApiError('UNAUTHENTICATED', 'Sign in with Google to continue');
  return user;
}
