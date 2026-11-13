import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ApiError } from '../src/errors';
import { JobQueue } from '../src/jobs/queue';
import { JobStore } from '../src/jobs/store';
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

describe('POST /api/analyses', () => {
  it('crea un análisis de YouTube y devuelve el resultado normalizado', async () => {
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

  it('reutiliza el resultado del mismo video dentro del TTL', async () => {
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

  it('no reutiliza un resultado cacheado de otra versión del analizador', async () => {
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

  it('rechaza hosts no permitidos sin llamar a las herramientas', async () => {
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

  it('rechaza enlaces sin identificador', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/analyses')
      .send({ youtubeUrl: 'https://www.youtube.com/watch' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('MISSING_VIDEO_ID');
  });

  it('rechaza cuerpos inválidos o con campos extra', async () => {
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

  it('rechaza escrituras cross-origin sin ejecutar el análisis', async () => {
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

  it('acepta escrituras desde el origen configurado', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/analyses')
      .set('Origin', 'http://localhost:5173')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(response.status).toBe(202);
  });

  it('rechaza tipos de contenido no soportados', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/analyses')
      .set('Content-Type', 'text/plain')
      .send('hola');
    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA');
  });

  it('acepta una subida de audio válida', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/analyses')
      .attach('file', wavBuffer(), { filename: 'cancion.wav', contentType: 'audio/wav' });

    expect(response.status).toBe(202);
    const body = await waitFor(app, response.body.id, 'done');
    expect(body.result.source).toEqual({ type: 'upload', filename: 'cancion.wav' });
  });

  it('rechaza un archivo que no es audio', async () => {
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

  it('rechaza extensiones no admitidas', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/analyses')
      .attach('file', wavBuffer(), { filename: 'notas.txt', contentType: 'text/plain' });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INVALID_AUDIO');
  });

  it('rechaza archivos que superan el tamaño máximo', async () => {
    const app = await buildApp({ config: makeConfig({ maxUploadBytes: 16, tempDir: await makeTempDir() }) });
    const response = await request(app)
      .post('/api/analyses')
      .attach('file', wavBuffer(64), { filename: 'grande.wav', contentType: 'audio/wav' });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('rechaza videos demasiado largos antes de descargar', async () => {
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

  it('marca error cuando el video no está disponible', async () => {
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

  it('marca error cuando el analizador falla', async () => {
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
  it('devuelve 404 para un análisis desconocido', async () => {
    const app = await buildApp();
    const response = await request(app).get('/api/analyses/no-existe');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('devuelve el estado queued inmediatamente', async () => {
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
  it('devuelve 429 con Retry-After al exceder el límite', async () => {
    const app = await buildApp({
      config: makeConfig({ rateLimitMax: 1, rateLimitWindowMs: 60_000, tempDir: await makeTempDir() }),
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
  it('informa del estado del analizador', async () => {
    const app = await buildApp();
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      analyzer: 'ok',
      analyzerVersion: 'essentia-test',
    });
  });

  it('sigue respondiendo si el analizador está caído', async () => {
    const app = await buildApp({ analyzer: makeAnalyzer({ health: async () => ({ ok: false }) }) });
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.analyzer).toBe('down');
  });
});

describe('normalización de la respuesta del analizador', () => {
  it('convierte etiquetas desconocidas en silencio y cubre la duración', async () => {
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

  it('descarta pulsos inválidos y normaliza el compás', async () => {
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
    expect(body.result.beatsPerBar).toBe(4);
  });

  it('devuelve pulsos vacíos si el analizador no los envía', async () => {
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
  it('elimina el trabajo y deja de estar disponible', async () => {
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
