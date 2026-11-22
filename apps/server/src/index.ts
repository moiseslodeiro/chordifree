import { shutdownTracing } from './tracing';
import { mkdir } from 'node:fs/promises';
import { createApp } from './app';
import { FirestoreAnalysisJobStore, JobStore } from './jobs/store';
import { createFirestore } from './services/auth';
import { loadConfig } from './config';
import { audioCacheDirectory, sweepAudioCache } from './services/audio-cache';
import { sweepTempDirectory } from './services/cleanup';

const config = loadConfig();

await mkdir(config.tempDir, { recursive: true });
const store =
  config.analysisJobName && config.authMode === 'google'
    ? new FirestoreAnalysisJobStore(createFirestore(config))
    : new JobStore();
const app = createApp({ config, store });

const server = app.listen(config.port, config.host, () => {
  console.log(`Chordifree API listening on http://${config.host}:${config.port}`);
});

const sweep = () => {
  void sweepTempDirectory(config.tempDir).catch(() => undefined);
  void sweepAudioCache(
    audioCacheDirectory(config.tempDir),
    config.audioCacheTtlMinutes * 60_000,
  ).catch(() => undefined);
};
sweep();
const sweeper = setInterval(sweep, 10 * 60 * 1000);
const storeSweeper = setInterval(() => void store.sweep(), 10 * 60 * 1000);

const shutdown = (signal: string) => {
  console.log(`Received ${signal}, shutting down...`);
  clearInterval(sweeper);
  clearInterval(storeSweeper);
  server.close(() => {
    void shutdownTracing()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
