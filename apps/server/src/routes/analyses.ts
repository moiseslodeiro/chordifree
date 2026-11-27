import { mkdir } from 'node:fs/promises';
import { Router, type Request } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { AppConfig } from '../config';
import { ApiError, errorBody, toApiError } from '../errors';
import type { JobQueue } from '../jobs/queue';
import type { AnalysisJobStore, Job, JobRequester } from '../jobs/store';
import { analyzeUpload, analyzeYoutube } from '../services/analysis';
import type { AnalyzerClient } from '../services/analyzer';
import type { TemporaryAudioCache } from '../services/audio-cache';
import type { AnalysisCacheStore } from '../services/analysis-cache';
import type { AnalysisLogStore } from '../services/analysis-log';
import { resolveNickname, type ProfileStore } from '../services/profiles';
import { isAllowedAudioExtension, looksLikeAudio } from '../services/audio-signature';
import type { MediaTools } from '../services/media';
import type { AnalysisResult } from '../types';
import { extractVideoId } from '../youtube';
import type { AnalysisInputStore, AnalysisJobDispatcher } from '../services/cloud-run-analysis';
import type { AnalysisQuota } from '../services/analysis-quota';

const YoutubeSchema = z
  .object({
    youtubeUrl: z.string().min(1, 'Missing YouTube link'),
    force: z.boolean().optional(),
  })
  .strict();

const JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jobIdFromParams(value: string): string {
  if (!JOB_ID_PATTERN.test(value)) throw new ApiError('NOT_FOUND', 'Analysis not found');
  return value;
}

export interface AnalysesRouterDeps {
  config: AppConfig;
  store: AnalysisJobStore;
  queue: JobQueue;
  tools: MediaTools;
  analyzer: AnalyzerClient;
  audioCache: TemporaryAudioCache;
  analysisCache: AnalysisCacheStore;
  analysisLog: AnalysisLogStore;
  profiles: ProfileStore;
  analysisDispatcher?: AnalysisJobDispatcher;
  analysisInputs?: AnalysisInputStore;
  analysisQuota?: AnalysisQuota;
}

async function assertWithinQuota(req: Request, deps: AnalysesRouterDeps): Promise<void> {
  const uid = req.authUser?.uid;
  if (!uid || !deps.analysisQuota) return;
  if (!(await deps.analysisQuota.consume(uid))) {
    throw new ApiError(
      'QUOTA_EXCEEDED',
      'The daily analysis quota is exhausted. Try again tomorrow.',
    );
  }
}

async function requesterFor(
  user: { uid: string; email: string } | undefined,
  deps: AnalysesRouterDeps,
): Promise<JobRequester | undefined> {
  if (!user) return undefined;
  return {
    uid: user.uid,
    email: user.email,
    nickname: await resolveNickname(deps.profiles, user),
  };
}

function startInProcessJob(
  job: Job,
  task: (report: (progress: number) => void) => Promise<AnalysisResult>,
  deps: AnalysesRouterDeps,
): void {
  void Promise.resolve()
    .then(() =>
      deps.queue.add(async () => {
        await deps.store.update(job.id, { status: 'processing', progress: 1 });
        const report = (progress: number) => {
          void deps.store.update(job.id, { progress });
        };
        const startedAt = Date.now();
        const source =
          job.source.type === 'youtube'
            ? `youtube ${job.source.videoId}`
            : `${job.source.type} ${job.source.filename}`;
        console.info(`[analysis] ${job.id} started (${source})`);
        try {
          const result = await task(report);
          if (!(await deps.store.get(job.id))) return;
          if (job.source.type === 'youtube') {
            await deps.analysisCache
              .set(job.source.videoId, result.analyzerVersion, result)
              .catch(() => undefined);
          }
          if (job.requestedBy) {
            const logSource = result.source;
            await deps.analysisLog
              .record({
                ...job.requestedBy,
                kind: logSource.type,
                ...(logSource.type === 'youtube'
                  ? {
                      videoId: logSource.videoId,
                      ...(logSource.title ? { title: logSource.title } : {}),
                    }
                  : { filename: logSource.filename }),
                duration: result.duration,
                chords: result.segments.filter((segment) => segment.chord !== null).length,
                analyzerVersion: result.analyzerVersion,
              })
              .catch(() => undefined);
          }
          await deps.store.update(job.id, { status: 'done', progress: 100, result });
          if (job.source.type === 'youtube') {
            await deps.store.indexVideo(job.source.videoId, job.id, result.analyzerVersion);
          }
          console.info(`[analysis] ${job.id} done in ${Date.now() - startedAt}ms`);
        } catch (error) {
          const apiError = toApiError(error);
          await deps.store.update(job.id, {
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

async function dispatchCloudJob(
  job: Job,
  deps: AnalysesRouterDeps,
  upload?: Buffer,
): Promise<void> {
  let chunkCount: number | undefined;
  try {
    if (!deps.analysisDispatcher) throw new Error('Cloud analysis jobs are not configured');
    if (upload) {
      if (!deps.analysisInputs) throw new Error('Cloud analysis input storage is not configured');
      chunkCount = await deps.analysisInputs.put(job.id, upload);
      await deps.store.update(job.id, { inputChunkCount: chunkCount });
    }
    await deps.analysisDispatcher.dispatch(job.id);
  } catch (error) {
    if (chunkCount) await deps.analysisInputs?.delete(job.id, chunkCount).catch(() => undefined);
    const apiError = toApiError(error);
    await deps.store.update(job.id, {
      status: 'error',
      error: { code: apiError.code, message: apiError.message },
    });
  }
}

export function createAnalysesRouter(deps: AnalysesRouterDeps): Router {
  const router = Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    // Uploads accept exactly one file and no form fields. Bound multipart
    // parser work as well as the file buffer size.
    limits: { fileSize: deps.config.maxUploadBytes, files: 1, fields: 0, parts: 1 },
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

        await assertWithinQuota(req, deps);
        await mkdir(deps.config.tempDir, { recursive: true });
        const source = { type: 'upload' as const, filename: originalname };
        const job = await deps.store.create(source, await requesterFor(req.authUser, deps));
        let view = deps.store.toView(job);
        if (deps.analysisDispatcher) {
          await dispatchCloudJob(job, deps, buffer);
          // The dispatch step can mark the job as failed.
          view = deps.store.toView((await deps.store.get(job.id)) ?? job);
        } else {
          startInProcessJob(
            job,
            (report) => analyzeUpload(originalname, buffer, deps, report),
            deps,
          );
        }
        res.status(202).json(view);
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
        const cached = await deps.store.findByVideo(videoId, deps.config.analyzerVersion);
        if (cached) {
          res.status(202).json(deps.store.toView(cached));
          return;
        }
        const persistent = await deps.analysisCache.get(videoId, deps.config.analyzerVersion);
        if (persistent) {
          const job = await deps.store.create(source);
          await deps.store.update(job.id, {
            status: 'done',
            progress: 100,
            result: persistent,
          });
          await deps.store.indexVideo(videoId, job.id, persistent.analyzerVersion);
          res.status(202).json(deps.store.toView((await deps.store.get(job.id)) ?? job));
          return;
        }
      }

      await assertWithinQuota(req, deps);
      await mkdir(deps.config.tempDir, { recursive: true });
      const job = await deps.store.create(source, await requesterFor(req.authUser, deps));
      let view = deps.store.toView(job);
      if (deps.analysisDispatcher) {
        await dispatchCloudJob(job, deps);
        // The dispatch step can mark the job as failed.
        view = deps.store.toView((await deps.store.get(job.id)) ?? job);
      } else {
        startInProcessJob(job, (report) => analyzeYoutube(videoId, deps, report), deps);
      }
      res.status(202).json(view);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      if (!(await deps.store.remove(jobIdFromParams(req.params.id)))) {
        throw new ApiError('NOT_FOUND', 'Analysis not found');
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const job = await deps.store.get(jobIdFromParams(req.params.id));
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
