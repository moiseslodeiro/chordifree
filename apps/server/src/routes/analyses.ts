import { mkdir } from 'node:fs/promises';
import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { AppConfig } from '../config';
import { ApiError, errorBody, toApiError } from '../errors';
import type { JobQueue } from '../jobs/queue';
import type { Job, JobStore } from '../jobs/store';
import { analyzeUpload, analyzeYoutube } from '../services/analysis';
import type { AnalyzerClient } from '../services/analyzer';
import type { TemporaryAudioCache } from '../services/audio-cache';
import type { AnalysisCacheStore } from '../services/analysis-cache';
import { isAllowedAudioExtension, looksLikeAudio } from '../services/audio-signature';
import type { MediaTools } from '../services/media';
import type { AnalysisResult } from '../types';
import { extractVideoId } from '../youtube';

const YoutubeSchema = z
  .object({
    youtubeUrl: z.string().min(1, 'Missing YouTube link'),
    force: z.boolean().optional(),
  })
  .strict();

export interface AnalysesRouterDeps {
  config: AppConfig;
  store: JobStore;
  queue: JobQueue;
  tools: MediaTools;
  analyzer: AnalyzerClient;
  audioCache: TemporaryAudioCache;
  analysisCache: AnalysisCacheStore;
}

function startJob(
  job: Job,
  task: (report: (progress: number) => void) => Promise<AnalysisResult>,
  deps: AnalysesRouterDeps,
): void {
  void Promise.resolve()
    .then(() =>
      deps.queue.add(async () => {
        deps.store.update(job.id, { status: 'processing', progress: 1 });
        const report = (progress: number) => deps.store.update(job.id, { progress });
        const startedAt = Date.now();
        const source =
          job.source.type === 'youtube'
            ? `youtube ${job.source.videoId}`
            : `${job.source.type} ${job.source.filename}`;
        console.info(`[analysis] ${job.id} started (${source})`);
        try {
          const result = await task(report);
          if (!deps.store.get(job.id)) return;
          if (job.source.type === 'youtube') {
            await deps.analysisCache
              .set(job.source.videoId, result.analyzerVersion, result)
              .catch(() => undefined);
          }
          deps.store.update(job.id, { status: 'done', progress: 100, result });
          if (job.source.type === 'youtube') {
            deps.store.indexVideo(job.source.videoId, job.id, result.analyzerVersion);
          }
          console.info(`[analysis] ${job.id} done in ${Date.now() - startedAt}ms`);
        } catch (error) {
          const apiError = toApiError(error);
          deps.store.update(job.id, {
            status: 'error',
            error: { code: apiError.code, message: apiError.message },
          });
          console.error(
            `[analysis] ${job.id} failed in ${Date.now() - startedAt}ms (${source}): ` +
              `${apiError.code}: ${apiError.message}`,
          );
        }
      }),
    )
    .catch(() => undefined);
}

export function createAnalysesRouter(deps: AnalysesRouterDeps): Router {
  const router = Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: deps.config.maxUploadBytes, files: 1 },
  });

  const limiter = rateLimit({
    keyGenerator: (req) => req.authUser?.uid ?? req.ip ?? 'unknown',
    windowMs: deps.config.rateLimitWindowMs,
    limit: deps.config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.setHeader('Retry-After', String(Math.ceil(deps.config.rateLimitWindowMs / 1000)));
      res.status(429).json(errorBody('RATE_LIMITED', 'Too many analyses. Try again later.'));
    },
  });

  router.post('/', limiter, upload.single('file'), async (req, res, next) => {
    try {
      if (req.file) {
        const { originalname, buffer } = req.file;
        if (!isAllowedAudioExtension(originalname)) {
          throw new ApiError('INVALID_AUDIO', 'Unsupported audio format');
        }
        if (!looksLikeAudio(buffer)) {
          throw new ApiError('INVALID_AUDIO', 'The file does not look like valid audio');
        }

        await mkdir(deps.config.tempDir, { recursive: true });
        const source = { type: 'upload' as const, filename: originalname };
        const job = deps.store.create(source);
        startJob(job, (report) => analyzeUpload(originalname, buffer, deps, report), deps);
        res.status(202).json(deps.store.toView(job));
        return;
      }

      if (!req.is('application/json')) {
        throw new ApiError('UNSUPPORTED_MEDIA', 'Send JSON or a multipart file');
      }

      const parsed = YoutubeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError('INVALID_REQUEST', 'The body must include youtubeUrl');
      }

      const videoId = extractVideoId(parsed.data.youtubeUrl);
      const source = { type: 'youtube' as const, videoId };
      if (!parsed.data.force) {
        const cached = deps.store.findByVideo(videoId, deps.config.analyzerVersion);
        if (cached) {
          res.status(202).json(deps.store.toView(cached));
          return;
        }
        const persistent = await deps.analysisCache.get(videoId, deps.config.analyzerVersion);
        if (persistent) {
          const job = deps.store.create(source);
          deps.store.update(job.id, {
            status: 'done',
            progress: 100,
            result: persistent,
          });
          deps.store.indexVideo(videoId, job.id, persistent.analyzerVersion);
          res.status(202).json(deps.store.toView(job));
          return;
        }
      }

      await mkdir(deps.config.tempDir, { recursive: true });
      const job = deps.store.create(source);
      startJob(job, (report) => analyzeYoutube(videoId, deps, report), deps);
      res.status(202).json(deps.store.toView(job));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', (req, res, next) => {
    try {
      if (!deps.store.remove(req.params.id)) {
        throw new ApiError('NOT_FOUND', 'Analysis not found');
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', (req, res, next) => {
    try {
      const job = deps.store.get(req.params.id);
      if (!job) {
        throw new ApiError('NOT_FOUND', 'Analysis not found');
      }
      res.json(deps.store.toView(job));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
