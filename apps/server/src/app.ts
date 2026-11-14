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
import { createYoutubeRouter } from './routes/youtube';
import { createAnalyzerClient, type AnalyzerClient } from './services/analyzer';
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
  webDist: string;
}

export interface CreateAppOptions extends Partial<AppDependencies> {
  config?: AppConfig;
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
  const deps: AppDependencies = {
    config,
    store: options.store ?? new JobStore(),
    queue: options.queue ?? new JobQueue(2),
    tools: options.tools ?? createMediaTools(config),
    analyzer:
      options.analyzer ?? createAnalyzerClient(config.analyzerUrl, fetch, config.analyzerToken),
    lyrics: options.lyrics ?? createLyricsClient(fetch),
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
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          mediaSrc: ["'self'", 'blob:', 'data:'],
          frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', sameOriginWriteGuard(config));

  app.get('/api/health', async (_req, res) => {
    const health = await deps.analyzer.health();
    res.json({
      status: 'ok',
      analyzer: health.ok ? 'ok' : 'down',
      analyzerVersion: health.version ?? config.analyzerVersion,
    });
  });

  app.use('/api/analyses', createAnalysesRouter(deps));
  app.use('/api/lyrics', createLyricsRouter(deps.lyrics));
  app.use('/api/youtube', createYoutubeRouter(deps.tools));

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
