import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { JobQueue } from '../src/jobs/queue';
import { JobStore } from '../src/jobs/store';
import { makeAnalyzer, makeConfig, makeTempDir, makeTools } from './helpers';

async function buildApp() {
  const tempDir = await makeTempDir();
  return createApp({
    config: makeConfig({ tempDir }),
    store: new JobStore(),
    queue: new JobQueue(1),
    tools: makeTools(),
    analyzer: makeAnalyzer(),
  });
}

const song = {
  id: 'song-1',
  title: 'My song',
  updatedAt: '2026-11-18T10:00:00.000Z',
  segments: [],
};

async function createShare(app: Awaited<ReturnType<typeof buildApp>>) {
  const response = await request(app).post('/api/collab').send({ song });
  expect(response.status).toBe(201);
  return response.body as {
    id: string;
    currentRevisionId: string;
    revisions: Array<{ id: string; authorNickname: string }>;
  };
}

describe('collaborative revisions', () => {
  it('creates a share with an initial revision', async () => {
    const app = await buildApp();
    const share = await createShare(app);

    expect(share.id).toMatch(/^[0-9a-f]{32}$/);
    expect(share.revisions).toHaveLength(1);
    expect(share.revisions[0]?.id).toBe(share.currentRevisionId);

    const loaded = await request(app).get(`/api/collab/${share.id}`);
    expect(loaded.status).toBe(200);
    expect(loaded.body.songId).toBe('song-1');
    expect(loaded.body.revisions).toHaveLength(1);
  });

  it('appends revisions and rejects stale bases', async () => {
    const app = await buildApp();
    const share = await createShare(app);

    const first = await request(app)
      .post(`/api/collab/${share.id}/revisions`)
      .send({
        baseRevisionId: share.currentRevisionId,
        song: { ...song, title: 'Renamed', updatedAt: '2026-11-18T11:00:00.000Z' },
      });
    expect(first.status).toBe(201);
    expect(first.body.authorNickname).toBe('Local user');

    const stale = await request(app)
      .post(`/api/collab/${share.id}/revisions`)
      .send({ baseRevisionId: share.currentRevisionId, song });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('CONFLICT');

    const loaded = await request(app).get(`/api/collab/${share.id}`);
    expect(loaded.body.currentRevisionId).toBe(first.body.id);
    expect(loaded.body.revisions).toHaveLength(2);
    expect(loaded.body.revisions[0].id).toBe(first.body.id);

    const revision = await request(app).get(`/api/collab/${share.id}/revisions/${first.body.id}`);
    expect(revision.status).toBe(200);
    expect(revision.body.song.title).toBe('Renamed');
  });

  it('uses the nickname saved in the profile', async () => {
    const app = await buildApp();
    const share = await createShare(app);

    const profile = await request(app).get('/api/profile');
    expect(profile.body).toEqual({ nickname: 'Local user', custom: false });

    const saved = await request(app).put('/api/profile').send({ nickname: 'Fulanito' });
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ nickname: 'Fulanito', custom: true });

    const revision = await request(app)
      .post(`/api/collab/${share.id}/revisions`)
      .send({ baseRevisionId: share.currentRevisionId, song });
    expect(revision.status).toBe(201);
    expect(revision.body.authorNickname).toBe('Fulanito');
  });

  it('rejects invalid nicknames and missing shares', async () => {
    const app = await buildApp();
    const invalid = await request(app).put('/api/profile').send({ nickname: '' });
    expect(invalid.status).toBe(400);

    const missing = await request(app).get('/api/collab/does-not-exist');
    expect(missing.status).toBe(404);
  });
});
