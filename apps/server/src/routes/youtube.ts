import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { ApiError, errorBody } from '../errors';
import type { MediaTools } from '../services/media';

const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
});

export function createYoutubeRouter(tools: MediaTools): Router {
  const router = Router();

  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.setHeader('Retry-After', '60');
      res
        .status(429)
        .json(errorBody('RATE_LIMITED', 'Too many YouTube searches. Try again later.'));
    },
  });

  router.get('/search', limiter, async (req, res, next) => {
    try {
      const parsed = SearchQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiError('INVALID_REQUEST', 'A search query between 1 and 120 characters is required');
      }
      const results = await tools.searchYoutube(parsed.data.q);
      res.json({ results });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
