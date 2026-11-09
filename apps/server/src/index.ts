import { mkdir } from 'node:fs/promises';
import { createApp } from './app';
import { loadConfig } from './config';
import { sweepTempDirectory } from './services/cleanup';

const config = loadConfig();

await mkdir(config.tempDir, { recursive: true });
const app = createApp({ config });

const server = app.listen(config.port, () => {
  console.log(`Chordifree API listening on http://localhost:${config.port}`);
});

const sweep = () => {
  void sweepTempDirectory(config.tempDir).catch(() => undefined);
};
sweep();
const sweeper = setInterval(sweep, 10 * 60 * 1000);

const shutdown = (signal: string) => {
  console.log(`Received ${signal}, shutting down...`);
  clearInterval(sweeper);
  server.close(() => process.exit(0));
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
