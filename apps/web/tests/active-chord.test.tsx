import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseChord, type ChordSegment } from '@chordifree/chords';
import { ActiveChordDiagram } from '../src/components/ActiveChordDiagram';
import { FakePlayerAdapter } from '../src/player/fake';
import { PlaybackClock } from '../src/sync/clock';

const segments: ChordSegment[] = [
  { start: 0, end: 4, chord: parseChord('C') },
  { start: 4, end: 8, chord: parseChord('G') },
];

describe('ActiveChordDiagram', () => {
  it('changes the diagram when the active segment advances', () => {
    const adapter = new FakePlayerAdapter(0, false);
    const clock = new PlaybackClock(adapter);
    clock.setSegments(segments);

    render(
      <ActiveChordDiagram
        segments={segments}
        clock={clock}
        instrument="guitar"
        notation="english"
        accidental="sharp"
      />,
    );

    expect(screen.getByRole('img', { name: /Guitarra: C\./ })).toBeInTheDocument();

    act(() => {
      adapter.seekTo(4);
      clock.tickOnce();
    });

    expect(screen.getByRole('img', { name: /Guitarra: G\./ })).toBeInTheDocument();
    clock.destroy();
  });

  it('shows the empty state with no active chord', () => {
    render(
      <ActiveChordDiagram
        segments={segments}
        clock={null}
        instrument="piano"
        notation="english"
        accidental="sharp"
      />,
    );
    expect(screen.getByRole('img', { name: 'Sin acorde activo' })).toBeInTheDocument();
  });
});
