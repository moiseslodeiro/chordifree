import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parseChord, type ChordSegment } from '@chordifree/chords';
import { ChordGrid } from '../src/components/ChordGrid';
import { FakePlayerAdapter } from '../src/player/fake';
import { PlaybackClock } from '../src/sync/clock';

const segments: ChordSegment[] = [
  { start: 0, end: 84, chord: parseChord('Am') },
  { start: 84, end: 90, chord: null },
  { start: 90, end: 120, chord: parseChord('F#') },
];

function setup() {
  const adapter = new FakePlayerAdapter(0, false);
  const clock = new PlaybackClock(adapter);
  clock.setSegments(segments);
  const onSeek = vi.fn();
  const view = render(
    <ChordGrid
      segments={segments}
      notation="english"
      accidental="sharp"
      clock={clock}
      onSeek={onSeek}
    />,
  );
  return { adapter, clock, onSeek, view };
}

describe('ChordGrid', () => {
  it('shows mm:ss time, chord, and silence', () => {
    setup();
    expect(screen.getByText('01:24')).toBeInTheDocument();
    expect(screen.getByText('Am')).toBeInTheDocument();
    expect(screen.getByText('F♯')).toBeInTheDocument();
    expect(screen.getByText('Silencio')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('marks the active row and updates it when seeking', () => {
    const { adapter, clock } = setup();
    const first = screen.getByTestId('chord-row-0');
    const second = screen.getByTestId('chord-row-1');
    expect(first).toHaveAttribute('data-active', 'true');
    expect(first).toHaveAttribute('aria-current', 'true');

    act(() => {
      adapter.seekTo(84);
      clock.tickOnce();
    });
    expect(first).toHaveAttribute('data-active', 'false');
    expect(second).toHaveAttribute('data-active', 'true');
    expect(screen.getByText(/Acorde activo: — en 01:24/)).toBeInTheDocument();
  });

  it('seeks to the start of the segment on click', () => {
    const { onSeek } = setup();
    fireEvent.click(screen.getByTestId('chord-row-2'));
    expect(onSeek).toHaveBeenCalledWith(90);
  });

  it('navigates with the arrow keys and seeks with Enter', () => {
    const { onSeek } = setup();
    const first = screen.getByTestId('chord-row-0');
    const second = screen.getByTestId('chord-row-1');

    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(second).toHaveFocus();

    fireEvent.keyDown(second, { key: 'ArrowDown' });
    expect(screen.getByTestId('chord-row-2')).toHaveFocus();

    fireEvent.keyDown(screen.getByTestId('chord-row-2'), { key: 'Home' });
    expect(first).toHaveFocus();

    fireEvent.keyDown(first, { key: 'End' });
    expect(screen.getByTestId('chord-row-2')).toHaveFocus();

    fireEvent.click(first);
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('respects the notation and accidentals', () => {
    const adapter = new FakePlayerAdapter(0, false);
    const clock = new PlaybackClock(adapter);
    clock.setSegments(segments);
    render(
      <ChordGrid
        segments={segments}
        notation="spanish"
        accidental="flat"
        clock={clock}
        onSeek={() => undefined}
      />,
    );
    expect(screen.getByText('Lam')).toBeInTheDocument();
    expect(screen.getByText('Sol♭')).toBeInTheDocument();
  });

  it('shows a message when there are no segments', () => {
    render(
      <ChordGrid
        segments={[]}
        notation="english"
        accidental="sharp"
        clock={null}
        onSeek={() => undefined}
      />,
    );
    expect(screen.getByText(/No se detectaron acordes/)).toBeInTheDocument();
  });
});
