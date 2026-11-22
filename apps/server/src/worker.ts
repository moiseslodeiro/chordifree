import { mkdir } from 'node:fs/promises';
import { FirestoreAnalysisJobStore } from './jobs/store';
import { loadConfig } from './config';
import { toApiError } from './errors';
import { createFirestore, createGoogleIdTokenProvider } from './services/auth';
import { audioCacheDirectory, TemporaryAudioCache } from './services/audio-cache';
import { createAnalyzerClient } from './services/analyzer';
import { analyzeUpload, analyzeYoutube } from './services/analysis';
import { FirestoreAnalysisInputStore } from './services/cloud-run-analysis';
import { FirestoreAnalysisCache } from './services/analysis-cache';
import { FirestoreAnalysisLogStore } from './services/analysis-log';
import { createMediaTools } from './services/media';
import type { AnalysisResult } from './types';

const JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function run(): Promise<void> {
  const config = loadConfig();
  const jobId = process.env.ANALYSIS_JOB_ID ?? '';
  if (!JOB_ID_PATTERN.test(jobId)) throw new Error('A valid ANALYSIS_JOB_ID is required');

  const firestore = createFirestore(config);
  const store = new FirestoreAnalysisJobStore(firestore);
  const inputStore = new FirestoreAnalysisInputStore(firestore);
  const job = await store.get(jobId);
  if (!job) throw new Error('Analysis job not found');
  if (job.status === 'done' || job.status === 'error') return;

  await store.update(job.id, { status: 'processing', progress: 1 });
  const tools = createMediaTools(config);
  const audioCache = new TemporaryAudioCache({
    directory: audioCacheDirectory(config.tempDir),
    workspaceRoot: config.tempDir,
    ttlMs: config.audioCacheTtlMinutes * 60_000,
    tools,
  });
  const analyzerTokenProvider =
    config.analyzerAuth === 'google' ? createGoogleIdTokenProvider(config.analyzerUrl) : undefined;
  const analyzer = createAnalyzerClient(
    config.analyzerUrl,
    fetch,
    config.analyzerToken,
    analyzerTokenProvider,
  );
  let progressWrites = Promise.resolve();
  const report = (progress: number) => {
    progressWrites = progressWrites
      .then(() => store.update(job.id, { progress }))
      .then(() => undefined);
  };

  try {
    await mkdir(config.tempDir, { recursive: true });
    const dependencies = { config, tools, analyzer, audioCache };
    let result: AnalysisResult;
    if (job.source.type === 'youtube') {
      result = await analyzeYoutube(job.source.videoId, dependencies, report);
    } else if (job.source.type === 'upload' && job.inputChunkCount) {
      const payload = await inputStore.get(job.id, job.inputChunkCount);
      result = await analyzeUpload(job.source.filename, payload, dependencies, report);
    } else {
      throw new Error('Analysis job has an unsupported source');
    }
    await progressWrites;

    if (job.source.type === 'youtube') {
      const cache = new FirestoreAnalysisCache(firestore);
      await cache.set(job.source.videoId, result.analyzerVersion, result);
      await store.indexVideo(job.source.videoId, job.id, result.analyzerVersion);
    }
    if (job.requestedBy) {
      const logSource = result.source;
      await new FirestoreAnalysisLogStore(firestore).record({
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
      });
    }
    await store.update(job.id, { status: 'done', progress: 100, result });
    console.info(`[analysis-worker] ${job.id} done`);
  } catch (error) {
    const apiError = toApiError(error);
    await store.update(job.id, {
      status: 'error',
      error: { code: apiError.code, message: apiError.message },
    });
    console.error(`[analysis-worker] ${job.id} failed (${apiError.code})`);
    process.exitCode = 1;
  } finally {
    await progressWrites.catch(() => undefined);
    if (job.inputChunkCount) {
      await inputStore.delete(job.id, job.inputChunkCount).catch(() => undefined);
    }
  }
}

await run();
