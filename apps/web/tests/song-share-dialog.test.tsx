import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SongShareDialog } from '../src/components/SongShareDialog';
import type { Song } from '../src/types';

const song: Song = {
  id: 'song-1',
  title: 'Demo',
  source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
  duration: 60,
  segments: [],
  detectedSegments: [],
  analyzerVersion: 'test',
  transpose: 0,
  notation: 'english',
  accidentalPreference: 'sharp',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SongShareDialog', () => {
  it('focuses the close button and closes with Escape', () => {
    const onClose = vi.fn();
    render(
      <SongShareDialog
        song={song}
        getChordPro={() => '[C]Hola'}
        notice={null}
        onNotice={() => undefined}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('copies the chord sheet and reports success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const onNotice = vi.fn();
    render(
      <SongShareDialog
        song={song}
        getChordPro={() => '[C]Hola'}
        notice={null}
        onNotice={onNotice}
        onClose={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copiar hoja de acordes' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('[C]Hola'));
    expect(onNotice).toHaveBeenCalledWith({
      message: 'Hoja de acordes copiada.',
      tone: 'success',
    });
  });

  it('shows the notice it receives', () => {
    render(
      <SongShareDialog
        song={song}
        getChordPro={() => '[C]Hola'}
        notice={{ message: 'Enlace listo', tone: 'success' }}
        onNotice={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText('Enlace listo')).toBeInTheDocument();
  });
});
