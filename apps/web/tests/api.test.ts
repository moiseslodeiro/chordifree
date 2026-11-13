import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiClientError,
  createUploadAnalysis,
  createYoutubeAnalysis,
  fetchLyrics,
  getAnalysis,
  getHealth,
  pollAnalysis,
} from '../src/lib/api';

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function doneResult() {
  return {
    source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
    duration: 8,
    segments: [{ start: 0, end: 8, chord: { root: 0, quality: 'major' } }],
    analyzerVersion: 'essentia-1.0',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('cliente HTTP', () => {
  it('crea un análisis de YouTube con JSON', async () => {
    const fetchMock = vi.fn(async () =>
      response({ id: 'job-1', status: 'queued', progress: 0 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(createYoutubeAnalysis('https://youtu.be/dQw4w9WgXcQ')).resolves.toMatchObject({
      id: 'job-1',
      status: 'queued',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/analyses',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' }),
      }),
    );
  });

  it('crea un análisis de subida con FormData', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      response({ id: 'job-2', status: 'queued', progress: 0 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const file = new File([new Uint8Array([1, 2, 3])], 'audio.mp3', { type: 'audio/mpeg' });
    await createUploadAnalysis(file);
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/analyses');
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get('file')).toBe(file);
  });

  it('solicita letras con título, artista y duración', async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      response({
        lyrics: 'Uno\nDos',
        trackName: 'Demo',
        artistName: 'Artista',
        source: 'lrclib',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchLyrics({ title: 'Demo', artist: 'Artista', duration: 120.4 }),
    ).resolves.toMatchObject({ lyrics: 'Uno\nDos', source: 'lrclib' });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      '/api/lyrics?title=Demo&artist=Artista&duration=120',
    );
  });

  it('convierte respuestas de error en ApiClientError con código estable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({ error: { code: 'DURATION_EXCEEDED', message: 'Demasiado largo' } }, 422),
      ),
    );

    await expect(getAnalysis('job-1')).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'DURATION_EXCEEDED',
      status: 422,
      message: 'Demasiado largo',
    });
  });

  it('tolera respuestas sin cuerpo JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, json: async () => Promise.reject() }) as never),
    );
    await expect(getAnalysis('job-1')).rejects.toBeInstanceOf(ApiClientError);
  });

  it('informa del estado del analizador y degrada si la red falla', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ status: 'ok', analyzer: 'ok', analyzerVersion: 'v1' })),
    );
    await expect(getHealth()).resolves.toEqual({ analyzer: 'ok', analyzerVersion: 'v1' });

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('sin red'))));
    await expect(getHealth()).resolves.toEqual({ analyzer: 'down', analyzerVersion: 'unknown' });
  });
});

describe('pollAnalysis', () => {
  it('hace polling hasta done y publica las actualizaciones', async () => {
    const views = [
      { id: 'job-1', status: 'queued', progress: 0 },
      { id: 'job-1', status: 'processing', progress: 60 },
      { id: 'job-1', status: 'done', progress: 100, result: doneResult() },
    ];
    const fetchMock = vi.fn(async () => response(views.shift()));
    vi.stubGlobal('fetch', fetchMock);
    const onUpdate = vi.fn();

    const result = await pollAnalysis('job-1', { intervalMs: 1, onUpdate });
    expect(result.duration).toBe(8);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onUpdate).toHaveBeenCalledTimes(3);
  });

  it('lanza el error del trabajo cuando el estado es error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({
          id: 'job-1',
          status: 'error',
          progress: 0,
          error: { code: 'VIDEO_UNAVAILABLE', message: 'Video privado' },
        }),
      ),
    );

    await expect(pollAnalysis('job-1', { intervalMs: 1 })).rejects.toMatchObject({
      code: 'VIDEO_UNAVAILABLE',
      message: 'Video privado',
    });
  });

  it('se cancela con AbortSignal', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        controller.abort();
        return response({ id: 'job-1', status: 'processing', progress: 10 });
      }),
    );

    await expect(
      pollAnalysis('job-1', { intervalMs: 1000, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
