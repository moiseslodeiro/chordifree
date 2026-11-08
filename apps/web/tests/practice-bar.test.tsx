import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { parseChord, type ChordSegment } from '@chordifree/chords';
import { PracticeBar } from '../src/components/PracticeBar';
import { FakePlayerAdapter } from '../src/player/fake';
import { PlaybackClock } from '../src/sync/clock';

const beats = Array.from({ length: 16 }, (_, index) => index);
const segments: ChordSegment[] = [
  { start: 0, end: 8, chord: parseChord('C') },
  { start: 8, end: 16, chord: parseChord('G') },
];

function Harness({
  adapter,
  clock,
  beats: beatTimes,
  duration,
}: {
  adapter: FakePlayerAdapter;
  clock: PlaybackClock;
  beats: number[];
  duration: number;
}) {
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);

  return (
    <PracticeBar
      adapter={adapter}
      clock={clock}
      beats={beatTimes}
      beatsPerBar={4}
      duration={duration}
      loopA={loopA}
      loopB={loopB}
      onLoopAChange={setLoopA}
      onLoopBChange={setLoopB}
    />
  );
}

function setup(initialTime = 0, options: { beats?: number[]; duration?: number } = {}) {
  const adapter = new FakePlayerAdapter(initialTime, false);
  const clock = new PlaybackClock(adapter);
  clock.setSegments(segments);
  clock.setBeats(options.beats ?? beats);

  render(
    <Harness
      adapter={adapter}
      clock={clock}
      beats={options.beats ?? beats}
      duration={options.duration ?? 30}
    />,
  );

  return { adapter, clock };
}

describe('PracticeBar', () => {
  it('marca A y B por compases y activa el bucle', () => {
    const { adapter } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Marcar inicio A en el compás actual' }));
    expect(screen.getByRole('button', { name: 'Marcar inicio A en el compás actual' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Marca A y B')).toBeInTheDocument();

    act(() => {
      adapter.seekTo(4.2);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Marcar final B en el compás actual' }));
    expect(screen.getByText('00:00 – 00:08')).toBeInTheDocument();

    const loop = screen.getByRole('button', { name: 'Bucle' });
    expect(loop).toBeEnabled();
    fireEvent.click(loop);
    expect(loop).toHaveAttribute('aria-pressed', 'true');
  });

  it('repite el compás actual desde su inicio', () => {
    const { adapter } = setup(9);

    fireEvent.click(screen.getByRole('button', { name: 'Repetir compás' }));

    expect(adapter.getCurrentTime()).toBe(8);
    expect(screen.getByRole('button', { name: 'Bucle' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('00:08 – 00:12')).toBeInTheDocument();
  });

  it('cambia la velocidad del adaptador y la refleja en el selector', () => {
    const { adapter } = setup();
    const select = screen.getByRole('combobox', { name: 'Velocidad de reproducción' });
    expect(select).toHaveValue('1');
    expect(adapter.getPlaybackRate()).toBe(1);

    fireEvent.change(select, { target: { value: '0.75' } });

    expect(adapter.getPlaybackRate()).toBe(0.75);
    expect(select).toHaveValue('0.75');
  });

  it('desactiva el metrónomo cuando no hay pulsos detectados', () => {
    setup(0, { beats: [] });
    expect(screen.getByRole('button', { name: 'Metrónomo' })).toBeDisabled();
  });

  it('limpia el rango y desactiva el bucle', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar inicio A en el compás actual' }));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar final B en el compás actual' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bucle' }));
    expect(screen.getByRole('button', { name: 'Bucle' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));

    expect(screen.getByText('Marca A y B')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bucle' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Marcar inicio A en el compás actual' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('hace una cuenta de cuatro pulsos antes de reproducir', () => {
    vi.useFakeTimers();
    try {
      const { adapter } = setup();
      const countIn = screen.getByRole('button', { name: 'Cuenta atrás' });

      fireEvent.click(countIn);
      expect(screen.getByRole('button', { name: 'Contando…' })).toBeDisabled();
      expect(adapter.isPlaying()).toBe(false);

      act(() => {
        vi.advanceTimersByTime(4100);
      });

      expect(adapter.isPlaying()).toBe(true);
      expect(screen.getByRole('button', { name: 'Cuenta atrás' })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
