import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { createDemoSong } from '../src/demo';
import { setLanguage } from '../src/i18n';
import { encodeSongForShare } from '../src/lib/share';
import { KEYS } from '../src/storage/keys';
import { DEFAULT_PREFERENCES } from '../src/storage/preferences';

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const result: {
  source: { type: 'youtube'; videoId: string; title: string };
  duration: number;
  segments: Array<{
    start: number;
    end: number;
    chord: { root: number; quality: string } | null;
  }>;
  beats?: number[];
  beatsPerBar?: number;
  analyzerVersion: string;
  createdAt: string;
} = {
  source: { type: 'youtube', videoId: 'dQw4w9WgXcQ', title: 'Demo sincronizada' },
  duration: 8,
  segments: [
    { start: 0, end: 4, chord: { root: 0, quality: 'major' } },
    { start: 4, end: 8, chord: { root: 7, quality: 'major' } },
  ],
  analyzerVersion: 'essentia-1.0',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function stubApi(analysis: typeof result = result) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/health') {
      return response({ status: 'ok', analyzer: 'ok', analyzerVersion: 'essentia-1.0' });
    }
    if (init?.method === 'POST') {
      return response({
        id: 'job-1',
        status: 'queued',
        progress: 0,
        source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
      });
    }
    return response({ id: 'job-1', status: 'done', progress: 100, result: analysis });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function analyze() {
  const view = render(<App />);
  fireEvent.change(screen.getByLabelText('Enlace del video'), {
    target: { value: 'https://youtu.be/dQw4w9WgXcQ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Detectar acordes' }));
  expect(await screen.findByRole('heading', { name: 'Demo sincronizada' })).toBeInTheDocument();
  return view;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.chordifreeDesktop;
});

describe('App', () => {
  it('shows the update notice on desktop', async () => {
    stubApi();
    const openExternal = vi.fn();
    window.chordifreeDesktop = {
      isDesktop: true,
      platform: 'linux',
      checkForUpdates: vi.fn(async () => ({
        status: 'update' as const,
        version: '0.2.0',
        url: 'https://github.com/moiseslodeiro/chordifree/releases/tag/v0.2.0',
      })),
      openExternal,
    };

    render(<App />);

    expect(await screen.findByText(/0.2.0/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    expect(openExternal).toHaveBeenCalledWith(
      'https://github.com/moiseslodeiro/chordifree/releases/tag/v0.2.0',
    );
  });

  it('analyzes, changes notation and transposition, saves, and reloads from the library', async () => {
    stubApi();
    const view = await analyze();

    expect(screen.getByTestId('chord-row-0')).toHaveTextContent('C');
    expect(screen.getByTestId('chord-row-1')).toHaveTextContent('G');

    fireEvent.click(screen.getByRole('button', { name: 'Española' }));
    expect(screen.getByTestId('chord-row-0')).toHaveTextContent('Do');
    expect(screen.getByTestId('chord-row-1')).toHaveTextContent('Sol');

    // Automatic accidentals choose flats for the resulting key.
    fireEvent.change(screen.getByLabelText('Alteraciones'), { target: { value: 'sharp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Subir un semitono' }));
    expect(screen.getByTestId('chord-row-0')).toHaveTextContent('Do♯');
    expect(screen.getByTestId('chord-row-1')).toHaveTextContent('Sol♯');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar en biblioteca' }));
    expect(await screen.findByText('Canción guardada en la biblioteca.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Biblioteca' }));
    expect(await screen.findByText('Demo sincronizada')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(await screen.findByRole('heading', { name: 'Demo sincronizada' })).toBeInTheDocument();
    expect(screen.getByTestId('chord-row-0')).toHaveTextContent('Do♯');

    view.unmount();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Demo sincronizada' })).toBeInTheDocument();
    expect(screen.getByTestId('chord-row-0')).toHaveTextContent('Do♯');
    expect(screen.getByTestId('chord-row-1')).toHaveTextContent('Sol♯');
  });

  it('saves the lyrics with chords and restores them on reopen', async () => {
    stubApi();
    const view = await analyze();

    fireEvent.click(screen.getByRole('button', { name: 'Letra' }));
    expect(screen.getByText('Todavía no hay letra')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir letra' }));

    const field = screen.getByLabelText('Letra de la canción');
    fireEvent.change(field, { target: { value: 'Primera línea\nSegunda línea' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar letra' }));
    expect(await screen.findByText('Canción guardada en la biblioteca.')).toBeInTheDocument();

    const grid = within(screen.getByTestId('song-grid-column'));
    expect(grid.getByText('Primera línea')).toBeInTheDocument();
    expect(grid.getByText('Segunda línea')).toBeInTheDocument();
    expect(grid.getByRole('button', { name: 'C en 00:00' })).toBeInTheDocument();
    expect(grid.getByRole('button', { name: 'G en 00:04' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Editar letra' }));
    fireEvent.change(screen.getByLabelText('Letra de la canción'), {
      target: { value: 'Borrador sin guardar' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(grid.getByText('Primera línea')).toBeInTheDocument();
    expect(grid.queryByText('Borrador sin guardar')).not.toBeInTheDocument();

    view.unmount();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Demo sincronizada' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Letra' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const reopened = within(screen.getByTestId('song-grid-column'));
    expect(reopened.getByText('Primera línea')).toBeInTheDocument();
    expect(reopened.getByRole('button', { name: 'G en 00:04' })).toBeInTheDocument();
  });

  it('normalizes empty lyrics to no lyrics', async () => {
    stubApi();
    await analyze();

    fireEvent.click(screen.getByRole('button', { name: 'Letra' }));
    fireEvent.click(screen.getByRole('button', { name: 'Añadir letra' }));
    fireEvent.change(screen.getByLabelText('Letra de la canción'), {
      target: { value: '   \n  \n' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar letra' }));

    expect(await screen.findByText('Canción guardada en la biblioteca.')).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay letra')).toBeInTheDocument();
  });

  it('updates the lyrics chords with the presentation and leaves the text untouched', async () => {
    stubApi({
      ...result,
      segments: [
        { start: 0, end: 2, chord: { root: 0, quality: 'maj7' } },
        { start: 2, end: 2.4, chord: { root: 7, quality: 'major' } },
        { start: 2.4, end: 8, chord: { root: 9, quality: 'm7' } },
      ],
    });
    await analyze();

    fireEvent.click(screen.getByRole('button', { name: 'Letra' }));
    fireEvent.click(screen.getByRole('button', { name: 'Añadir letra' }));
    fireEvent.change(screen.getByLabelText('Letra de la canción'), {
      target: { value: 'Línea uno\nLínea dos' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar letra' }));
    expect(await screen.findByText('Canción guardada en la biblioteca.')).toBeInTheDocument();

    const grid = within(screen.getByTestId('song-grid-column'));
    expect(grid.getByRole('button', { name: /^Cmaj7 en/ })).toBeInTheDocument();
    expect(grid.getByRole('button', { name: /^Am7 en/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Simplificar acordes/ }));
    expect(grid.getByRole('button', { name: /^C en/ })).toBeInTheDocument();
    expect(grid.getByRole('button', { name: /^Am en/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reducir acordes/ }));
    expect(grid.queryByRole('button', { name: /^G en/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Española' }));
    expect(grid.getByRole('button', { name: /^Do en/ })).toBeInTheDocument();
    expect(grid.getByRole('button', { name: /^Lam en/ })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Alteraciones'), { target: { value: 'sharp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Subir un semitono' }));
    expect(grid.getByRole('button', { name: /^Do♯ en/ })).toBeInTheDocument();
    expect(grid.getByRole('button', { name: /^La♯m en/ })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Capo'), { target: { value: '2' } });
    expect(grid.getByRole('button', { name: /^Si en/ })).toBeInTheDocument();
    expect(grid.getByRole('button', { name: /^Sol♯m en/ })).toBeInTheDocument();

    expect(grid.getByText('Línea uno')).toBeInTheDocument();
    expect(grid.getByText('Línea dos')).toBeInTheDocument();
  });

  it('keeps the lyrics timings with maximum reduction', async () => {
    stubApi({
      ...result,
      duration: 8,
      beats: [0, 1, 2, 3, 4, 5, 6, 7],
      beatsPerBar: 4,
      segments: [
        { start: 0, end: 2, chord: { root: 0, quality: 'major' } },
        { start: 2, end: 4, chord: { root: 7, quality: 'major' } },
        { start: 4, end: 6, chord: { root: 9, quality: 'minor' } },
        { start: 6, end: 8, chord: { root: 5, quality: 'major' } },
      ],
    });
    await analyze();

    fireEvent.click(screen.getByRole('button', { name: 'Letra' }));
    fireEvent.click(screen.getByRole('button', { name: 'Añadir letra' }));
    fireEvent.change(screen.getByLabelText('Letra de la canción'), {
      target: { value: 'Primera línea\nSegunda línea' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar letra' }));

    const grid = within(screen.getByTestId('song-grid-column'));
    expect(grid.getByRole('button', { name: /^G en/ })).toBeInTheDocument();
    expect(grid.getByRole('button', { name: /^F en/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reducir acordes/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Reducir al máximo' }));

    expect(grid.getByRole('button', { name: /^G en/ })).toBeInTheDocument();
    expect(grid.getByRole('button', { name: /^F en/ })).toBeInTheDocument();
    expect(grid.getByRole('button', { name: /^C en/ })).toBeInTheDocument();
    expect(grid.getByRole('button', { name: /^Am en/ })).toBeInTheDocument();
  });

  it('places the dominant chord at its actual time when reducing to the maximum', async () => {
    stubApi({
      ...result,
      duration: 4,
      beats: [0, 1, 2, 3],
      beatsPerBar: 4,
      segments: [
        { start: 0, end: 1.6, chord: { root: 0, quality: 'major' } },
        { start: 1.6, end: 4, chord: { root: 7, quality: 'major' } },
      ],
    });
    await analyze();

    fireEvent.click(screen.getByRole('button', { name: /Reducir acordes/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Reducir al máximo' }));

    expect(screen.getByTestId('beat-cell-0')).toHaveTextContent('C');
    expect(screen.getByTestId('beat-cell-1')).not.toHaveTextContent('G');
    expect(screen.getByTestId('beat-cell-2')).toHaveTextContent('G');
  });

  it('edits a chord, saves, and keeps the correction on reopen', async () => {
    stubApi();
    await analyze();

    fireEvent.click(screen.getByRole('button', { name: 'Editar acordes' }));
    const field = screen.getAllByLabelText('Acorde del segmento')[0]!;
    fireEvent.change(field, { target: { value: 'A7' } });
    fireEvent.blur(field);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(screen.getByTestId('chord-row-0')).toHaveTextContent('A7');
    // Saving in the editor already persists the correction to the library.
    expect(await screen.findByText('Canción guardada en la biblioteca.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Biblioteca' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir' }));
    expect(await screen.findByTestId('chord-row-0')).toHaveTextContent('A7');
  });

  it('shows the error state and allows retrying', async () => {
    let attempts = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/health') {
        return response({ status: 'ok', analyzer: 'down', analyzerVersion: 'essentia-1.0' });
      }
      if (init?.method === 'POST') {
        attempts += 1;
        return response({ error: { code: 'VIDEO_UNAVAILABLE', message: 'Video privado' } }, 422);
      }
      return response({});
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    fireEvent.change(screen.getByLabelText('Enlace del video'), {
      target: { value: 'https://youtu.be/dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Detectar acordes' }));

    expect(await screen.findByText(/El video no está disponible/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(attempts).toBe(2));
  });

  it('simplifies only the display and restores the original chord notation when disabled', async () => {
    stubApi({
      ...result,
      segments: [
        { start: 0, end: 4, chord: { root: 0, quality: 'maj7' } },
        { start: 4, end: 8, chord: { root: 9, quality: 'm7' } },
      ],
    });
    await analyze();

    expect(within(screen.getByTestId('chord-row-0')).getByText('Cmaj7')).toBeInTheDocument();
    expect(within(screen.getByTestId('chord-row-1')).getByText('Am7')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Simplificar acordes/ }));
    expect(within(screen.getByTestId('chord-row-0')).getByText('C')).toBeInTheDocument();
    expect(within(screen.getByTestId('chord-row-1')).getByText('Am')).toBeInTheDocument();

    // The editor still sees the original chords.
    fireEvent.click(screen.getByRole('button', { name: 'Editar acordes' }));
    expect(screen.getAllByLabelText('Acorde del segmento')[0]).toHaveValue('Cmaj7');
    fireEvent.click(screen.getByRole('button', { name: 'Salir de edición' }));

    fireEvent.click(screen.getByRole('button', { name: /Simplificar acordes/ }));
    expect(within(screen.getByTestId('chord-row-0')).getByText('Cmaj7')).toBeInTheDocument();
    expect(within(screen.getByTestId('chord-row-1')).getByText('Am7')).toBeInTheDocument();
  });

  it('reduces passing chords only in the display', async () => {
    stubApi({
      ...result,
      beats: [0, 1, 2, 3, 4, 5, 6, 7],
      beatsPerBar: 4,
      segments: [
        { start: 0, end: 4, chord: { root: 0, quality: 'major' } },
        { start: 4, end: 4.4, chord: { root: 7, quality: 'major' } },
        { start: 4.4, end: 8, chord: { root: 9, quality: 'm7' } },
      ],
    });
    await analyze();

    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    expect(screen.getAllByTestId(/chord-row-/)).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /Reducir acordes/ }));
    expect(screen.getAllByTestId(/chord-row-/)).toHaveLength(2);
    const grid = within(screen.getByTestId('song-grid-column'));
    expect(grid.queryByText('G')).not.toBeInTheDocument();
    expect(grid.getByText('Am')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Editar acordes' }));
    expect(screen.getAllByLabelText('Acorde del segmento')).toHaveLength(3);
    expect(screen.getAllByLabelText('Acorde del segmento')[1]).toHaveValue('G');
  });

  it('reduces to the maximum of one chord per bar only in the display', async () => {
    stubApi({
      ...result,
      beats: [0, 1, 2, 3, 4, 5, 6, 7],
      beatsPerBar: 4,
      segments: [
        { start: 0, end: 2, chord: { root: 0, quality: 'major' } },
        { start: 2, end: 4, chord: { root: 7, quality: 'major' } },
        { start: 4, end: 6, chord: { root: 9, quality: 'minor' } },
        { start: 6, end: 8, chord: { root: 5, quality: 'major' } },
      ],
    });
    await analyze();

    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    expect(screen.getAllByTestId(/chord-row-/)).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: /Reducir acordes/ }));
    expect(screen.getAllByTestId(/chord-row-/)).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: 'Reducir al máximo' }));
    expect(screen.getAllByTestId(/chord-row-/)).toHaveLength(2);
    const grid = within(screen.getByTestId('song-grid-column'));
    expect(grid.getByText('C')).toBeInTheDocument();
    expect(grid.getByText('Am')).toBeInTheDocument();

    // Editing still works on the original line.
    fireEvent.click(screen.getByRole('button', { name: 'Editar acordes' }));
    expect(screen.getAllByLabelText('Acorde del segmento')).toHaveLength(4);
  });

  it('lays out the grid on the left and the video with the tools on the right', async () => {
    stubApi({
      ...result,
      beats: [0, 1, 2, 3, 4, 5, 6, 7],
      beatsPerBar: 4,
    });
    await analyze();

    const gridColumn = screen.getByTestId('song-grid-column');
    const toolsColumn = screen.getByTestId('song-tools-column');
    expect(within(gridColumn).getByTestId('beat-row-0')).toBeInTheDocument();
    expect(within(toolsColumn).getByRole('region', { name: 'Reproductor' })).toBeInTheDocument();
    const details = within(toolsColumn).getByRole('region', { name: 'Detalles de la canción' });
    expect(details).toBeInTheDocument();
    const activeChord = within(toolsColumn).getByText('Acorde activo');
    // The info block goes below the chord diagrams.
    expect(
      activeChord.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Presentation and instrument live in the top bar, not in the column.
    expect(screen.getByLabelText('Instrumento')).toBeInTheDocument();
    expect(within(toolsColumn).queryByLabelText('Instrumento')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Editar acordes' }));
    expect(
      within(gridColumn).getByRole('region', { name: 'Editor de acordes' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Instrumento')).toBeInTheDocument();
  });

  it('shows the song details and the estimated tempo below the video', async () => {
    stubApi({
      ...result,
      beats: [0, 1, 2, 3, 4, 5, 6, 7],
      beatsPerBar: 4,
    });
    await analyze();

    const details = screen.getByRole('region', { name: 'Detalles de la canción' });
    expect(within(details).getByText('BPM')).toBeInTheDocument();
    expect(within(details).getByText('60')).toBeInTheDocument();
    expect(within(details).getByText('4/4')).toBeInTheDocument();
    expect(within(details).getByText('00:08')).toBeInTheDocument();
    expect(within(details).getByText('—')).toBeInTheDocument();
    expect(
      within(details).getByRole('list', { name: 'Acordes de la canción' }),
    ).toBeInTheDocument();
  });

  it('persists the list view and uses it when reopening the song', async () => {
    stubApi();
    await analyze();

    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    expect(screen.getByTestId('chord-row-0')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar en biblioteca' }));
    expect(await screen.findByText('Canción guardada en la biblioteca.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Biblioteca' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir' }));
    expect(await screen.findByRole('heading', { name: 'Demo sincronizada' })).toBeInTheDocument();
    expect(screen.getByTestId('chord-row-0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens an old song without beats in list view with a notice', async () => {
    stubApi({ ...result, beats: undefined, beatsPerBar: undefined });
    await analyze();

    expect(
      await screen.findByText(
        'No se detectaron pulsos en esta canción; se muestra la vista de lista.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('chord-row-0')).toBeInTheDocument();
  });

  it('starts in light theme and allows switching to dark', async () => {
    stubApi();
    await analyze();

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    fireEvent.click(screen.getByRole('button', { name: /Tema claro/ }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    fireEvent.click(screen.getByRole('button', { name: /Tema oscuro/ }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('starts in English and allows switching to Spanish', async () => {
    stubApi();
    setLanguage('en');
    window.localStorage.setItem(
      KEYS.preferences,
      JSON.stringify({ schemaVersion: 1, data: { language: 'en' } }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Analyze a song' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Detect chords' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ES' }));

    expect(
      await screen.findByRole('heading', { name: 'Analiza una canción' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Detectar acordes' })).toBeInTheDocument();
  });

  it('shows the footer with links to the project', () => {
    stubApi();
    render(<App />);

    const footer = screen.getByTestId('site-footer');
    expect(footer).toHaveTextContent('GitHub');
    expect(footer).toHaveTextContent('AGPL-3.0');
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/moiseslodeiro/chordifree',
    );
  });

  it('opens the built-in demo without uploading files', async () => {
    stubApi();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Probar la demo' }));

    expect(
      await screen.findByRole('heading', { name: /Chordifree demo/ }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('beat-cell-0')).toHaveTextContent('C');
    expect(screen.getByRole('button', { name: 'Guardar en biblioteca' })).toBeInTheDocument();
  });

  it('creates a setlist, adds a song, and opens it', async () => {
    stubApi();
    await analyze();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en biblioteca' }));
    fireEvent.click(screen.getByRole('button', { name: 'Listas' }));

    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Ensayo');
    fireEvent.click(screen.getAllByRole('button', { name: 'Nueva lista' })[0]!);
    prompt.mockRestore();

    expect(await screen.findByRole('heading', { name: 'Ensayo' })).toBeInTheDocument();
    const select = screen.getByLabelText('Añadir canción');
    const option = within(select).getByRole('option', {
      name: 'Demo sincronizada',
    }) as HTMLOptionElement;
    fireEvent.change(select, { target: { value: option.value } });

    expect((await screen.findAllByText('Demo sincronizada')).length).toBeGreaterThan(0);
  });

  it('opens the empty library from the home screen', async () => {
    stubApi();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Biblioteca \(0\)/ }));
    expect(await screen.findByText('Todavía no hay canciones')).toBeInTheDocument();
  });

  it('imports a shared song from the hash', async () => {
    stubApi();
    const song = createDemoSong(DEFAULT_PREFERENCES);
    const token = await encodeSongForShare(song);
    window.location.hash = `#share=${token}`;

    render(<App />);

    expect(await screen.findByRole('heading', { name: song.title })).toBeInTheDocument();
    expect(window.location.hash.startsWith('#/song/')).toBe(true);
  });
});
