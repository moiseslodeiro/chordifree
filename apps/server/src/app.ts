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
import { JobStore } from './jobs/store';
import { createAnalysesRouter } from './routes/analyses';
import { createLyricsRouter } from './routes/lyrics';
import { createCloudLibraryRouter } from './routes/cloud-library';
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
import { createMediaTools, type MediaTools } from './services/media';

const here = dirname(fileURLToPath(import.meta.url));

export interface AppDependencies {
  config: AppConfig;
  store: JobStore;
  queue: JobQueue;
  tools: MediaTools;
  analyzer: AnalyzerClient;
  lyrics: LyricsClient;
  audioCache: TemporaryAudioCache;
  auth: AuthContext;
  cloudLibrary: CloudLibraryStore | null;
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

    const host = req.get('host');
    const requestOrigin = host ? `${req.protocol}://${host}` : null;
    if (origin !== config.corsOrigin && origin !== requestOrigin) {
      res.status(403).json(errorBody('FORBIDDEN', 'Cross-origin request blocked'));
      return;
    }
    next();
  };
}

export function createApp(options: CreateAppOptions = {}): express.Express {
  const config = options.config ?? loadConfig();
  const tools = options.tools ?? createMediaTools(config);
  const analyzerTokenProvider =
    config.analyzerAuth === 'google' ? createGoogleIdTokenProvider(config.analyzerUrl) : undefined;
  const deps: AppDependencies = {
    config,
    store: options.store ?? new JobStore(),
    queue: options.queue ?? new JobQueue(2),
    tools,
    analyzer:
      options.analyzer ??
      createAnalyzerClient(config.analyzerUrl, fetch, config.analyzerToken, analyzerTokenProvider),
    lyrics: options.lyrics ?? createLyricsClient(fetch),
    audioCache:
      options.audioCache ??
      new TemporaryAudioCache({
        directory: audioCacheDirectory(config.tempDir),
        workspaceRoot: config.tempDir,
        ttlMs: config.audioCacheTtlMinutes * 60_000,
        tools,
      }),
    auth: options.auth ?? createAuthContext(config),
    cloudLibrary:
      options.cloudLibrary ??
      (config.authMode === 'google'
        ? new FirestoreCloudLibraryStore(createFirestore(config))
        : null),
    webDist: options.webDist ?? config.webDist ?? resolve(here, '../../web/dist'),
  };

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://accounts.google.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          mediaSrc: ["'self'", 'blob:', 'data:'],
          frameSrc: [
            "'self'",
            'https://accounts.google.com',
            'https://www.youtube.com',
            'https://www.youtube-nocookie.com',
          ],
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

  app.use('/api/config', createConfigRouter(deps.config, deps.cloudLibrary));
  app.use('/api/auth', createAuthRouter(deps.auth));
  app.use('/api/admin', createAdminRouter(deps.auth));
  app.use('/api', requireAllowed(deps.auth));

  app.use('/api/account', createAccountRouter(deps.auth, deps.cloudLibrary));
  app.use('/api/cloud', createCloudLibraryRouter(deps.cloudLibrary));
  app.use('/api/analyses', createAnalysesRouter(deps));
  app.use('/api/lyrics', createLyricsRouter(deps.lyrics));
  app.use('/api/youtube', createYoutubeRouter({ tools: deps.tools, audioCache: deps.audioCache }));

  app.use('/api', (_req, res) => {
    res.status(404).json(errorBody('NOT_FOUND', 'Ruta no encontrada'));
  });

  if (existsSync(deps.webDist)) {
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

  return app;
}

export { loadConfig };
