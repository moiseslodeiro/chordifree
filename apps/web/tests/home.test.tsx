import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Home } from '../src/components/Home';
import { AnalysisCache } from '../src/storage/library';
import { createMemoryStorage } from '../src/storage/keys';
import { DEFAULT_PREFERENCES } from '../src/storage/preferences';
import type { AnalysisResult } from '../src/types';

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function analysisResult(): AnalysisResult {
  return {
    source: { type: 'youtube', videoId: 'dQw4w9WgXcQ', title: 'Canción de prueba' },
    duration: 8,
    segments: [
      { start: 0, end: 4, chord: { root: 0, quality: 'major' } },
      { start: 4, end: 8, chord: { root: 7, quality: 'major' } },
    ],
    analyzerVersion: 'essentia-1.0',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function renderHome(overrides: Partial<Parameters<typeof Home>[0]> = {}) {
  const onAnalyzed = vi.fn();
  const props: Parameters<typeof Home>[0] = {
    storage: createMemoryStorage(),
    preferences: DEFAULT_PREFERENCES,
    analyzerVersion: 'essentia-1.0',
    analyzerStatus: 'ok',
    libraryCount: 0,
    notice: null,
    onDismissNotice: vi.fn(),
    onOpenLibrary: vi.fn(),
    onAnalyzed,
    ...overrides,
  };
  render(<Home {...props} />);
  return { props, onAnalyzed };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Home', () => {
  it('validates the link before calling the server', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { onAnalyzed } = renderHome();

    fireEvent.change(screen.getByLabelText('Enlace del video'), {
      target: { value: 'https://example.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Detectar acordes' }));

    expect(await screen.findByText(/Introduce un enlace válido de YouTube/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onAnalyzed).not.toHaveBeenCalled();
  });

  it('analyzes a link and returns the song', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return response({
          id: 'job-1',
          status: 'queued',
          progress: 0,
          source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
        });
      }
      return response({
        id: 'job-1',
        status: 'done',
        progress: 100,
        result: analysisResult(),
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { onAnalyzed } = renderHome();

    fireEvent.change(screen.getByLabelText('Enlace del video'), {
      target: { value: 'https://youtu.be/dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Detectar acordes' }));

    await waitFor(() => expect(onAnalyzed).toHaveBeenCalledTimes(1));
    const song = onAnalyzed.mock.calls[0]?.[0];
    expect(song).toMatchObject({
      title: 'Canción de prueba',
      duration: 8,
      source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
    });
    expect(song.detectedSegments).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reuses the cache without calling the server', async () => {
    const storage = createMemoryStorage();
    const cache = new AnalysisCache(storage);
    cache.set('yt:dQw4w9WgXcQ', 'essentia-1.0', analysisResult());
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { onAnalyzed } = renderHome({ storage });

    fireEvent.change(screen.getByLabelText('Enlace del video'), {
      target: { value: 'https://youtu.be/dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Detectar acordes' }));

    await waitFor(() => expect(onAnalyzed).toHaveBeenCalledTimes(1));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the server error and allows retrying', async () => {
    const fetchMock = vi.fn(async () =>
      response(
        { error: { code: 'DURATION_EXCEEDED', message: 'El video supera los 15 minutos' } },
        422,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderHome();

    fireEvent.change(screen.getByLabelText('Enlace del video'), {
      target: { value: 'https://youtu.be/dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Detectar acordes' }));

    expect(await screen.findByText('El audio es demasiado largo.')).toBeInTheDocument();
    expect(screen.getByText('DURATION_EXCEEDED')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('validates the format of the uploaded file', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderHome();

    fireEvent.click(screen.getByRole('tab', { name: 'Archivo de audio' }));
    const file = new File(['texto'], 'notas.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Archivo de audio'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Detectar acordes' }));

    expect(await screen.findByText(/Formato no admitido/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uploads a valid audio file and returns the local URL', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return response({
          id: 'job-2',
          status: 'queued',
          progress: 0,
          source: { type: 'upload', filename: 'cancion.wav' },
        });
      }
      return response({
        id: 'job-2',
        status: 'done',
        progress: 100,
        result: {
          ...analysisResult(),
          source: { type: 'upload', filename: 'cancion.wav' },
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { onAnalyzed } = renderHome();

    fireEvent.click(screen.getByRole('tab', { name: 'Archivo de audio' }));
    const file = new File([new Uint8Array([1, 2, 3])], 'cancion.wav', { type: 'audio/wav' });
    fireEvent.change(screen.getByLabelText('Archivo de audio'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Detectar acordes' }));

    await waitFor(() => expect(onAnalyzed).toHaveBeenCalledTimes(1));
    expect(onAnalyzed.mock.calls[0]?.[1]).toBe('blob:test');
    expect(onAnalyzed.mock.calls[0]?.[0].source).toEqual({
      type: 'upload',
      filename: 'cancion.wav',
    });
  });

  it('searches YouTube and loads a result with the Chordifree button', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/api/youtube/search')) {
        return response({
          results: [
            {
              videoId: 'dQw4w9WgXcQ',
              title: 'Never Gonna Give You Up',
              uploader: 'Rick Astley',
              duration: 213,
              thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
            },
          ],
        });
      }
      if (init?.method === 'POST') {
        return response({
          id: 'job-3',
          status: 'queued',
          progress: 0,
          source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
        });
      }
      return response({
        id: 'job-3',
        status: 'done',
        progress: 100,
        result: analysisResult(),
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { onAnalyzed } = renderHome();

    fireEvent.change(screen.getByLabelText('Buscar en YouTube'), {
      target: { value: 'rick astley' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByText('Never Gonna Give You Up')).toBeInTheDocument();
    expect(screen.getByText('Rick Astley · 3:33')).toBeInTheDocument();
    expect(
      document.querySelector('img[src="https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg"]'),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Cargar Never Gonna Give You Up con Chordifree' }),
    );

    await waitFor(() => expect(onAnalyzed).toHaveBeenCalledTimes(1));
    expect(onAnalyzed.mock.calls[0]?.[0].source).toMatchObject({
      type: 'youtube',
      videoId: 'dQw4w9WgXcQ',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/youtube/search?q=rick+astley',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('requires a query before searching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderHome();

    fireEvent.change(screen.getByLabelText('Buscar en YouTube'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByText(/Escribe algo para buscar/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows an empty state when the search has no results', async () => {
    const fetchMock = vi.fn(async () => response({ results: [] }));
    vi.stubGlobal('fetch', fetchMock);
    renderHome();

    fireEvent.change(screen.getByLabelText('Buscar en YouTube'), {
      target: { value: 'nada que exista' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByText('Sin resultados. Prueba otra búsqueda.')).toBeInTheDocument();
  });

  it('hides the analyzer status on desktop and starts with upload', () => {
    window.chordifreeDesktop = { isDesktop: true };
    try {
      renderHome();
      expect(screen.queryByText('Estado del analizador')).not.toBeInTheDocument();
      expect(screen.getByText('Análisis local')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Archivo de audio' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('tab', { name: 'YouTube' })).toHaveAttribute(
        'aria-selected',
        'false',
      );
    } finally {
      delete window.chordifreeDesktop;
    }
  });
});
