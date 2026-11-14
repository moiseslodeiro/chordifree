import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlayerHost } from '../src/components/PlayerHost';
import type { Song } from '../src/types';

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
