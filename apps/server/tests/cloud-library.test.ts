import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { JobQueue } from '../src/jobs/queue';
import { JobStore } from '../src/jobs/store';
import { createAuthContext, MemoryAccessStore } from '../src/services/auth';
import { MemoryCloudLibraryStore } from '../src/services/cloud-library';
import { MemoryAnalysisLogStore } from '../src/services/analysis-log';
import { MemoryCollabStore } from '../src/services/collab';
import { MemoryProfileStore } from '../src/services/profiles';
import { makeConfig, makeTools } from './helpers';

const ADMIN = 'admin@example.com';
const FRIEND = 'friend@example.com';

function buildApp(cloudLibrary = new MemoryCloudLibraryStore()) {
  const config = makeConfig({
    authMode: 'google',
    googleClientId: 'test-client.apps.googleusercontent.com',
    adminEmails: [ADMIN],
  });
  const access = new MemoryAccessStore();
  void access.add(FRIEND, ADMIN);
  const auth = createAuthContext(config, {
    access,
    verifyToken: async (token) => {
      if (token === 'admin-token') return { uid: 'admin', email: ADMIN };
      if (token === 'friend-token') return { uid: 'friend', email: FRIEND };
      throw new Error('bad token');
    },
  });
  return createApp({
    config,
    auth,
    cloudLibrary,
    profiles: new MemoryProfileStore(),
    collab: new MemoryCollabStore(),
    analysisLog: new MemoryAnalysisLogStore(),
    store: new JobStore(),
    queue: new JobQueue(1),
    tools: makeTools(),
  });
}

const SONG = {
  id: 'song-1',
  title: 'Demo',
  updatedAt: '2026-01-01T00:00:00.000Z',
  source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
  duration: 8,
  segments: [],
};

const SETLIST = {
  id: 'list-1',
  name: 'Ensayo',
  songIds: ['song-1'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('cloud library', () => {
  it('saves and loads a user library in isolation', async () => {
    const app = buildApp();
    const saved = await request(app)
      .put('/api/cloud/library')
      .set('Authorization', 'Bearer friend-token')
      .send({ songs: [SONG], setlists: [SETLIST] });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ saved: true, songs: 1, setlists: 1 });

    const friend = await request(app)
      .get('/api/cloud/library')
      .set('Authorization', 'Bearer friend-token');
    expect(friend.status).toBe(200);
    expect(friend.body.songs).toEqual([SONG]);
    expect(friend.body.setlists).toEqual([SETLIST]);

    const admin = await request(app)
      .get('/api/cloud/library')
      .set('Authorization', 'Bearer admin-token');
    expect(admin.body.songs).toEqual([]);
  });

  it('replaces the snapshot and removes missing songs', async () => {
    const app = buildApp();
    await request(app)
      .put('/api/cloud/library')
      .set('Authorization', 'Bearer friend-token')
      .send({ songs: [SONG], setlists: [] });
    await request(app)
      .put('/api/cloud/library')
      .set('Authorization', 'Bearer friend-token')
      .send({ songs: [], setlists: [] });

    const response = await request(app)
      .get('/api/cloud/library')
      .set('Authorization', 'Bearer friend-token');
    expect(response.body.songs).toEqual([]);
    expect(response.body.setlists).toEqual([]);
  });

  it('rejects invalid snapshots', async () => {
    const app = buildApp();
    const response = await request(app)
      .put('/api/cloud/library')
      .set('Authorization', 'Bearer friend-token')
      .send({ songs: [{ id: 'missing-title' }], setlists: [] });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_REQUEST');
  });

  it('deletes the cloud library and removes access for a normal user', async () => {
    const app = buildApp();
    await request(app)
      .put('/api/cloud/library')
      .set('Authorization', 'Bearer friend-token')
      .send({ songs: [SONG], setlists: [SETLIST] });

    const deleted = await request(app)
      .delete('/api/account')
      .set('Authorization', 'Bearer friend-token');
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({
      deleted: true,
      songs: 1,
      setlists: 1,
      accessRemoved: true,
    });

    const denied = await request(app)
      .get('/api/cloud/library')
      .set('Authorization', 'Bearer friend-token');
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('NOT_ALLOWED');
  });

  it('deletes an administrator library without removing admin access', async () => {
    const app = buildApp();
    await request(app)
      .put('/api/cloud/library')
      .set('Authorization', 'Bearer admin-token')
      .send({ songs: [SONG], setlists: [] });

    const deleted = await request(app)
      .delete('/api/account')
      .set('Authorization', 'Bearer admin-token');
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({
      deleted: true,
      songs: 1,
      setlists: 0,
      accessRemoved: false,
    });

    const after = await request(app)
      .get('/api/cloud/library')
      .set('Authorization', 'Bearer admin-token');
    expect(after.status).toBe(200);
    expect(after.body.songs).toEqual([]);
    expect(after.body.setlists).toEqual([]);
  });

  it('is disabled in local mode', async () => {
    const app = createApp({
      config: makeConfig({ authMode: 'none' }),
      store: new JobStore(),
      queue: new JobQueue(1),
      tools: makeTools(),
    });
    const response = await request(app).get('/api/cloud/library');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('CLOUD_DISABLED');

    const deleted = await request(app).delete('/api/account');
    expect(deleted.status).toBe(404);
    expect(deleted.body.error.code).toBe('CLOUD_DISABLED');
  });
});
