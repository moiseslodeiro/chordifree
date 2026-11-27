import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { loadConfig, type AppConfig } from './config';
import { ApiError, errorBody } from './errors';
import { JobQueue } from './jobs/queue';
import { FirestoreAnalysisJobStore, JobStore, type AnalysisJobStore } from './jobs/store';
import { createAnalysesRouter } from './routes/analyses';
import { createLyricsRouter } from './routes/lyrics';
import { createCloudLibraryRouter } from './routes/cloud-library';
import { createAdminAnalysesRouter } from './routes/admin-analyses';
import { createCollabRouter } from './routes/collab';
import { createProfileRouter } from './routes/profile';
import { createStemsRouter } from './routes/stems';
import { createAccountRouter } from './routes/account';
import { createConfigRouter } from './routes/config';
import { FirestoreCloudLibraryStore, type CloudLibraryStore } from './services/cloud-library';
import { createYoutubeRouter } from './routes/youtube';
import { createAnalyzerClient, type AnalyzerClient } from './services/analyzer';
import {
  createAdminRouter,
  createAuthContext,
  createAuthRouter,
  createFirestore,
  createGoogleIdTokenProvider,
  requireAllowed,
  type AuthContext,
} from './services/auth';
import { audioCacheDirectory, TemporaryAudioCache } from './services/audio-cache';
import { createLyricsClient, type LyricsClient } from './services/lyrics';
import {
  FirestoreAnalysisCache,
  MemoryAnalysisCache,
  type AnalysisCacheStore,
} from './services/analysis-cache';
import { createMediaTools, type MediaTools } from './services/media';
import { FirestoreCollabStore, MemoryCollabStore, type CollabStore } from './services/collab';
import { FirestoreProfileStore, MemoryProfileStore, type ProfileStore } from './services/profiles';
import {
  FirestoreAnalysisLogStore,
  MemoryAnalysisLogStore,
  type AnalysisLogStore,
} from './services/analysis-log';
import { StemJobs } from './services/stem-jobs';
import { FirestoreAnalysisQuota, type AnalysisQuota } from './services/analysis-quota';
import { StemCache } from './services/stem-cache';
import {
  CloudRunAnalysisJobDispatcher,
  FirestoreAnalysisInputStore,
  type AnalysisInputStore,
  type AnalysisJobDispatcher,
} from './services/cloud-run-analysis';
import { StemInstaller, type StemInstallerLike } from './services/stem-installer';
import {
  NullStemEngine,
  PluginStemEngine,
  RemoteStemEngine,
  type StemEngine,
} from './services/stems';

const here = dirname(fileURLToPath(import.meta.url));

export interface AppDependencies {
  config: AppConfig;
  store: AnalysisJobStore;
  queue: JobQueue;
  tools: MediaTools;
  analyzer: AnalyzerClient;
  lyrics: LyricsClient;
  audioCache: TemporaryAudioCache;
  auth: AuthContext;
  cloudLibrary: CloudLibraryStore | null;
  analysisCache: AnalysisCacheStore;
  profiles: ProfileStore;
  collab: CollabStore;
  analysisLog: AnalysisLogStore;
  stemsEngine: StemEngine;
  stems: StemJobs;
  stemsCache: StemCache;
  stemsSetup?: StemInstallerLike;
  analysisDispatcher?: AnalysisJobDispatcher;
  analysisInputs?: AnalysisInputStore;
  analysisQuota?: AnalysisQuota;
  webDist: string;
}

export interface CreateAppOptions extends Partial<AppDependencies> {
  config?: AppConfig;
}

interface ExtractorHealth {
  ok: boolean;
  version?: string;
}

/** Checks the optional residential extractor without making /api/health fail. */
async function checkExtractor(url: string): Promise<ExtractorHealth> {
  try {
    const response = await fetch(`${url.replace(/\/+$/, '')}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ok: false };
    const body = (await response.json()) as {
      status?: string;
      extractorVersion?: string;
    };
    return {
      ok: body.status === 'ok',
      ...(body.extractorVersion ? { version: body.extractorVersion } : {}),
    };
  } catch {
    return { ok: false };
  }
}

/**
 * Rejects browser writes from another origin. CORS only controls whether the
 * response can be read; a cross-site form or multipart POST is still executed
 * unless the server refuses it explicitly.
 */
function sameOriginWriteGuard(config: AppConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }

    const origin = req.get('origin');
    const fetchSite = req.get('sec-fetch-site');
    if (!origin) {
      if (fetchSite === 'cross-site' || fetchSite === 'same-site') {
        res.status(403).json(errorBody('FORBIDDEN', 'Cross-origin request blocked'));
        return;
      }
      next();
      return;
    }

    // Do not derive an allowed origin from the Host header. A DNS-rebinding
    // page can make Host and Origin match while both point at this local API.
    if (origin !== config.corsOrigin) {
      res.status(403).json(errorBody('FORBIDDEN', 'Cross-origin request blocked'));
      return;
    }
    next();
  };
}

function useGoogleStore<T>(config: AppConfig, firestore: () => T, fallback: () => T): T {
  return config.authMode === 'google' ? firestore() : fallback();
}

function createAnalysisDispatcher(
  options: CreateAppOptions,
  config: AppConfig,
): AnalysisJobDispatcher | undefined {
  return (
    options.analysisDispatcher ??
    (config.analysisJobName && config.cloudRunRegion
      ? new CloudRunAnalysisJobDispatcher(
          config.googleCloudProject,
          config.cloudRunRegion,
          config.analysisJobName,
        )
      : undefined)
  );
}

function createAnalysisInputs(
  options: CreateAppOptions,
  config: AppConfig,
  dispatcher: AnalysisJobDispatcher | undefined,
): AnalysisInputStore | undefined {
  return (
    options.analysisInputs ??
    (dispatcher && config.authMode === 'google'
      ? new FirestoreAnalysisInputStore(createFirestore(config))
      : undefined)
  );
}

function createAnalysisQuota(
  options: CreateAppOptions,
  config: AppConfig,
): AnalysisQuota | undefined {
  if (options.analysisQuota) return options.analysisQuota;
  if (config.authMode !== 'google' || config.analysisDailyQuota <= 0) return undefined;
  return new FirestoreAnalysisQuota(createFirestore(config), config.analysisDailyQuota);
}

function createStemsEngine(options: CreateAppOptions, config: AppConfig): StemEngine {
  return (
    options.stemsEngine ??
    (config.stemsServiceUrl
      ? new RemoteStemEngine(
          config.stemsServiceUrl,
          config.stemsServiceToken,
          config.stemsServiceTimeoutMs,
        )
      : config.stemsPluginDir
        ? new PluginStemEngine(config.stemsPluginDir)
        : new NullStemEngine())
  );
}

function createStemsSetup(
  options: CreateAppOptions,
  config: AppConfig,
): StemInstallerLike | undefined {
  if (options.stemsSetup) return options.stemsSetup;
  if (!config.local || !config.stemsSetupDir || !config.stemsPluginSource) return undefined;
  return new StemInstaller({
    pluginDir: config.stemsSetupDir,
    sourceDir: config.stemsPluginSource,
  });
}

function buildStores(
  options: CreateAppOptions,
  config: AppConfig,
  dispatcher: AnalysisJobDispatcher | undefined,
): Pick<
  AppDependencies,
  'store' | 'cloudLibrary' | 'analysisCache' | 'profiles' | 'collab' | 'analysisLog'
> {
  const store =
    options.store ??
    (dispatcher
      ? useGoogleStore<AnalysisJobStore>(
          config,
          () => new FirestoreAnalysisJobStore(createFirestore(config)),
          () => new JobStore(),
        )
      : new JobStore());

  return {
    store,
    cloudLibrary:
      options.cloudLibrary ??
      useGoogleStore<CloudLibraryStore | null>(
        config,
        () => new FirestoreCloudLibraryStore(createFirestore(config)),
        () => null,
      ),
    analysisCache:
      options.analysisCache ??
      useGoogleStore<AnalysisCacheStore>(
        config,
        () => new FirestoreAnalysisCache(createFirestore(config)),
        () => new MemoryAnalysisCache(),
      ),
    profiles:
      options.profiles ??
      useGoogleStore<ProfileStore>(
        config,
        () => new FirestoreProfileStore(createFirestore(config)),
        () => new MemoryProfileStore(),
      ),
    collab:
      options.collab ??
      useGoogleStore<CollabStore>(
        config,
        () => new FirestoreCollabStore(createFirestore(config)),
        () => new MemoryCollabStore(),
      ),
    analysisLog:
      options.analysisLog ??
      useGoogleStore<AnalysisLogStore>(
        config,
        () => new FirestoreAnalysisLogStore(createFirestore(config)),
        () => new MemoryAnalysisLogStore(),
      ),
  };
}

function buildStemsDependencies(
  options: CreateAppOptions,
  config: AppConfig,
  audioCache: TemporaryAudioCache,
): Pick<AppDependencies, 'stemsEngine' | 'stemsCache' | 'stems' | 'stemsSetup'> {
  const stemsEngine = createStemsEngine(options, config);
  const stemsCache = options.stemsCache ?? new StemCache(resolve(config.tempDir, 'stems-cache'));
  const stemsSetup = createStemsSetup(options, config);
  const stems =
    options.stems ??
    new StemJobs(stemsEngine, audioCache, resolve(config.tempDir, 'stems'), stemsCache);

  return {
    stemsEngine,
    stemsCache,
    stems,
    ...(stemsSetup ? { stemsSetup } : {}),
  };
}

function audioCacheFor(
  options: CreateAppOptions,
  config: AppConfig,
  tools: MediaTools,
): TemporaryAudioCache {
  return (
    options.audioCache ??
    new TemporaryAudioCache({
      directory: audioCacheDirectory(config.tempDir),
      workspaceRoot: config.tempDir,
      ttlMs: config.audioCacheTtlMinutes * 60_000,
      tools,
    })
  );
}

function webDistFor(options: CreateAppOptions, config: AppConfig): string {
  if (options.webDist) return options.webDist;
  if (config.webDist) return config.webDist;
  return resolve(here, '../../web/dist');
}

function buildDependencies(options: CreateAppOptions, config: AppConfig): AppDependencies {
  const analysisDispatcher = createAnalysisDispatcher(options, config);
  const analysisInputs = createAnalysisInputs(options, config, analysisDispatcher);
  const tools = options.tools ?? createMediaTools(config);
  const audioCache = audioCacheFor(options, config, tools);
  const analyzerTokenProvider =
    config.analyzerAuth === 'google' ? createGoogleIdTokenProvider(config.analyzerUrl) : undefined;

  const deps: AppDependencies = {
    config,
    ...buildStores(options, config, analysisDispatcher),
    queue: options.queue ?? new JobQueue(2),
    tools,
    analyzer:
      options.analyzer ??
      createAnalyzerClient(config.analyzerUrl, fetch, config.analyzerToken, analyzerTokenProvider),
    lyrics: options.lyrics ?? createLyricsClient(fetch),
    audioCache,
    auth: options.auth ?? createAuthContext(config),
    analysisQuota: createAnalysisQuota(options, config),
    ...buildStemsDependencies(options, config, audioCache),
    webDist: webDistFor(options, config),
  };

  if (analysisDispatcher) deps.analysisDispatcher = analysisDispatcher;
  if (analysisInputs) deps.analysisInputs = analysisInputs;
  return deps;
}

function applyBaseMiddleware(app: express.Express, config: AppConfig): void {
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://accounts.google.com'],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
            'https://accounts.google.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          mediaSrc: ["'self'", 'blob:', 'data:'],
          // The embedded YouTube player was replaced by the temporary audio
          // player; only Google Identity Services needs a frame.
          frameSrc: ["'self'", 'https://accounts.google.com'],
          connectSrc: ["'self'", 'https://accounts.google.com'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    }),
  );
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use((_req, res, next) => {
    // The microphone is used by the local practice helper; camera and
    // geolocation are never needed.
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
    next();
  });
  app.use('/api', sameOriginWriteGuard(config));
}

function registerHealthRoute(app: express.Express, deps: AppDependencies, config: AppConfig): void {
  app.get('/api/health', async (_req, res) => {
    const [health, extractor] = await Promise.all([
      deps.analyzer.health(),
      deps.config.youtubeExtractorUrl
        ? checkExtractor(deps.config.youtubeExtractorUrl)
        : Promise.resolve(null),
    ]);
    res.json({
      status: 'ok',
      analyzer: health.ok ? 'ok' : 'down',
      analyzerVersion: health.version ?? config.analyzerVersion,
      ...(extractor
        ? {
            extractor: extractor.ok ? 'ok' : 'down',
            ...(extractor.version ? { extractorVersion: extractor.version } : {}),
          }
        : {}),
    });
  });
}

function mountApiRoutes(app: express.Express, deps: AppDependencies, config: AppConfig): void {
  app.use('/api/config', createConfigRouter(deps.config, deps.cloudLibrary));
  app.use('/api/auth', createAuthRouter(deps.auth));
  app.use('/api/admin', createAdminRouter(deps.auth));
  app.use('/api/admin/analyses', createAdminAnalysesRouter(deps.auth, deps.analysisLog));
  app.use('/api', requireAllowed(deps.auth));

  app.use(
    '/api/account',
    createAccountRouter(deps.auth, deps.cloudLibrary, {
      profiles: deps.profiles,
      collab: deps.collab,
      analysisLog: deps.analysisLog,
    }),
  );
  app.use('/api/cloud', createCloudLibraryRouter(deps.cloudLibrary));
  app.use('/api/profile', createProfileRouter(deps.auth, deps.profiles));
  app.use(
    '/api/stems',
    createStemsRouter(deps.stemsEngine, deps.stems, deps.stemsCache, deps.stemsSetup),
  );
  app.use('/api/collab', createCollabRouter({ collab: deps.collab, profiles: deps.profiles }));
  app.use('/api/analyses', createAnalysesRouter(deps));
  app.use('/api/lyrics', createLyricsRouter(deps.lyrics));
  app.use(
    '/api/youtube',
    createYoutubeRouter({
      tools: deps.tools,
      audioCache: deps.audioCache,
      analysisCache: deps.analysisCache,
      analyzerVersion: config.analyzerVersion,
    }),
  );

  app.use('/api', (_req, res) => {
    res.status(404).json(errorBody('NOT_FOUND', 'Ruta no encontrada'));
  });
}

function mountStaticApp(app: express.Express, deps: AppDependencies): void {
  if (!existsSync(deps.webDist)) return;
  app.use(
    express.static(deps.webDist, {
      index: false,
      maxAge: '1h',
      setHeaders: (res, path) => {
        if (path.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(deps.webDist, 'index.html'));
  });
}

function mountErrorHandler(app: express.Express): void {
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res
          .status(413)
          .json(errorBody('FILE_TOO_LARGE', 'The file exceeds the maximum allowed size'));
        return;
      }
      res.status(400).json(errorBody('INVALID_REQUEST', 'Invalid file upload'));
      return;
    }
    if (error instanceof ApiError) {
      res.status(error.status).json(errorBody(error.code, error.message));
      return;
    }
    console.error(error);
    res.status(500).json(errorBody('ANALYSIS_FAILED', 'Unexpected analysis error'));
  });
}

export function createApp(options: CreateAppOptions = {}): express.Express {
  const config = options.config ?? loadConfig();
  const deps = buildDependencies(options, config);
  const app = express();
  applyBaseMiddleware(app, config);
  registerHealthRoute(app, deps, config);
  mountApiRoutes(app, deps, config);
  mountStaticApp(app, deps);
  mountErrorHandler(app);
  return app;
}

export { loadConfig };
