import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { JobQueue } from '../src/jobs/queue';
import { JobStore } from '../src/jobs/store';
import { createAuthContext, MemoryAccessStore } from '../src/services/auth';
import { MemoryCloudLibraryStore } from '../src/services/cloud-library';
import { makeConfig, makeTools } from './helpers';

const ADMIN = 'admin@example.com';

function buildApp(overrides: Parameters<typeof makeConfig>[0] = {}) {
  const config = makeConfig({
    authMode: 'google',
    googleClientId: 'test-client.apps.googleusercontent.com',
    adminEmails: [ADMIN],
    ...overrides,
  });
  const auth = createAuthContext(config, {
    access: new MemoryAccessStore(),
    verifyToken: async () => ({ uid: 'admin', email: ADMIN }),
  });
  return createApp({
    config,
    auth,
    cloudLibrary: new MemoryCloudLibraryStore(),
    store: new JobStore(),
    queue: new JobQueue(1),
    tools: makeTools(),
  });
}

describe('GET /api/config', () => {
  it('reports direct YouTube and no cloud library in local mode', async () => {
    const app = createApp({
      config: makeConfig({ authMode: 'none' }),
      store: new JobStore(),
      queue: new JobQueue(1),
      tools: makeTools(),
    });
    const response = await request(app).get('/api/config');
    expect(response.status).toBe(200);
    expect(response.body.features).toEqual({ cloudLibrary: false, youtube: 'direct' });
  });

  it('marks hosted YouTube as likely blocked without an extractor', async () => {
    const response = await request(buildApp()).get('/api/config');
    expect(response.body.features).toEqual({ cloudLibrary: true, youtube: 'hosted' });
  });

  it('reports the extractor when it is configured', async () => {
    const app = buildApp({
      youtubeExtractorUrl: 'https://extractor.example.com',
      youtubeExtractorToken: 'secret',
    });
    const response = await request(app).get('/api/config');
    expect(response.body.features).toEqual({ cloudLibrary: true, youtube: 'extractor' });
  });
});
