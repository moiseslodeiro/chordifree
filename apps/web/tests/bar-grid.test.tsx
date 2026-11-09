import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parseChord, type ChordSegment } from '@chordifree/chords';
import { BarGrid } from '../src/components/BarGrid';
import { ChordGrid } from '../src/components/ChordGrid';
import type { BarCell } from '../src/grid/barAlignment';
import { FakePlayerAdapter } from '../src/player/fake';
import { PlaybackClock } from '../src/sync/clock';

const bars: BarCell[] = [
  { start: 0, end: 4, index: 0, chord: parseChord('C') },
  { start: 4, end: 8, index: 1, chord: parseChord('G') },
  { start: 8, end: 12, index: 2, chord: parseChord('Am') },
  { start: 12, end: 16, index: 3, chord: parseChord('F') },
];

describe('BarGrid', () => {
  it('muestra un acorde por compás y permite seleccionarlo', () => {
    const onSelectBar = vi.fn();
    render(
      <BarGrid
        bars={bars}
        notation="english"
        accidental="sharp"
        clock={null}
        onSelectBar={onSelectBar}
      />,
    );

    expect(screen.getByTestId('bar-cell-0')).toHaveTextContent('C');
    expect(screen.getByTestId('bar-cell-1')).toHaveTextContent('G');
    fireEvent.click(screen.getByTestId('bar-cell-1'));
    expect(onSelectBar).toHaveBeenCalledWith(4);
  });

  it('resalta el compás activo', () => {
    const adapter = new FakePlayerAdapter(4, false);
    const clock = new PlaybackClock(adapter);
    clock.setSegments([
      { start: 0, end: 4, chord: parseChord('C') } as ChordSegment,
    ]);

    render(
      <BarGrid
        bars={bars}
        notation="english"
        accidental="sharp"
        clock={clock}
        onSelectBar={vi.fn()}
      />,
    );

    expect(screen.getByTestId('bar-cell-1')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('bar-cell-0')).not.toHaveAttribute('aria-current');
  });

  it('previsualiza el compás al pasar el ratón cuando se arma A o B', () => {
    const { rerender } = render(
      <BarGrid
        bars={bars}
        notation="english"
        accidental="sharp"
        clock={null}
        onSelectBar={vi.fn()}
        markMode="a"
      />,
    );

    fireEvent.mouseEnter(screen.getByTestId('bar-cell-1'));
    expect(screen.getByTestId('bar-cell-1')).toHaveAttribute('data-mark-preview', 'a');
    expect(screen.getByTestId('bar-cell-0')).not.toHaveAttribute('data-mark-preview');

    rerender(
      <BarGrid
        bars={bars}
        notation="english"
        accidental="sharp"
        clock={null}
        onSelectBar={vi.fn()}
        markMode="b"
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId('bar-cell-2'));
    expect(screen.getByTestId('bar-cell-2')).toHaveAttribute('data-mark-preview', 'b');
  });

  it('colorea los compases A, B y el rango intermedio', () => {
    render(
      <BarGrid
        bars={bars}
        notation="english"
        accidental="sharp"
        clock={null}
        onSelectBar={vi.fn()}
        loopA={0}
        loopB={12}
      />,
    );

    expect(screen.getByTestId('bar-cell-0')).toHaveAttribute('data-loop', 'a');
    expect(screen.getByTestId('bar-cell-1')).toHaveAttribute('data-loop', 'range');
    expect(screen.getByTestId('bar-cell-2')).toHaveAttribute('data-loop', 'b');
    expect(screen.getByTestId('bar-cell-3')).not.toHaveAttribute('data-loop');
  });

  it('se integra en ChordGrid como vista Compases', () => {
    const adapter = new FakePlayerAdapter(0, false);
    const clock = new PlaybackClock(adapter);
    const segments: ChordSegment[] = [
      { start: 0, end: 4, chord: parseChord('C') },
      { start: 4, end: 8, chord: parseChord('G') },
    ];
    const onViewChange = vi.fn();
    clock.setSegments(segments);

    render(
      <ChordGrid
        segments={segments}
        notation="english"
        accidental="sharp"
        clock={clock}
        onSeek={vi.fn()}
        beats={[0, 1, 2, 3, 4, 5, 6, 7]}
        beatsPerBar={4}
        duration={8}
        view="bars"
        onViewChange={onViewChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'Compases' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('bar-cell-0')).toHaveTextContent('C');
    expect(screen.getByTestId('bar-cell-1')).toHaveTextContent('G');
  });
});
