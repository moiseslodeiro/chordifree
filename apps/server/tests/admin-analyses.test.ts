import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { JobQueue } from '../src/jobs/queue';
import { JobStore } from '../src/jobs/store';
import { createAuthContext, MemoryAccessStore } from '../src/services/auth';
import { MemoryAnalysisCache } from '../src/services/analysis-cache';
import { MemoryAnalysisLogStore } from '../src/services/analysis-log';
import { MemoryCloudLibraryStore } from '../src/services/cloud-library';
import { MemoryCollabStore } from '../src/services/collab';
import { MemoryProfileStore } from '../src/services/profiles';
import { makeAnalyzer, makeConfig, makeTempDir, makeTools, wavBuffer } from './helpers';

const ADMIN = 'admin@example.com';
const FRIEND = 'friend@example.com';

async function buildApp() {
  const config = makeConfig({
    authMode: 'google',
    googleClientId: 'test-client.apps.googleusercontent.com',
    adminEmails: [ADMIN],
    tempDir: await makeTempDir(),
  });
  const access = new MemoryAccessStore();
  await access.add(FRIEND, ADMIN);
  const auth = createAuthContext(config, {
    access,
    verifyToken: async (token) => {
      if (token === 'admin-token') return { uid: 'admin', email: ADMIN, name: 'Admin' };
      if (token === 'friend-token') return { uid: 'friend', email: FRIEND };
      throw new Error('bad token');
    },
  });
  return createApp({
    config,
    auth,
    cloudLibrary: new MemoryCloudLibraryStore(),
    profiles: new MemoryProfileStore(),
    collab: new MemoryCollabStore(),
    analysisLog: new MemoryAnalysisLogStore(),
    analysisCache: new MemoryAnalysisCache(),
    store: new JobStore(),
    queue: new JobQueue(1),
    tools: makeTools(),
    analyzer: makeAnalyzer(),
  });
}

async function waitFor(
  app: ReturnType<typeof createApp>,
  id: string,
  token: string,
): Promise<{ status: string; result?: { analyzerVersion: string } }> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const response = await request(app)
      .get(`/api/analyses/${id}`)
      .set('Authorization', `Bearer ${token}`);
    if (response.body.status === 'done' || response.body.status === 'error') return response.body;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('analysis did not finish');
}

describe('admin analysis activity', () => {
  it('records who analyzed a YouTube song and lists it for administrators', async () => {
    const app = await buildApp();
    await request(app)
      .put('/api/profile')
      .set('Authorization', 'Bearer friend-token')
      .send({ nickname: 'Fulanito' });

    const created = await request(app)
      .post('/api/analyses')
      .set('Authorization', 'Bearer friend-token')
      .send({ youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    expect(created.status).toBe(202);
    const done = await waitFor(app, created.body.id, 'friend-token');
    expect(done.status).toBe('done');

    const admin = await request(app)
      .get('/api/admin/analyses')
      .set('Authorization', 'Bearer admin-token');
    expect(admin.status).toBe(200);
    expect(admin.body.entries).toHaveLength(1);
    expect(admin.body.entries[0]).toMatchObject({
      uid: 'friend',
      email: FRIEND,
      nickname: 'Fulanito',
      kind: 'youtube',
      videoId: 'dQw4w9WgXcQ',
      title: 'Canción de prueba',
      duration: 120,
      chords: 2,
      analyzerVersion: 'essentia-test',
    });
  });

  it('records uploaded audio with its filename', async () => {
    const app = await buildApp();
    const created = await request(app)
      .post('/api/analyses')
      .set('Authorization', 'Bearer admin-token')
      .attach('file', wavBuffer(256), 'ensayo.wav');
    expect(created.status).toBe(202);
    await waitFor(app, created.body.id, 'admin-token');

    const admin = await request(app)
      .get('/api/admin/analyses?limit=10')
      .set('Authorization', 'Bearer admin-token');
    expect(admin.status).toBe(200);
    expect(admin.body.entries[0]).toMatchObject({
      uid: 'admin',
      nickname: 'Admin',
      kind: 'upload',
      filename: 'ensayo.wav',
    });
  });

  it('removes the activity when the account is deleted', async () => {
    const app = await buildApp();
    const created = await request(app)
      .post('/api/analyses')
      .set('Authorization', 'Bearer friend-token')
      .send({ youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    await waitFor(app, created.body.id, 'friend-token');

    const deleted = await request(app)
      .delete('/api/account')
      .set('Authorization', 'Bearer friend-token');
    expect(deleted.status).toBe(200);

    const admin = await request(app)
      .get('/api/admin/analyses')
      .set('Authorization', 'Bearer admin-token');
    expect(admin.status).toBe(200);
    expect(admin.body.entries).toHaveLength(0);
  });

  it('keeps the activity feed admin-only', async () => {
    const app = await buildApp();
    const friend = await request(app)
      .get('/api/admin/analyses')
      .set('Authorization', 'Bearer friend-token');
    expect(friend.status).toBe(403);

    const anonymous = await request(app).get('/api/admin/analyses');
    expect(anonymous.status).toBe(401);
  });
});
