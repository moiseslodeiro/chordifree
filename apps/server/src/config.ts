import { z } from 'zod';

const EnvSchema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  ANALYZER_URL: z.string().url().default('http://localhost:8001'),
  ANALYZER_TOKEN: z.string().default(''),
  WEB_DIST: z.string().optional(),
  MAX_DURATION_SECONDS: z.coerce.number().positive().default(900),
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .positive()
    .default(25 * 1024 * 1024),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 1000),
  ANALYSIS_DAILY_QUOTA: z.coerce.number().int().nonnegative().default(50),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  TEMP_DIR: z.string().default('./.tmp'),
  AUDIO_CACHE_TTL_MINUTES: z.coerce.number().int().nonnegative().optional(),
  YTDLP_PATH: z.string().default('yt-dlp'),
  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),
  ANALYZER_VERSION: z.string().default('essentia-1.6'),
  AUTH_MODE: z.enum(['none', 'google']).default('none'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  ADMIN_EMAILS: z.string().default(''),
  GOOGLE_CLOUD_PROJECT: z.string().default(''),
  FIRESTORE_DATABASE: z.string().default('(default)'),
  CLOUD_RUN_REGION: z.string().default(''),
  ANALYSIS_JOB_NAME: z.string().default(''),
  ANALYZER_AUTH: z.enum(['token', 'google']).default('token'),
  YOUTUBE_EXTRACTOR_URL: z.union([z.literal(''), z.string().url()]).default(''),
  YOUTUBE_EXTRACTOR_TOKEN: z.string().default(''),
  YOUTUBE_EXTRACTOR_TIMEOUT_MS: z.coerce.number().int().min(1000).default(240_000),
  STEMS_PLUGIN_DIR: z.string().default(''),
  STEMS_SETUP_DIR: z.string().default(''),
  STEMS_PLUGIN_SOURCE: z.string().default(''),
  STEMS_SERVICE_URL: z.union([z.literal(''), z.string().url()]).default(''),
  STEMS_SERVICE_TOKEN: z.string().default(''),
  STEMS_SERVICE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(60_000)
    .default(30 * 60 * 1000),
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
  analysisDailyQuota: number;
  trustProxy: number;
  tempDir: string;
  audioCacheTtlMinutes: number;
  ytdlpPath: string;
  ffmpegPath: string;
  ffprobePath: string;
  analyzerVersion: string;
  authMode: 'none' | 'google';
  googleClientId: string;
  adminEmails: string[];
  googleCloudProject: string;
  firestoreDatabase: string;
  cloudRunRegion?: string;
  analysisJobName?: string;
  analyzerAuth: 'token' | 'google';
  youtubeExtractorUrl?: string;
  youtubeExtractorToken: string;
  youtubeExtractorTimeoutMs: number;
  stemsPluginDir?: string;
  stemsSetupDir?: string;
  stemsPluginSource?: string;
  /** Loopback host/origin: local plugins and the setup UI are allowed. */
  local: boolean;
  stemsServiceUrl?: string;
  stemsServiceToken: string;
  stemsServiceTimeoutMs: number;
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

type Env = z.infer<typeof EnvSchema>;

function trimOrUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Drops empty and undefined values so optional fields stay absent. */
function compact<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<T>;
}

function parseAdminEmails(raw: string): string[] {
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

function assertAnalysisJobConfig(env: Env, jobName: string, region: string): void {
  if (!jobName) return;
  if (!region || !env.GOOGLE_CLOUD_PROJECT.trim()) {
    throw new Error('CLOUD_RUN_REGION and GOOGLE_CLOUD_PROJECT are required for analysis jobs');
  }
  if (env.AUTH_MODE !== 'google') {
    throw new Error('AUTH_MODE=google is required for Cloud Run analysis jobs');
  }
}

function assertExtractorConfig(env: Env, extractorUrl: string): void {
  if (extractorUrl && !env.YOUTUBE_EXTRACTOR_TOKEN.trim()) {
    throw new Error('YOUTUBE_EXTRACTOR_TOKEN is required when YOUTUBE_EXTRACTOR_URL is set');
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.parse(env);
  const local = isLocalHost(parsed.HOST) || isLocalHost(parsed.CORS_ORIGIN);
  const youtubeExtractorUrl = parsed.YOUTUBE_EXTRACTOR_URL.trim();
  const analysisJobName = parsed.ANALYSIS_JOB_NAME.trim();
  const cloudRunRegion = parsed.CLOUD_RUN_REGION.trim();
  assertAnalysisJobConfig(parsed, analysisJobName, cloudRunRegion);
  assertExtractorConfig(parsed, youtubeExtractorUrl);

  const optional = compact({
    webDist: parsed.WEB_DIST,
    cloudRunRegion: trimOrUndefined(parsed.CLOUD_RUN_REGION),
    analysisJobName: trimOrUndefined(parsed.ANALYSIS_JOB_NAME),
    youtubeExtractorUrl: trimOrUndefined(parsed.YOUTUBE_EXTRACTOR_URL),
    stemsPluginDir: trimOrUndefined(parsed.STEMS_PLUGIN_DIR),
    stemsSetupDir: trimOrUndefined(parsed.STEMS_SETUP_DIR),
    stemsPluginSource: trimOrUndefined(parsed.STEMS_PLUGIN_SOURCE),
    stemsServiceUrl: trimOrUndefined(parsed.STEMS_SERVICE_URL),
  });

  return {
    host: parsed.HOST,
    port: parsed.PORT,
    corsOrigin: parsed.CORS_ORIGIN,
    analyzerUrl: parsed.ANALYZER_URL,
    analyzerToken: parsed.ANALYZER_TOKEN,
    maxDurationSeconds: parsed.MAX_DURATION_SECONDS,
    maxUploadBytes: parsed.MAX_UPLOAD_BYTES,
    rateLimitMax: parsed.RATE_LIMIT_MAX,
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    analysisDailyQuota: parsed.ANALYSIS_DAILY_QUOTA,
    trustProxy: parsed.TRUST_PROXY,
    tempDir: parsed.TEMP_DIR,
    // Local installs keep the cache until the user clears it; hosted servers expire it.
    audioCacheTtlMinutes: parsed.AUDIO_CACHE_TTL_MINUTES ?? (local ? 0 : 60),
    ytdlpPath: parsed.YTDLP_PATH,
    ffmpegPath: parsed.FFMPEG_PATH,
    ffprobePath: parsed.FFPROBE_PATH,
    analyzerVersion: parsed.ANALYZER_VERSION,
    authMode: parsed.AUTH_MODE,
    googleClientId: parsed.GOOGLE_CLIENT_ID,
    adminEmails: parseAdminEmails(parsed.ADMIN_EMAILS),
    googleCloudProject: parsed.GOOGLE_CLOUD_PROJECT,
    firestoreDatabase: parsed.FIRESTORE_DATABASE,
    analyzerAuth: parsed.ANALYZER_AUTH,
    youtubeExtractorToken: parsed.YOUTUBE_EXTRACTOR_TOKEN,
    youtubeExtractorTimeoutMs: parsed.YOUTUBE_EXTRACTOR_TIMEOUT_MS,
    local,
    stemsServiceToken: parsed.STEMS_SERVICE_TOKEN.trim(),
    stemsServiceTimeoutMs: parsed.STEMS_SERVICE_TIMEOUT_MS,
    ...optional,
  };
}
