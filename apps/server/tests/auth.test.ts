import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { JobQueue } from '../src/jobs/queue';
import { JobStore } from '../src/jobs/store';
import { createAuthContext, MemoryAccessStore } from '../src/services/auth';
import { makeConfig, makeTools } from './helpers';

const ADMIN = 'admin@example.com';
const ALLOWED = 'friend@example.com';

function buildGoogleApp(access = new MemoryAccessStore()) {
  const config = makeConfig({
    authMode: 'google',
    googleClientId: 'test-client.apps.googleusercontent.com',
    adminEmails: [ADMIN],
  });
  const auth = createAuthContext(config, {
    access,
    verifyToken: async (token) => {
      if (token === 'admin-token') {
        return { uid: 'admin', email: ADMIN, name: 'Admin' };
      }
      if (token === 'friend-token') {
        return { uid: 'friend', email: ALLOWED, name: 'Friend' };
      }
      if (token === 'stranger-token') {
        return { uid: 'stranger', email: 'stranger@example.com' };
      }
      throw new Error('bad token');
    },
  });
  return createApp({
    config,
    auth,
    store: new JobStore(),
    queue: new JobQueue(1),
    tools: makeTools(),
    analyzer: {
      health: async () => ({ ok: true, version: 'test' }),
      analyze: async () => {
        throw new Error('not used');
      },
    },
    lyrics: {
      find: async () => ({
        lyrics: 'Demo',
        trackName: 'Demo',
        artistName: 'Test',
        source: 'lrclib' as const,
      }),
    },
  });
}

describe('Google auth boundary', () => {
  it('keeps local mode open', async () => {
    const app = createApp({
      config: makeConfig({ authMode: 'none' }),
      store: new JobStore(),
      queue: new JobQueue(1),
      tools: makeTools(),
    });
    const config = await request(app).get('/api/auth/config');
    expect(config.body).toEqual({ mode: 'none' });

    const me = await request(app).get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ allowed: true, admin: true });
  });

  it('requires a valid token and reports disallowed accounts', async () => {
    const app = buildGoogleApp();

    await request(app).get('/api/auth/me').expect(401);
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer stranger-token')
      .expect(200)
      .expect((response) => {
        expect(response.body.allowed).toBe(false);
        expect(response.body.admin).toBe(false);
      });
    await request(app)
      .get('/api/lyrics?title=Demo')
      .set('Authorization', 'Bearer stranger-token')
      .expect(403);
  });

  it('lets an allowed account through and keeps admins allowed', async () => {
    const access = new MemoryAccessStore();
    await access.add(ALLOWED, ADMIN);
    const app = buildGoogleApp(access);

    await request(app)
      .get('/api/lyrics?title=Demo')
      .set('Authorization', 'Bearer friend-token')
      .expect((response) => expect(response.status).not.toBe(403));
    await request(app)
      .get('/api/lyrics?title=Demo')
      .set('Authorization', 'Bearer admin-token')
      .expect((response) => expect(response.status).not.toBe(403));
  });

  it('manages the allowlist from the admin account only', async () => {
    const app = buildGoogleApp();

    await request(app)
      .get('/api/admin/access')
      .set('Authorization', 'Bearer friend-token')
      .expect(403);

    const created = await request(app)
      .post('/api/admin/access')
      .set('Authorization', 'Bearer admin-token')
      .send({ email: 'New@Example.com' });
    expect(created.status).toBe(201);
    expect(created.body.entry.email).toBe('new@example.com');

    const list = await request(app)
      .get('/api/admin/access')
      .set('Authorization', 'Bearer admin-token');
    expect(list.body.entries).toHaveLength(1);

    await request(app)
      .delete('/api/admin/access/new@example.com')
      .set('Authorization', 'Bearer admin-token')
      .expect(204);
  });
});

describe('MemoryAccessStore', () => {
  it('normalizes emails and removes entries', async () => {
    const store = new MemoryAccessStore();
    await store.add('A@Example.com', ADMIN);
    expect(await store.isAllowed('a@example.com')).toBe(true);
    expect(await store.list()).toEqual([
      expect.objectContaining({ email: 'a@example.com', addedBy: ADMIN }),
    ]);
    expect(await store.remove('A@EXAMPLE.COM')).toBe(true);
    expect(await store.isAllowed('a@example.com')).toBe(false);
  });
});
