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

describe('PlayerHost', () => {
  it('limits video width in the compact variant without distorting the aspect ratio', () => {
    render(
      <PlayerHost
        song={song({ type: 'youtube', videoId: 'dQw4w9WgXcQ' })}
        audioUrl={null}
        forceFake={false}
        pitch={0}
        variant="compact"
        onAdapter={vi.fn()}
        onPlaybackError={vi.fn()}
      />,
    );

    const video = screen.getByTestId('player-video');
    expect(video).toHaveAttribute('data-variant', 'compact');
    expect(video.className).toContain('w-full');
    expect(video.className).toContain('aspect-video');
  });

  it('keeps the audio player working in the compact variant', () => {
    render(
      <PlayerHost
        song={song({ type: 'upload', filename: 'demo.mp3' })}
        audioUrl="blob:demo"
        forceFake={false}
        pitch={0}
        variant="compact"
        onAdapter={vi.fn()}
        onPlaybackError={vi.fn()}
      />,
    );

    const audio = document.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio).toHaveAttribute('src', 'blob:demo');
  });
});
describe('PlayerHost temporary audio', () => {
  beforeEach(() => {
    prepareMock.mockReset();
  });

  it('does not request temporary audio when the pitch is zero', () => {
    render(
      <PlayerHost
        song={song({ type: 'youtube', videoId: 'dQw4w9WgXcQ' })}
        audioUrl={null}
        forceFake={false}
        pitch={0}
        onAdapter={vi.fn()}
        onPlaybackError={vi.fn()}
      />,
    );

    expect(prepareMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('player-video')).toBeInTheDocument();
  });

  it('shows the preparation state and then plays the temporary audio', async () => {
    let resolve: (value: { url: string }) => void = () => undefined;
    prepareMock.mockReturnValue(
      new Promise((promiseResolve) => {
        resolve = promiseResolve;
      }),
    );

    render(
      <PlayerHost
        song={song({ type: 'youtube', videoId: 'dQw4w9WgXcQ' })}
        audioUrl={null}
        forceFake={false}
        pitch={4}
        onAdapter={vi.fn()}
        onPlaybackError={vi.fn()}
      />,
    );

    expect(prepareMock).toHaveBeenCalledWith('dQw4w9WgXcQ', expect.any(AbortSignal));
    expect(screen.getByRole('status')).toHaveTextContent('Preparando el audio temporal');

    resolve({ url: '/api/youtube/dQw4w9WgXcQ/audio' });

    await waitFor(() => {
      expect(document.querySelector('audio')).toHaveAttribute(
        'src',
        '/api/youtube/dQw4w9WgXcQ/audio',
      );
    });
    expect(screen.queryByTestId('player-video')).not.toBeInTheDocument();
    expect(screen.getByText(/El tono se aplica a un audio temporal/)).toBeInTheDocument();
  });

  it('keeps the video and reports the problem when the audio cannot be prepared', async () => {
    prepareMock.mockRejectedValue(new Error('download failed'));

    render(
      <PlayerHost
        song={song({ type: 'youtube', videoId: 'dQw4w9WgXcQ' })}
        audioUrl={null}
        forceFake={false}
        pitch={4}
        onAdapter={vi.fn()}
        onPlaybackError={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No se pudo preparar el audio temporal',
      );
    });
    expect(screen.getByTestId('player-video')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
