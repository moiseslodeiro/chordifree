import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { ApiError, errorBody } from '../errors';
import type { LyricsClient } from '../services/lyrics';

const LyricsQuerySchema = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().max(200).optional(),
  duration: z.coerce.number().finite().min(1).max(3600).optional(),
});

export function createLyricsRouter(lyrics: LyricsClient): Router {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.setHeader('Retry-After', '60');
      res.status(429).json(errorBody('RATE_LIMITED', 'Too many lyrics requests. Try again later.'));
    },
  });

  router.get('/', limiter, async (req, res, next) => {
    try {
      const parsed = LyricsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiError('INVALID_REQUEST', 'A valid song title is required');
      }
      const result = await lyrics.find(parsed.data);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
