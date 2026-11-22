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
  it('arms A and B to choose the bar on the grid', () => {
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

  it('enables looping when an A-B range already exists', () => {
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

  it('repeats the current bar from its start', () => {
    const { adapter } = setup(9);

    fireEvent.click(screen.getByRole('button', { name: 'Repetir compás' }));

    expect(adapter.getCurrentTime()).toBe(8);
    expect(screen.getByRole('button', { name: 'Bucle' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('00:08 – 00:12')).toBeInTheDocument();
  });

  it('counts in four beats before playing', () => {
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

  it('adjusts the count-in to a three-beat bar', () => {
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
