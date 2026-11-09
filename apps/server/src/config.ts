import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  ANALYZER_URL: z.string().url().default('http://localhost:8000'),
  MAX_DURATION_SECONDS: z.coerce.number().positive().default(900),
  MAX_UPLOAD_BYTES: z.coerce.number().positive().default(25 * 1024 * 1024),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60 * 60 * 1000),
  TEMP_DIR: z.string().default('./.tmp'),
  YTDLP_PATH: z.string().default('yt-dlp'),
  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),
  ANALYZER_VERSION: z.string().default('essentia-1.6'),
});

export interface AppConfig {
  port: number;
  corsOrigin: string;
  analyzerUrl: string;
  maxDurationSeconds: number;
  maxUploadBytes: number;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  tempDir: string;
  ytdlpPath: string;
  ffmpegPath: string;
  ffprobePath: string;
  analyzerVersion: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.parse(env);
  return {
    port: parsed.PORT,
    corsOrigin: parsed.CORS_ORIGIN,
    analyzerUrl: parsed.ANALYZER_URL,
    maxDurationSeconds: parsed.MAX_DURATION_SECONDS,
    maxUploadBytes: parsed.MAX_UPLOAD_BYTES,
    rateLimitMax: parsed.RATE_LIMIT_MAX,
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    tempDir: parsed.TEMP_DIR,
    ytdlpPath: parsed.YTDLP_PATH,
    ffmpegPath: parsed.FFMPEG_PATH,
    ffprobePath: parsed.FFPROBE_PATH,
    analyzerVersion: parsed.ANALYZER_VERSION,
  };
}
