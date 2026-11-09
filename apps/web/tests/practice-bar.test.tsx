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
  beatsPerBar,
  duration,
  initialA = null,
  initialB = null,
  initialLoop = false,
}: {
  adapter: FakePlayerAdapter;
  clock: PlaybackClock;
  beats: number[];
  beatsPerBar: number;
  duration: number;
  initialA?: number | null;
  initialB?: number | null;
  initialLoop?: boolean;
}) {
  const [loopA, setLoopA] = useState<number | null>(initialA);
  const [loopB, setLoopB] = useState<number | null>(initialB);
  const [loopEnabled, setLoopEnabled] = useState(initialLoop);
  const [markMode, setMarkMode] = useState<'a' | 'b' | null>(null);
  const [rate, setRate] = useState(1);
  const [manualBpm, setManualBpm] = useState(90);

  return (
    <PracticeBar
      adapter={adapter}
      clock={clock}
      beats={beatTimes}
      beatsPerBar={beatsPerBar}
      duration={duration}
      loopA={loopA}
      loopB={loopB}
      loopEnabled={loopEnabled}
      onLoopAChange={setLoopA}
      onLoopBChange={setLoopB}
      onLoopEnabledChange={setLoopEnabled}
      markMode={markMode}
      onMarkModeChange={setMarkMode}
      rate={rate}
      onRateChange={setRate}
      manualBpm={manualBpm}
      onManualBpmChange={setManualBpm}
    />
  );
}

function setup(
  initialTime = 0,
  options: {
    beats?: number[];
    duration?: number;
    beatsPerBar?: number;
    initialA?: number | null;
    initialB?: number | null;
    initialLoop?: boolean;
  } = {},
) {
  const adapter = new FakePlayerAdapter(initialTime, false);
  const clock = new PlaybackClock(adapter);
  clock.setSegments(segments);
  clock.setBeats(options.beats ?? beats);

  render(
    <Harness
      adapter={adapter}
      clock={clock}
      beats={options.beats ?? beats}
      beatsPerBar={options.beatsPerBar ?? 4}
      duration={options.duration ?? 30}
      initialA={options.initialA}
      initialB={options.initialB}
      initialLoop={options.initialLoop}
    />,
  );

  return { adapter, clock };
}

describe('PracticeBar', () => {
  it('arma A y B para elegir el compás en la parrilla', () => {
    setup();

    const a = screen.getByRole('button', { name: 'Marcar inicio A' });
    const b = screen.getByRole('button', { name: 'Marcar final B' });

    fireEvent.click(a);
    expect(a).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Pulsa un compás para A')).toBeInTheDocument();
    expect(b).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(a);
    expect(a).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Marca A y B')).toBeInTheDocument();

    fireEvent.click(b);
    expect(b).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Pulsa un compás para B')).toBeInTheDocument();
  });

  it('activa el bucle cuando ya hay rango A-B', () => {
    setup(0, { initialA: 0, initialB: 8 });

    expect(screen.getByText('00:00 – 00:08')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar inicio A' })).toHaveAttribute(
      'data-set',
      'true',
    );

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

    fireEvent.change(select, { target: { value: '1.25' } });
    expect(adapter.getPlaybackRate()).toBe(1.25);
    expect(select).toHaveValue('1.25');

    fireEvent.change(select, { target: { value: '1.5' } });
    expect(adapter.getPlaybackRate()).toBe(1.5);
    expect(select).toHaveValue('1.5');
  });

  it('habilita el metrónomo manual con BPM cuando no hay pulsos', () => {
    setup(0, { beats: [] });
    const metronome = screen.getByRole('button', { name: 'Metrónomo' });
    expect(metronome).toBeEnabled();

    const bpm = screen.getByLabelText('BPM del metrónomo');
    expect(bpm).toHaveValue(90);
    fireEvent.change(bpm, { target: { value: '120' } });
    fireEvent.blur(bpm);
    expect(screen.getByLabelText('BPM del metrónomo')).toHaveValue(120);

    fireEvent.click(metronome);
    expect(metronome).toHaveAttribute('aria-pressed', 'true');
  });

  it('limpia el rango y desactiva el bucle', () => {
    setup(0, { initialA: 0, initialB: 8, initialLoop: true });
    expect(screen.getByRole('button', { name: 'Bucle' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));

    expect(screen.getByText('Marca A y B')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bucle' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bucle' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Marcar inicio A' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Marcar final B' })).not.toHaveAttribute(
      'data-set',
    );
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

  it('ajusta la cuenta atrás al compás de tres tiempos', () => {
    vi.useFakeTimers();
    try {
      const { adapter } = setup(0, { beatsPerBar: 3 });
      fireEvent.click(screen.getByRole('button', { name: 'Cuenta atrás' }));

      act(() => {
        vi.advanceTimersByTime(2900);
      });
      expect(screen.getByRole('button', { name: 'Contando…' })).toBeDisabled();
      expect(adapter.isPlaying()).toBe(false);

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(adapter.isPlaying()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
