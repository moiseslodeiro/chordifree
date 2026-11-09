import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Transport } from '../src/components/Transport';
import { FakePlayerAdapter } from '../src/player/fake';
import { PlaybackClock } from '../src/sync/clock';

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
  it('empieza en A al reproducir si el cursor está fuera del rango', () => {
    const { adapter } = setup({ time: 20, loopA: 4, loopB: 8 });

    fireEvent.click(screen.getByRole('button', { name: 'Reproducir' }));

    expect(adapter.getCurrentTime()).toBe(4);
    expect(adapter.isPlaying()).toBe(true);
  });

  it('mantiene la posición actual si ya está dentro del rango', () => {
    const { adapter } = setup({ time: 6, loopA: 4, loopB: 8 });

    fireEvent.click(screen.getByRole('button', { name: 'Reproducir' }));

    expect(adapter.getCurrentTime()).toBe(6);
    expect(adapter.isPlaying()).toBe(true);
  });

  it('para en B cuando el bucle está apagado', () => {
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

  it('no para en B cuando el bucle está encendido', () => {
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
