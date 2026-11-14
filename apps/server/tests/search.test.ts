import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ApiError } from '../src/errors';
import { JobQueue } from '../src/jobs/queue';
import { JobStore } from '../src/jobs/store';
import { makeAnalyzer, makeConfig, makeTempDir, makeTools } from './helpers';

async function buildApp(overrides: Parameters<typeof createApp>[0] = {}) {
  const tempDir = await makeTempDir();
  return createApp({
    config: makeConfig({ tempDir }),
    store: new JobStore(),
    queue: new JobQueue(1),
    tools: makeTools(),
    analyzer: makeAnalyzer(),
    ...overrides,
  });
}

describe('GET /api/youtube/search', () => {
  it('returns the normalized search results', async () => {
    const results = [
      {
        videoId: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        uploader: 'Rick Astley',
        duration: 213,
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      },
    ];
    const searchYoutube = vi.fn(async () => results);
    const app = await buildApp({ tools: makeTools({ searchYoutube }) });

    const response = await request(app).get('/api/youtube/search').query({ q: 'rick astley' });

    expect(response.status).toBe(200);
    expect(searchYoutube).toHaveBeenCalledWith('rick astley');
    expect(response.body).toEqual({ results });
  });

  it('trims the query before searching', async () => {
    const searchYoutube = vi.fn(async () => []);
    const app = await buildApp({ tools: makeTools({ searchYoutube }) });

    const response = await request(app).get('/api/youtube/search').query({ q: '  creep  ' });

    expect(response.status).toBe(200);
    expect(searchYoutube).toHaveBeenCalledWith('creep');
  });

  it('rejects an empty or missing query without searching', async () => {
    const searchYoutube = vi.fn(async () => []);
    const app = await buildApp({ tools: makeTools({ searchYoutube }) });

    const empty = await request(app).get('/api/youtube/search').query({ q: '   ' });
    const missing = await request(app).get('/api/youtube/search');

    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('INVALID_REQUEST');
    expect(missing.status).toBe(400);
    expect(searchYoutube).not.toHaveBeenCalled();
  });

  it('rejects a query that is too long', async () => {
    const app = await buildApp();

    const response = await request(app)
      .get('/api/youtube/search')
      .query({ q: 'a'.repeat(121) });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_REQUEST');
  });

  it('reports an upstream search failure', async () => {
    const app = await buildApp({
      tools: makeTools({
        searchYoutube: async () => {
          throw new ApiError('SEARCH_FAILED', 'Could not search YouTube');
        },
      }),
    });

    const response = await request(app).get('/api/youtube/search').query({ q: 'creep' });

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('SEARCH_FAILED');
  });
});
