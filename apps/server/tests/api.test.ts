import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ApiError } from '../src/errors';
import { JobQueue } from '../src/jobs/queue';
import { JobStore } from '../src/jobs/store';
import { MemoryAnalysisCache } from '../src/services/analysis-cache';
import {
  defaultRawAnalysis,
  makeAnalyzer,
  makeConfig,
  makeTempDir,
  makeTools,
  wavBuffer,
} from './helpers';

async function waitFor(
  app: ReturnType<typeof createApp>,
  id: string,
  status: 'done' | 'error',
  timeout = 3000,
) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const response = await request(app).get(`/api/analyses/${id}`);
    if (response.body.status === status) return response.body;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timeout esperando estado ${status}`);
}

async function buildApp(overrides: Parameters<typeof createApp>[0] = {}) {
  const tempDir = await makeTempDir();
  return createApp({
    config: makeConfig({ tempDir }),
    store: new JobStore(),
    queue: new JobQueue(2),
    tools: makeTools(),
    analyzer: makeAnalyzer(),
    ...overrides,
  });
}

describe('same-origin write guard', () => {
  it('accepts the loopback alias on the same port', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/analyses')
      .set('Origin', 'http://127.0.0.1:5173')
      .send({});

    expect(response.status).not.toBe(403);
    expect(response.body.error.code).toBe('INVALID_REQUEST');
  });

  it('rejects another origin, port or cross-site request', async () => {
    const app = await buildApp();
    const foreign = await request(app)
      .post('/api/analyses')
      .set('Origin', 'https://evil.example')
      .send({});
    expect(foreign.status).toBe(403);

    const otherPort = await request(app)
      .post('/api/analyses')
      .set('Origin', 'http://127.0.0.1:5174')
      .send({});
    expect(otherPort.status).toBe(403);

    const crossSite = await request(app)
      .post('/api/analyses')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({});
    expect(crossSite.status).toBe(403);
  });
});

describe('POST /api/analyses', () => {
  it('creates a YouTube analysis and returns the normalized result', async () => {
    const app = await buildApp();

    const created = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

    expect(created.status).toBe(202);
    expect(created.body.status).toBe('queued');
    expect(created.body.id).toEqual(expect.any(String));

    const body = await waitFor(app, created.body.id, 'done');
    expect(body.result.source).toMatchObject({
      type: 'youtube',
      videoId: 'dQw4w9WgXcQ',
      title: 'Canción de prueba',
    });
    expect(body.result.segments).toHaveLength(2);
    expect(body.result.segments[0].chord).toMatchObject({ root: 0, quality: 'major' });
    expect(body.result.segments[1].chord).toMatchObject({ root: 7, quality: 'major' });
    expect(body.result.analyzerVersion).toBe('essentia-test');
    expect(body.result.beats).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    expect(body.result.beatsPerBar).toBe(4);
    expect(body.progress).toBe(100);
  });

  it('reuses the result for the same video within the TTL', async () => {
    let probes = 0;
    const app = await buildApp({
      tools: makeTools({
        probeYoutube: async () => {
          probes += 1;
          return { duration: 120, title: 'Demo' };
        },
      }),
    });

    const first = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    await waitFor(app, first.body.id, 'done');

    const second = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });

    expect(second.status).toBe(202);
    expect(second.body.id).toBe(first.body.id);
    expect(probes).toBe(1);
  });

  it('reuses a persistent analysis across app instances', async () => {
    const analysisCache = new MemoryAnalysisCache();
    const first = await buildApp({ analysisCache });
    const created = await request(first)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    expect(created.status).toBe(202);
    await waitFor(first, created.body.id, 'done');

    let probes = 0;
    const second = await buildApp({
      analysisCache,
      tools: makeTools({
        probeYoutube: async () => {
          probes += 1;
          throw new Error('the extractor should not be called');
        },
      }),
    });
    const cached = await request(second)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

    expect(cached.status).toBe(202);
    expect(cached.body.status).toBe('done');
    expect(cached.body.result.analyzerVersion).toBe('essentia-test');
    expect(probes).toBe(0);

    const forced = await request(second)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', force: true });
    expect(forced.status).toBe(202);
    expect(forced.body.status).toBe('queued');
  });

  it('does not reuse a cached result from another analyzer version', async () => {
    let probes = 0;
    const app = await buildApp({
      tools: makeTools({
        probeYoutube: async () => {
          probes += 1;
          return { duration: 120, title: 'Demo' };
        },
      }),
      analyzer: makeAnalyzer({
        analyze: async () => ({ ...defaultRawAnalysis, analyzerVersion: 'essentia-1.0' }),
      }),
    });

    const first = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    await waitFor(app, first.body.id, 'done');

    const second = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    await waitFor(app, second.body.id, 'done');

    expect(second.status).toBe(202);
    expect(second.body.id).not.toBe(first.body.id);
    expect(probes).toBe(2);
  });

  it('rejects disallowed hosts without calling the tools', async () => {
    let probes = 0;
    const app = await buildApp({
      tools: makeTools({
        probeYoutube: async () => {
          probes += 1;
          return { duration: 10 };
        },
      }),
    });

    const response = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://example.com/watch?v=dQw4w9WgXcQ' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('UNSUPPORTED_HOST');
    expect(probes).toBe(0);
  });

  it('rejects links without an identifier', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://www.youtube.com/watch' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('MISSING_VIDEO_ID');
  });

  it('rejects invalid bodies or bodies with extra fields', async () => {
    const app = await buildApp();
    const empty = await request(app).post('/api/analyses').send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('INVALID_REQUEST');

    const extra = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', extra: true });
    expect(extra.status).toBe(400);
    expect(extra.body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns the lyrics found by the provider', async () => {
    const app = await buildApp({
      lyrics: {
        find: async () => ({
          lyrics: 'Primera línea\nSegunda línea',
          trackName: 'Demo',
          artistName: 'Artista',
          source: 'lrclib',
        }),
      },
    });

    const response = await request(app)
      .get('/api/lyrics')
      .query({ title: 'Demo', artist: 'Artista', duration: 120 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      lyrics: 'Primera línea\nSegunda línea',
      source: 'lrclib',
    });
  });

  it('validates the lyrics request and returns 404 when there is no match', async () => {
    const app = await buildApp({
      lyrics: {
        find: async () => {
          throw new ApiError('LYRICS_NOT_FOUND', 'No lyrics');
        },
      },
    });

    const invalid = await request(app).get('/api/lyrics');
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_REQUEST');

    const missing = await request(app).get('/api/lyrics').query({ title: 'Demo' });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('LYRICS_NOT_FOUND');
  });

  it('rejects cross-origin writes without running the analysis', async () => {
    let probes = 0;
    const app = await buildApp({
      tools: makeTools({
        probeYoutube: async () => {
          probes += 1;
          return { duration: 10 };
        },
      }),
    });

    const response = await request(app)
      .post('/api/analyses')
      .set('Origin', 'https://evil.example')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(probes).toBe(0);
  });

  it('does not trust an attacker-controlled Host as an allowed origin', async () => {
    let probes = 0;
    const app = await buildApp({
      tools: makeTools({
        probeYoutube: async () => {
          probes += 1;
          return { duration: 10 };
        },
      }),
    });

    const response = await request(app)
      .post('/api/analyses')
      .set('Host', 'evil.example')
      .set('Origin', 'http://evil.example')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(probes).toBe(0);
  });

  it('accepts writes from the configured origin', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/analyses')
      .set('Origin', 'http://localhost:5173')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(response.status).toBe(202);
  });

  it('rejects unsupported content types', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/analyses')
      .set('Content-Type', 'text/plain')
      .send('hola');
    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA');
  });

  it('accepts a valid audio upload', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/analyses')
      .attach('file', wavBuffer(), { filename: 'cancion.wav', contentType: 'audio/wav' });

    expect(response.status).toBe(202);
    const body = await waitFor(app, response.body.id, 'done');
    expect(body.result.source).toEqual({ type: 'upload', filename: 'cancion.wav' });
  });

  it('rejects multipart form fields alongside an upload', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/analyses')
      .field('title', 'unexpected')
      .attach('file', wavBuffer(), { filename: 'cancion.wav', contentType: 'audio/wav' });

    expect(response.status).toBe(400);
  });

  it('stores uploaded audio and dispatches analysis to the configured worker', async () => {
    const store = new JobStore();
    const put = vi.fn(async () => 1);
    const dispatch = vi.fn(async () => undefined);
    const app = await buildApp({
      store,
      analysisInputs: { put, get: vi.fn(), delete: vi.fn() },
      analysisDispatcher: { dispatch },
    });
    const response = await request(app)
      .post('/api/analyses')
      .attach('file', wavBuffer(), { filename: 'cancion.wav', contentType: 'audio/wav' });

    expect(response.status).toBe(202);
    expect(put).toHaveBeenCalledWith(response.body.id, expect.any(Buffer));
    expect(dispatch).toHaveBeenCalledWith(response.body.id);
    expect((await store.get(response.body.id))?.status).toBe('queued');
  });

  it('rejects a file that is not audio', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/analyses')
      .attach('file', Buffer.from('no soy audio'), {
        filename: 'falso.mp3',
        contentType: 'audio/mpeg',
      });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INVALID_AUDIO');
  });

  it('rejects unsupported extensions', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/analyses')
      .attach('file', wavBuffer(), { filename: 'notas.txt', contentType: 'text/plain' });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INVALID_AUDIO');
  });

  it('rejects files that exceed the maximum size', async () => {
    const app = await buildApp({
      config: makeConfig({ maxUploadBytes: 16, tempDir: await makeTempDir() }),
    });
    const response = await request(app)
      .post('/api/analyses')
      .attach('file', wavBuffer(64), { filename: 'grande.wav', contentType: 'audio/wav' });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects videos that are too long before downloading', async () => {
    let downloads = 0;
    const app = await buildApp({
      tools: makeTools({
        probeYoutube: async () => ({ duration: 1000 }),
        downloadYoutube: async () => {
          downloads += 1;
          return '/tmp/nada';
        },
      }),
    });

    const created = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    const body = await waitFor(app, created.body.id, 'error');
    expect(body.error.code).toBe('DURATION_EXCEEDED');
    expect(downloads).toBe(0);
  });

  it('marks an error when the video is unavailable', async () => {
    const app = await buildApp({
      tools: makeTools({
        probeYoutube: async () => {
          throw new ApiError('VIDEO_UNAVAILABLE', 'Video privado');
        },
      }),
    });
    const created = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    const body = await waitFor(app, created.body.id, 'error');
    expect(body.error).toEqual({ code: 'VIDEO_UNAVAILABLE', message: 'Video privado' });
  });

  it('marks an error when the analyzer fails', async () => {
    const app = await buildApp({
      analyzer: makeAnalyzer({
        analyze: async () => {
          throw new ApiError('ANALYSIS_FAILED', 'Sin respuesta');
        },
      }),
    });
    const created = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    const body = await waitFor(app, created.body.id, 'error');
    expect(body.error.code).toBe('ANALYSIS_FAILED');
  });
});

describe('GET /api/analyses/:id', () => {
  it('returns 404 for an unknown analysis', async () => {
    const app = await buildApp();
    const response = await request(app).get('/api/analyses/no-existe');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns the queued status immediately', async () => {
    const app = await buildApp({
      queue: new JobQueue(0),
      tools: makeTools(),
      analyzer: makeAnalyzer(),
    });
    const created = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(created.body.status).toBe('queued');
    const status = await request(app).get(`/api/analyses/${created.body.id}`);
    expect(status.body.status).toBe('queued');
  });
});

describe('rate limiting', () => {
  it('returns 429 with Retry-After when the limit is exceeded', async () => {
    const app = await buildApp({
      config: makeConfig({
        rateLimitMax: 1,
        rateLimitWindowMs: 60_000,
        tempDir: await makeTempDir(),
      }),
    });
    const first = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(first.status).toBe(202);

    const second = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe('RATE_LIMITED');
    expect(second.headers['retry-after']).toBe('60');
  });
});

describe('GET /api/health', () => {
  it('reports the analyzer status', async () => {
    const app = await buildApp();
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      analyzer: 'ok',
      analyzerVersion: 'essentia-test',
    });
  });

  it('keeps responding if the analyzer is down', async () => {
    const app = await buildApp({ analyzer: makeAnalyzer({ health: async () => ({ ok: false }) }) });
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.analyzer).toBe('down');
  });

  it('reports the remote extractor when configured', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: 'ok', extractorVersion: '0.1.0' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      const app = await buildApp({
        config: makeConfig({
          tempDir: await makeTempDir(),
          youtubeExtractorUrl: 'https://extractor.example',
          youtubeExtractorToken: 'token',
        }),
      });
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ extractor: 'ok', extractorVersion: '0.1.0' });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://extractor.example/health',
        expect.objectContaining({ signal: expect.anything() }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('marks the remote extractor as down without failing health', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    try {
      const app = await buildApp({
        config: makeConfig({
          tempDir: await makeTempDir(),
          youtubeExtractorUrl: 'https://extractor.example',
          youtubeExtractorToken: 'token',
        }),
      });
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ status: 'ok', extractor: 'down' });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('analyzer response normalization', () => {
  it('converts unknown labels into silence and covers the duration', async () => {
    const app = await buildApp({
      analyzer: makeAnalyzer({
        analyze: async () => ({
          ...defaultRawAnalysis,
          duration: 100,
          segments: [
            { start: 0, end: 20, label: 'C' },
            { start: 20, end: 40, label: 'H7' },
          ],
        }),
      }),
    });
    const created = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    const body = await waitFor(app, created.body.id, 'done');
    expect(body.result.segments[1].chord).toBeNull();
    expect(body.result.segments.at(-1).end).toBe(100);
  });

  it('discards invalid beats and keeps the detected time signature', async () => {
    const app = await buildApp({
      analyzer: makeAnalyzer({
        analyze: async () => ({
          ...defaultRawAnalysis,
          duration: 10,
          beats: [2, 0.5, 0.5, Number.NaN, 20, -1, 1.25],
          beatsPerBar: 3,
        }),
      }),
    });
    const created = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    const body = await waitFor(app, created.body.id, 'done');
    expect(body.result.beats).toEqual([0.5, 1.25, 2]);
    expect(body.result.beatsPerBar).toBe(3);
  });

  it('returns empty beats when the analyzer does not send them', async () => {
    const app = await buildApp({
      analyzer: makeAnalyzer({
        analyze: async () => ({
          segments: defaultRawAnalysis.segments,
          duration: 120,
          analyzerVersion: 'essentia-test',
        }),
      }),
    });
    const created = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    const body = await waitFor(app, created.body.id, 'done');
    expect(body.result.beats).toEqual([]);
    expect(body.result.beatsPerBar).toBe(4);
  });
});

describe('DELETE /api/analyses/:id', () => {
  it('deletes the job and makes it unavailable', async () => {
    const app = await buildApp();
    const created = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

    const deleted = await request(app).delete(`/api/analyses/${created.body.id}`);
    expect(deleted.status).toBe(204);

    const missing = await request(app).get(`/api/analyses/${created.body.id}`);
    expect(missing.status).toBe(404);
  });
});

describe('temporary YouTube audio', () => {
  it('prepares, streams and reuses the audio with range support', async () => {
    let downloads = 0;
    const app = await buildApp({
      tools: makeTools({
        downloadYoutube: async (videoId, directory) => {
          downloads += 1;
          const path = join(directory, `${videoId}.m4a`);
          await writeFile(path, '0123456789');
          return path;
        },
      }),
    });

    const prepared = await request(app).post('/api/youtube/dQw4w9WgXcQ/audio');
    expect(prepared.status).toBe(200);
    expect(prepared.body.url).toBe('/api/youtube/dQw4w9WgXcQ/audio');
    expect(prepared.body.expiresAt).toEqual(expect.any(String));
    expect(downloads).toBe(1);

    const full = await request(app).get('/api/youtube/dQw4w9WgXcQ/audio');
    expect(full.status).toBe(200);
    expect(full.headers['content-type']).toContain('audio/mp4');
    expect(Buffer.from(full.body).toString()).toBe('0123456789');

    const range = await request(app)
      .get('/api/youtube/dQw4w9WgXcQ/audio')
      .set('Range', 'bytes=0-3');
    expect(range.status).toBe(206);
    expect(range.headers['content-range']).toBe('bytes 0-3/10');
    expect(Buffer.from(range.body).toString()).toBe('0123');

    await request(app).post('/api/youtube/dQw4w9WgXcQ/audio');
    expect(downloads).toBe(1);
  });

  it('reports and clears the temporary audio usage', async () => {
    const app = await buildApp();
    const empty = await request(app).get('/api/youtube/audio-cache');
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ entries: 0, bytes: 0, ttlMinutes: 60 });

    await request(app).post('/api/youtube/dQw4w9WgXcQ/audio');
    const used = await request(app).get('/api/youtube/audio-cache');
    expect(used.status).toBe(200);
    expect(used.body.entries).toBe(1);
    expect(used.body.bytes).toBeGreaterThan(0);

    const cleared = await request(app).delete('/api/youtube/audio-cache');
    expect(cleared.status).toBe(200);
    expect(cleared.body).toEqual({ removed: 1 });

    const after = await request(app).get('/api/youtube/audio-cache');
    expect(after.body).toEqual({ entries: 0, bytes: 0, ttlMinutes: 60 });
  });

  it('returns 404 until the audio is prepared', async () => {
    const app = await buildApp();
    const response = await request(app).get('/api/youtube/dQw4w9WgXcQ/audio');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('AUDIO_NOT_READY');
  });

  it('rejects invalid video identifiers', async () => {
    const app = await buildApp();
    const response = await request(app).post('/api/youtube/bad/audio');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_REQUEST');
  });

  it('keeps the downloaded audio after an analysis', async () => {
    let downloads = 0;
    const app = await buildApp({
      tools: makeTools({
        downloadYoutube: async (videoId, directory) => {
          downloads += 1;
          const path = join(directory, `${videoId}.webm`);
          await writeFile(path, 'audio');
          return path;
        },
      }),
    });

    const created = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    await waitFor(app, created.body.id, 'done');

    const prepared = await request(app).post('/api/youtube/dQw4w9WgXcQ/audio');
    expect(prepared.status).toBe(200);
    expect(downloads).toBe(1);
  });
});
