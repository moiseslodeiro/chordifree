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
import { createAnalyzerClient, type AnalyzerClient } from './services/analyzer';
import { createMediaTools, type MediaTools } from './services/media';

const here = dirname(fileURLToPath(import.meta.url));

export interface AppDependencies {
  config: AppConfig;
  store: JobStore;
  queue: JobQueue;
  tools: MediaTools;
  analyzer: AnalyzerClient;
  webDist: string;
}

export interface CreateAppOptions extends Partial<AppDependencies> {
  config?: AppConfig;
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
    webDist: options.webDist ?? config.webDist ?? resolve(here, '../../web/dist'),
  };

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    const health = await deps.analyzer.health();
    res.json({
      status: 'ok',
      analyzer: health.ok ? 'ok' : 'down',
      analyzerVersion: health.version ?? config.analyzerVersion,
    });
  });

  app.use('/api/analyses', createAnalysesRouter(deps));

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
