import { resolve } from 'node:path';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { ApiError, errorBody } from '../errors';
import type { TemporaryAudioCache } from '../services/audio-cache';
import type { MediaTools } from '../services/media';
import { isVideoId } from '../youtube';

const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
});

export interface YoutubeRouterDeps {
  tools: MediaTools;
  audioCache: TemporaryAudioCache;
}

export function createYoutubeRouter({ tools, audioCache }: YoutubeRouterDeps): Router {
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

  const audioLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.setHeader('Retry-After', '60');
      res
        .status(429)
        .json(errorBody('RATE_LIMITED', 'Too many temporary audio requests. Try again later.'));
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

  /** Prepares the temporary audio used by the pitch-shifted player. */
  router.post('/:videoId/audio', audioLimiter, async (req, res, next) => {
    try {
      const videoId = videoIdFromParams(req.params.videoId);
      const entry = await audioCache.prepare(videoId);
      res.json({
        url: `/api/youtube/${videoId}/audio`,
        expiresAt: new Date(entry.expiresAt).toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  /** Streams the temporary audio with range support for seeking. */
  router.get('/:videoId/audio', async (req, res, next) => {
    try {
      const videoId = videoIdFromParams(req.params.videoId);
      const entry = await audioCache.get(videoId);
      if (!entry) {
        throw new ApiError(
          'AUDIO_NOT_READY',
          'The temporary audio is not available. Prepare it again.',
        );
      }
      res.setHeader('Content-Type', entry.contentType);
      res.setHeader('Cache-Control', 'private, no-store');
      res.sendFile(resolve(entry.path), (error) => {
        if (!error || res.headersSent) return;
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          res
            .status(404)
            .json(
              errorBody('AUDIO_NOT_READY', 'The temporary audio is not available. Prepare it again.'),
            );
          return;
        }
        next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function videoIdFromParams(value: string | undefined): string {
  if (!value || !isVideoId(value)) {
    throw new ApiError('INVALID_REQUEST', 'The video ID format is invalid');
  }
  return value;
}
