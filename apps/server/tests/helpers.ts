import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AppConfig } from '../src/config';
import type { AnalyzerClient } from '../src/services/analyzer';
import type { MediaTools } from '../src/services/media';
import type { RawAnalysis } from '../src/types';

export function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    host: '127.0.0.1',
    port: 3001,
    corsOrigin: 'http://localhost:5173',
    analyzerUrl: 'http://localhost:8001',
    analyzerToken: '',
    maxDurationSeconds: 900,
    maxUploadBytes: 25 * 1024 * 1024,
    rateLimitMax: 100,
    rateLimitWindowMs: 60_000,
    trustProxy: 1,
    tempDir: join(tmpdir(), 'chordifree-test'),
    audioCacheTtlMinutes: 60,
    ytdlpPath: 'yt-dlp',
    ffmpegPath: 'ffmpeg',
    ffprobePath: 'ffprobe',
    analyzerVersion: 'essentia-test',
    ...overrides,
  };
}

export const defaultRawAnalysis: RawAnalysis = {
  segments: [
    { start: 0, end: 60, label: 'C', confidence: 0.9 },
    { start: 60, end: 120, label: 'G', confidence: 0.8 },
  ],
  duration: 120,
  beats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
  beatsPerBar: 4,
  analyzerVersion: 'essentia-test',
};

export function makeTools(overrides: Partial<MediaTools> = {}): MediaTools {
  return {
    probeYoutube: async () => ({ duration: 120, title: 'Canción de prueba' }),
    searchYoutube: async () => [],
    downloadYoutube: async (videoId, directory) => {
      const { writeFile } = await import('node:fs/promises');
      const path = join(directory, `${videoId}.webm`);
      await writeFile(path, 'audio');
      return path;
    },
    convertToWav: async (_input, output) => {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(output, 'wav');
    },
    probeAudio: async () => ({ duration: 120, codec: 'pcm_s16le', channels: 2 }),
    ...overrides,
  };
}

export function makeAnalyzer(overrides: Partial<AnalyzerClient> = {}): AnalyzerClient {
  return {
    health: async () => ({ ok: true, version: 'essentia-test' }),
    analyze: async () => defaultRawAnalysis,
    ...overrides,
  };
}

export async function makeTempDir(prefix = 'chordifree-test-'): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export function wavBuffer(size = 64): Buffer {
  const header = Buffer.alloc(12);
  header.write('RIFF', 0);
  header.writeUInt32LE(size, 4);
  header.write('WAVE', 8);
  return Buffer.concat([header, Buffer.alloc(size)]);
}
