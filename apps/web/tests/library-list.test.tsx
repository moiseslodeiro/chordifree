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
  it('lista las canciones con origen y duración', () => {
    renderLibrary();
    expect(screen.getByText('Primera canción')).toBeInTheDocument();
    expect(screen.getByText('Audio local')).toBeInTheDocument();
    expect(screen.getByText('YouTube')).toBeInTheDocument();
    expect(screen.getByText('Audio subido')).toBeInTheDocument();
    expect(screen.getByText('01:24')).toBeInTheDocument();
    expect(screen.getByText('02:05')).toBeInTheDocument();
  });

  it('abre una canción al pulsar Abrir', () => {
    const { onOpen } = renderLibrary();
    fireEvent.click(screen.getAllByRole('button', { name: 'Abrir' })[0]!);
    expect(onOpen).toHaveBeenCalledWith('a');
  });

  it('elimina solo tras confirmar', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onDelete } = renderLibrary();
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]!);
    expect(confirm).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith('a');
  });

  it('no elimina si se cancela la confirmación', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onDelete } = renderLibrary();
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]!);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('muestra un estado vacío', () => {
    renderLibrary({ songs: [] });
    expect(screen.getByText('Todavía no hay canciones')).toBeInTheDocument();
  });

  it('exporta la biblioteca y delega la importación del archivo', () => {
    const { onExport, onImport } = renderLibrary();

    fireEvent.click(screen.getByRole('button', { name: 'Exportar JSON' }));
    expect(onExport).toHaveBeenCalledTimes(1);

    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText(/Copia de seguridad/), {
      target: { files: [file] },
    });
    expect(onImport).toHaveBeenCalledWith(file);
  });

  it('deshabilita la exportación cuando no hay canciones', () => {
    renderLibrary({ songs: [] });
    expect(screen.getByRole('button', { name: 'Exportar JSON' })).toBeDisabled();
  });

  it('muestra el aviso de la copia de seguridad', () => {
    renderLibrary({
      notice: { message: 'Copia importada: 2 canciones nuevas y 0 actualizadas.', tone: 'success' },
    });
    expect(
      screen.getByText('Copia importada: 2 canciones nuevas y 0 actualizadas.'),
    ).toBeInTheDocument();
  });

  it('navega de vuelta y a analizar otra', () => {
    const { onBack, onHome } = renderLibrary();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analizar otra' }));
    expect(onBack).toHaveBeenCalled();
    expect(onHome).toHaveBeenCalled();
  });

  it('busca por título sin distinguir mayúsculas ni acentos', () => {
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

  it('filtra por origen sin duplicar las etiquetas de las canciones', () => {
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

  it('muestra un estado sin resultados y permite limpiar los filtros', () => {
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

  it('combina búsqueda y origen y los limpia con un solo botón', () => {
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
