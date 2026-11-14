import { z } from 'zod';

const EnvSchema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  ANALYZER_URL: z.string().url().default('http://localhost:8001'),
  ANALYZER_TOKEN: z.string().default(''),
  WEB_DIST: z.string().optional(),
  MAX_DURATION_SECONDS: z.coerce.number().positive().default(900),
  MAX_UPLOAD_BYTES: z.coerce.number().positive().default(25 * 1024 * 1024),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60 * 60 * 1000),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  TEMP_DIR: z.string().default('./.tmp'),
  AUDIO_CACHE_TTL_MINUTES: z.coerce.number().int().nonnegative().optional(),
  YTDLP_PATH: z.string().default('yt-dlp'),
  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),
  ANALYZER_VERSION: z.string().default('essentia-1.6'),
});

export interface AppConfig {
  host: string;
  port: number;
  corsOrigin: string;
  analyzerUrl: string;
  analyzerToken: string;
  webDist?: string;
  maxDurationSeconds: number;
  maxUploadBytes: number;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  trustProxy: number;
  tempDir: string;
  audioCacheTtlMinutes: number;
  ytdlpPath: string;
  ffmpegPath: string;
  ffprobePath: string;
  analyzerVersion: string;
}

/** True for loopback hosts and origins, where the cache should persist. */
function isLocalHost(value: string): boolean {
  const host = value.trim().toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
    return true;
  }
  try {
    const url = new URL(value);
    return (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '::1' ||
      url.hostname === '[::1]'
    );
  } catch {
    return false;
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.parse(env);
  const local = isLocalHost(parsed.HOST) || isLocalHost(parsed.CORS_ORIGIN);
  return {
    host: parsed.HOST,
    port: parsed.PORT,
    corsOrigin: parsed.CORS_ORIGIN,
    analyzerUrl: parsed.ANALYZER_URL,
    analyzerToken: parsed.ANALYZER_TOKEN,
    ...(parsed.WEB_DIST ? { webDist: parsed.WEB_DIST } : {}),
    maxDurationSeconds: parsed.MAX_DURATION_SECONDS,
    maxUploadBytes: parsed.MAX_UPLOAD_BYTES,
    rateLimitMax: parsed.RATE_LIMIT_MAX,
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    trustProxy: parsed.TRUST_PROXY,
    tempDir: parsed.TEMP_DIR,
    // Local installs keep the cache until the user clears it; hosted servers expire it.
    audioCacheTtlMinutes: parsed.AUDIO_CACHE_TTL_MINUTES ?? (local ? 0 : 60),
    ytdlpPath: parsed.YTDLP_PATH,
    ffmpegPath: parsed.FFMPEG_PATH,
    ffprobePath: parsed.FFPROBE_PATH,
    analyzerVersion: parsed.ANALYZER_VERSION,
  };
}
