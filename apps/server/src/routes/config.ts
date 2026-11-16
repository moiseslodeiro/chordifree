import { Router } from 'express';
import type { AppConfig } from '../config';
import type { CloudLibraryStore } from '../services/cloud-library';

/**
 * Capabilities the web app can adapt to without guessing from failures.
 */
export function createConfigRouter(
  config: AppConfig,
  cloudLibrary: CloudLibraryStore | null,
): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      features: {
        cloudLibrary: Boolean(cloudLibrary),
        youtube: config.youtubeExtractorUrl
          ? 'extractor'
          : config.authMode === 'google'
            ? 'hosted'
            : 'direct',
      },
    });
  });

  return router;
}
