import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LibraryList } from '../src/components/LibraryList';
import type { SongSummary } from '../src/types';

const songs: SongSummary[] = [
  {
    id: 'a',
    title: 'Primera canción',
    source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
    duration: 84,
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'b',
    title: 'Audio local',
    source: { type: 'upload', filename: 'demo.wav' },
    duration: 125,
    updatedAt: '2026-10-02T10:00:00.000Z',
  },
];

function renderLibrary(overrides: Partial<Parameters<typeof LibraryList>[0]> = {}) {
  const onOpen = vi.fn();
  const onDelete = vi.fn();
  const onBack = vi.fn();
  const onHome = vi.fn();
  const onExport = vi.fn();
  const onImport = vi.fn();
  render(
    <LibraryList
      songs={songs}
      onOpen={onOpen}
      onDelete={onDelete}
      onBack={onBack}
      onHome={onHome}
      onExport={onExport}
      onImport={onImport}
      {...overrides}
    />,
  );
  return { onOpen, onDelete, onBack, onHome, onExport, onImport };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LibraryList', () => {
  it('lists songs with source and duration', () => {
    renderLibrary();
    expect(screen.getByText('Primera canción')).toBeInTheDocument();
    expect(screen.getByText('Audio local')).toBeInTheDocument();
    expect(screen.getByText('YouTube')).toBeInTheDocument();
    expect(screen.getByText('Audio subido')).toBeInTheDocument();
    expect(screen.getByText('01:24')).toBeInTheDocument();
    expect(screen.getByText('02:05')).toBeInTheDocument();
  });

  it('shows the temporary audio usage and clears it', () => {
    const onClearAudioCache = vi.fn();
    renderLibrary({
      audioCache: { entries: 2, bytes: 2048, ttlMinutes: 60 },
      onClearAudioCache,
    });

    expect(
      screen.getByText('Audio temporal de YouTube: 2 archivos · 2.0 KB · se conserva unos 60 min'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Borrar audio temporal' }));
    expect(onClearAudioCache).toHaveBeenCalled();
  });

  it('shows that a local cache is kept until cleared', () => {
    renderLibrary({
      audioCache: { entries: 1, bytes: 1024, ttlMinutes: 0 },
      onClearAudioCache: vi.fn(),
    });

    expect(
      screen.getByText(
        'Audio temporal de YouTube: 1 archivo · 1.0 KB · se conserva hasta que la borres',
      ),
    ).toBeInTheDocument();
  });

  it('opens a song when clicking Open', () => {
    const { onOpen } = renderLibrary();
    fireEvent.click(screen.getAllByRole('button', { name: 'Abrir' })[0]!);
    expect(onOpen).toHaveBeenCalledWith('a');
  });

  it('deletes only after confirmation', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onDelete } = renderLibrary();
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]!);
    expect(confirm).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith('a');
  });

  it('does not delete when confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onDelete } = renderLibrary();
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]!);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('shows an empty state', () => {
    renderLibrary({ songs: [] });
    expect(screen.getByText('Todavía no hay canciones')).toBeInTheDocument();
  });

  it('exports the library and delegates file import', () => {
    const { onExport, onImport } = renderLibrary();

    fireEvent.click(screen.getByRole('button', { name: 'Exportar JSON' }));
    expect(onExport).toHaveBeenCalledTimes(1);

    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText(/Copia de seguridad/), {
      target: { files: [file] },
    });
    expect(onImport).toHaveBeenCalledWith(file);
  });

  it('disables export when there are no songs', () => {
    renderLibrary({ songs: [] });
    expect(screen.getByRole('button', { name: 'Exportar JSON' })).toBeDisabled();
  });

  it('shows the backup notice', () => {
    renderLibrary({
      notice: { message: 'Copia importada: 2 canciones nuevas y 0 actualizadas.', tone: 'success' },
    });
    expect(
      screen.getByText('Copia importada: 2 canciones nuevas y 0 actualizadas.'),
    ).toBeInTheDocument();
  });

  it('navigates back and to analyze another one', () => {
    const { onBack, onHome } = renderLibrary();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analizar otra' }));
    expect(onBack).toHaveBeenCalled();
    expect(onHome).toHaveBeenCalled();
  });

  it('searches by title ignoring case and accents', () => {
    renderLibrary();
    const search = screen.getByRole('searchbox', { name: 'Buscar canciones' });

    fireEvent.change(search, { target: { value: 'AUDIO' } });
    expect(screen.getByText('Audio local')).toBeInTheDocument();
    expect(screen.queryByText('Primera canción')).not.toBeInTheDocument();
    expect(screen.getByText('1 de 2 canciones')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'cancion' } });
    expect(screen.getByText('Primera canción')).toBeInTheDocument();
    expect(screen.queryByText('Audio local')).not.toBeInTheDocument();
  });

  it('filters by source without duplicating song labels', () => {
    renderLibrary();
    fireEvent.click(screen.getByRole('button', { name: 'Vídeos' }));

    expect(screen.getByText('Primera canción')).toBeInTheDocument();
    expect(screen.queryByText('Audio local')).not.toBeInTheDocument();
    expect(screen.getByText('1 de 2 canciones')).toBeInTheDocument();
    expect(screen.getAllByText('YouTube')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Archivos' }));
    expect(screen.queryByText('Primera canción')).not.toBeInTheDocument();
    expect(screen.getByText('Audio local')).toBeInTheDocument();
    expect(screen.getAllByText('Audio subido')).toHaveLength(1);
  });

  it('shows a no-results state and allows clearing the filters', () => {
    renderLibrary();
    const search = screen.getByRole('searchbox', { name: 'Buscar canciones' });

    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText('No hay canciones que coincidan')).toBeInTheDocument();
    expect(screen.getByText('0 de 2 canciones')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByText('Primera canción')).toBeInTheDocument();
    expect(screen.getByText('Audio local')).toBeInTheDocument();
    expect(search).toHaveValue('');
  });


  it('combines search and source and clears them with a single button', () => {
    renderLibrary();
    const search = screen.getByRole('searchbox', { name: 'Buscar canciones' });
    fireEvent.change(search, { target: { value: 'audio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vídeos' }));

    expect(screen.getByText('No hay canciones que coincidan')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(screen.getByText('Primera canción')).toBeInTheDocument();
    expect(screen.getByText('Audio local')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
