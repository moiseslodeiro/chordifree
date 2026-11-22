import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerHost } from '../src/components/PlayerHost';
import { prepareYoutubeAudio } from '../src/lib/api';
import type { Song } from '../src/types';

vi.mock('../src/lib/api', () => ({
  prepareYoutubeAudio: vi.fn(),
}));

const prepareMock = vi.mocked(prepareYoutubeAudio);

function song(source: Song['source']): Song {
  return {
    id: 'song-1',
    title: 'Demo',
    source,
    duration: 8,
    segments: [],
    detectedSegments: [],
    analyzerVersion: 'essentia-1.2',
    transpose: 0,
    notation: 'english',
    accidentalPreference: 'auto',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function renderHost(overrides: Partial<Parameters<typeof PlayerHost>[0]> = {}) {
  const props: Parameters<typeof PlayerHost>[0] = {
    song: song({ type: 'youtube', videoId: 'dQw4w9WgXcQ' }),
    audioUrl: null,
    forceFake: false,
    pitch: 0,
    onAdapter: vi.fn(),
    onPlaybackError: vi.fn(),
    ...overrides,
  };
  return { ...render(<PlayerHost {...props} />), props };
}

describe('PlayerHost', () => {
  beforeEach(() => {
    prepareMock.mockReset();
    prepareMock.mockResolvedValue({ url: '/api/youtube/dQw4w9WgXcQ/audio' });
  });

  it('shows the YouTube thumbnail instead of the video', () => {
    prepareMock.mockReturnValue(new Promise(() => undefined));
    renderHost({ variant: 'compact' });

    const thumbnail = screen.getByTestId('player-thumbnail');
    expect(thumbnail).toHaveAttribute('data-variant', 'compact');
    expect(thumbnail.className).toContain('max-w-[22rem]');
    expect(thumbnail.querySelector('img')).toHaveAttribute(
      'src',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    );
    expect(thumbnail.querySelector('img')).toHaveClass('aspect-video');
  });

  it('prepares the temporary audio when a YouTube song opens', async () => {
    renderHost();

    expect(prepareMock).toHaveBeenCalledWith('dQw4w9WgXcQ', expect.any(AbortSignal));
    await waitFor(() => {
      expect(document.querySelector('audio')).toHaveAttribute(
        'src',
        '/api/youtube/dQw4w9WgXcQ/audio',
      );
    });
  });

  it('does not request the audio again when the pitch changes', async () => {
    const { rerender, props } = renderHost();
    await waitFor(() => expect(document.querySelector('audio')).not.toBeNull());

    rerender(<PlayerHost {...props} pitch={4} />);
    expect(prepareMock).toHaveBeenCalledTimes(1);
  });

  it('shows the preparation state before the audio is ready', () => {
    prepareMock.mockReturnValue(new Promise(() => undefined));
    renderHost({ pitch: 4 });

    expect(screen.getByRole('status')).toHaveTextContent('Preparando el audio de YouTube');
  });

  it('keeps the thumbnail and reports a problem when the audio cannot be prepared', async () => {
    prepareMock.mockRejectedValue(new Error('download failed'));
    renderHost();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No se pudo preparar el audio de YouTube',
      );
    });
    expect(screen.getByTestId('player-thumbnail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(document.querySelector('audio')).toBeNull();
  });

  it('hides the audio element and delegates playback to the top bar', () => {
    renderHost({
      song: song({ type: 'upload', filename: 'demo.mp3' }),
      audioUrl: 'blob:demo',
    });

    const audio = document.querySelector('audio');
    expect(audio).toHaveAttribute('src', 'blob:demo');
    expect(audio).toHaveClass('hidden');
    expect(audio).not.toHaveAttribute('controls');
    expect(screen.getByText(/Usa la barra de reproducción superior/)).toBeInTheDocument();
    expect(prepareMock).not.toHaveBeenCalled();
  });
});
