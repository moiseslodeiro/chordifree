import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Transport } from '../src/components/Transport';
import { FakePlayerAdapter } from '../src/player/fake';
import { PlaybackClock } from '../src/sync/clock';
import { setLanguage } from '../src/i18n';

function setup({
  time = 0,
  loopA = null,
  loopB = null,
  loopEnabled = false,
}: {
  time?: number;
  loopA?: number | null;
  loopB?: number | null;
  loopEnabled?: boolean;
} = {}) {
  const adapter = new FakePlayerAdapter(time, false);
  const clock = new PlaybackClock(adapter);
  render(
    <Transport
      adapter={adapter}
      clock={clock}
      duration={30}
      loopA={loopA}
      loopB={loopB}
      loopEnabled={loopEnabled}
    />,
  );
  return { adapter, clock };
}

describe('Transport', () => {
  it('announces the position in the current language', () => {
    setLanguage('en');
    try {
      setup({ time: 0 });
      expect(screen.getByRole('slider', { name: 'Playback position' })).toHaveAttribute(
        'aria-valuetext',
        '00:00 of 00:30',
      );
    } finally {
      setLanguage('es');
    }
  });

  it('starts at A on play if the cursor is outside the range', () => {
    const { adapter } = setup({ time: 20, loopA: 4, loopB: 8 });

    fireEvent.click(screen.getByRole('button', { name: 'Reproducir' }));

    expect(adapter.getCurrentTime()).toBe(4);
    expect(adapter.isPlaying()).toBe(true);
  });

  it('keeps the current position if it is already inside the range', () => {
    const { adapter } = setup({ time: 6, loopA: 4, loopB: 8 });

    fireEvent.click(screen.getByRole('button', { name: 'Reproducir' }));

    expect(adapter.getCurrentTime()).toBe(6);
    expect(adapter.isPlaying()).toBe(true);
  });

  it('stops at B when looping is off', () => {
    vi.useFakeTimers();
    try {
      const { adapter } = setup({ time: 0, loopA: 0, loopB: 4 });

      fireEvent.click(screen.getByRole('button', { name: 'Reproducir' }));
      expect(adapter.isPlaying()).toBe(true);

      act(() => {
        adapter.advance(4.1);
        vi.advanceTimersByTime(100);
      });

      expect(adapter.isPlaying()).toBe(false);
      expect(adapter.getCurrentTime()).toBe(4);
      expect(screen.getByRole('button', { name: 'Reproducir' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not stop at B when looping is on', () => {
    vi.useFakeTimers();
    try {
      const { adapter } = setup({ time: 0, loopA: 0, loopB: 4, loopEnabled: true });

      fireEvent.click(screen.getByRole('button', { name: 'Reproducir' }));
      act(() => {
        adapter.advance(4.1);
        vi.advanceTimersByTime(100);
      });

      expect(adapter.isPlaying()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
