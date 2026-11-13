import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { parseChord, type ChordSegment } from '@chordifree/chords';
import { ChordGrid } from '../src/components/ChordGrid';
import { extendBeats } from '../src/grid/beats';
import { FakePlayerAdapter } from '../src/player/fake';
import { PlaybackClock } from '../src/sync/clock';
import type { GridView } from '../src/types';

const segments: ChordSegment[] = [
  { start: 0, end: 4, chord: parseChord('C') },
  { start: 4, end: 8, chord: parseChord('G') },
];

const eightBeats = [0, 1, 2, 3, 4, 5, 6, 7];
const twentyFourBeats = Array.from({ length: 24 }, (_, index) => index);

function setup({
  beats = eightBeats,
  view = 'beats' as GridView,
  onSeek = vi.fn(),
  duration,
  loopA = null,
  loopB = null,
  markMode = null,
  chords = segments,
}: {
  beats?: number[];
  view?: GridView;
  onSeek?: ReturnType<typeof vi.fn>;
  duration?: number;
  loopA?: number | null;
  loopB?: number | null;
  markMode?: 'a' | 'b' | null;
  chords?: ChordSegment[];
} = {}) {
  const adapter = new FakePlayerAdapter(0, false);
  const clock = new PlaybackClock(adapter);
  const clockBeats = duration === undefined ? beats : extendBeats(beats, duration);
  clock.setSegments(chords);
  clock.setBeats(clockBeats);
  const onViewChange = vi.fn();
  const view_result = render(
    <ChordGrid
      segments={chords}
      notation="english"
      accidental="sharp"
      clock={clock}
      onSeek={onSeek}
      beats={clockBeats}
      beatsPerBar={4}
      duration={duration}
      view={view}
      onViewChange={onViewChange}
      loopA={loopA}
      loopB={loopB}
      markMode={markMode}
    />,
  );
  return { adapter, clock, onSeek, onViewChange, view: view_result };
}

describe('ChordGrid in grid view', () => {
  it('renders rows of eight cells with two bars and groups the chord label', () => {
    setup({ beats: twentyFourBeats });
    const firstRow = screen.getByTestId('beat-row-0');
    const secondRow = screen.getByTestId('beat-row-1');
    expect(within(firstRow).getAllByRole('button')).toHaveLength(8);
    expect(within(secondRow).getAllByRole('button')).toHaveLength(8);
    expect(within(firstRow).getByText('00:00')).toBeInTheDocument();
    expect(within(firstRow).getByText('C1')).toBeInTheDocument();
    expect(within(secondRow).getByText('00:08')).toBeInTheDocument();
    expect(within(secondRow).getByText('C3')).toBeInTheDocument();
    expect(screen.getAllByText('C')).toHaveLength(1);
    expect(screen.getAllByText('G')).toHaveLength(1);
  });

  it('colors bars A and B and dims the in-between ones', () => {
    setup({ beats: twentyFourBeats, loopA: 0, loopB: 16 });

    for (const index of [0, 1, 2, 3]) {
      expect(screen.getByTestId(`beat-cell-${index}`)).toHaveAttribute('data-loop', 'a');
    }
    for (const index of [4, 5, 6, 7]) {
      expect(screen.getByTestId(`beat-cell-${index}`)).toHaveAttribute('data-loop', 'range');
    }
    for (const index of [8, 9, 10, 11]) {
      expect(screen.getByTestId(`beat-cell-${index}`)).toHaveAttribute('data-loop', 'range');
    }
    for (const index of [12, 13, 14, 15]) {
      expect(screen.getByTestId(`beat-cell-${index}`)).toHaveAttribute('data-loop', 'b');
    }
    expect(screen.getByTestId('beat-cell-16')).not.toHaveAttribute('data-loop');
  });

  it('marks the bar containing the whole loop with A·B', () => {
    setup({ beats: twentyFourBeats, loopA: 0, loopB: 4 });

    for (const index of [0, 1, 2, 3]) {
      expect(screen.getByTestId(`beat-cell-${index}`)).toHaveAttribute('data-loop', 'ab');
    }
    expect(screen.getByTestId('beat-cell-4')).not.toHaveAttribute('data-loop');
  });

  it('previews the whole bar under the mouse when arming A or B', () => {
    setup({ beats: twentyFourBeats, markMode: 'a' });

    fireEvent.mouseEnter(screen.getByTestId('beat-cell-5'));
    for (const index of [4, 5, 6, 7]) {
      expect(screen.getByTestId(`beat-cell-${index}`)).toHaveAttribute(
        'data-mark-preview',
        'a',
      );
    }
    expect(screen.getByTestId('beat-cell-3')).not.toHaveAttribute('data-mark-preview');
    expect(screen.getByTestId('beat-cell-8')).not.toHaveAttribute('data-mark-preview');

    fireEvent.mouseLeave(screen.getByTestId('beat-grid'));
    expect(screen.getByTestId('beat-cell-5')).not.toHaveAttribute('data-mark-preview');
  });

  it('previews in color B and does not preview without mark mode', () => {
    const first = setup({ beats: twentyFourBeats, markMode: 'b' });
    fireEvent.mouseEnter(screen.getByTestId('beat-cell-9'));
    expect(screen.getByTestId('beat-cell-8')).toHaveAttribute('data-mark-preview', 'b');
    first.view.unmount();

    setup({ beats: twentyFourBeats });
    fireEvent.mouseEnter(screen.getByTestId('beat-cell-9'));
    expect(screen.getByTestId('beat-cell-8')).not.toHaveAttribute('data-mark-preview');
  });

  it('flags chords with low confidence', () => {
    const chords: ChordSegment[] = [
      { start: 0, end: 4, chord: parseChord('C'), confidence: 0.35 },
      { start: 4, end: 8, chord: parseChord('G'), confidence: 0.9 },
    ];
    setup({ beats: eightBeats, chords });

    expect(screen.getByTestId('beat-cell-0')).toHaveAttribute('data-confidence', '35');
    expect(screen.getByTestId('beat-cell-0').getAttribute('aria-label')).toContain(
      'confianza baja',
    );
    expect(screen.getByTestId('beat-cell-4')).toHaveAttribute('data-confidence', '90');
    expect(screen.getAllByText('?')).toHaveLength(1);
  });

  it('shows a doubtful badge in list view', () => {
    const chords: ChordSegment[] = [
      { start: 0, end: 4, chord: parseChord('C'), confidence: 0.35 },
      { start: 4, end: 8, chord: parseChord('G'), confidence: 0.9 },
    ];
    setup({ beats: eightBeats, chords, view: 'list' });

    expect(screen.getByText('dudoso')).toBeInTheDocument();
  });

  it('leaves the cells of the last incomplete row empty and non-focusable', () => {
    setup({ beats: twentyFourBeats.slice(0, 18) });
    const thirdRow = screen.getByTestId('beat-row-2');
    expect(within(thirdRow).getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByTestId('beat-cell-18')).not.toBeInTheDocument();
    expect(screen.queryByTestId('beat-cell-19')).not.toBeInTheDocument();
  });

  it('fills the grid and the tracking up to the duration if the beats are cut short', () => {
    const { adapter, clock } = setup({ beats: [0, 1, 2, 3], duration: 8 });
    expect(screen.getByTestId('beat-cell-7')).toBeInTheDocument();
    expect(screen.queryByTestId('beat-cell-8')).not.toBeInTheDocument();

    act(() => {
      adapter.seekTo(6);
      clock.tickOnce();
    });
    expect(screen.getByTestId('beat-cell-6')).toHaveAttribute('data-active', 'true');
    clock.destroy();
  });

  it('highlights the active beat and seeks to the cell time', () => {
    const { adapter, clock, onSeek } = setup();
    expect(screen.getByTestId('beat-cell-0')).toHaveAttribute('data-active', 'true');

    act(() => {
      adapter.seekTo(1);
      clock.tickOnce();
    });
    expect(screen.getByTestId('beat-cell-0')).toHaveAttribute('data-active', 'false');
    expect(screen.getByTestId('beat-cell-1')).toHaveAttribute('data-active', 'true');

    fireEvent.click(screen.getByTestId('beat-cell-2'));
    expect(onSeek).toHaveBeenCalledWith(2);
    clock.destroy();
  });

  it('navigates within a row, between rows, and at the edges', () => {
    const { clock } = setup({ beats: twentyFourBeats });
    const first = screen.getByTestId('beat-cell-0');
    first.focus();

    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByTestId('beat-cell-1')).toHaveFocus();

    fireEvent.keyDown(screen.getByTestId('beat-cell-1'), { key: 'ArrowDown' });
    expect(screen.getByTestId('beat-cell-9')).toHaveFocus();

    fireEvent.keyDown(screen.getByTestId('beat-cell-9'), { key: 'ArrowUp' });
    expect(screen.getByTestId('beat-cell-1')).toHaveFocus();

    const lastInRow = screen.getByTestId('beat-cell-7');
    lastInRow.focus();
    fireEvent.keyDown(lastInRow, { key: 'ArrowRight' });
    expect(lastInRow).toHaveFocus();

    fireEvent.keyDown(screen.getByTestId('beat-cell-1'), { key: 'Home' });
    expect(first).toHaveFocus();

    fireEvent.keyDown(first, { key: 'End' });
    expect(screen.getByTestId('beat-cell-23')).toHaveFocus();
    clock.destroy();
  });

  it('scrolls the active row when crossing the eight-beat boundary', () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      const { adapter, clock } = setup({ beats: twentyFourBeats });
      scrollIntoView.mockClear();

      act(() => {
        adapter.seekTo(8);
        clock.tickOnce();
      });

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
      const target = scrollIntoView.mock.instances.at(-1) as HTMLElement | undefined;
      expect(target?.getAttribute('data-testid')).toBe('beat-row-1');
      clock.destroy();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('shows the row and bar counter', () => {
    setup({ beats: twentyFourBeats });
    expect(screen.getByText('3 filas · 6 compases')).toBeInTheDocument();
  });

  it('announces row, bar, beat, and chord in the aria-live region', () => {
    const { adapter, clock } = setup({ beats: twentyFourBeats });
    expect(
      screen.getByText('Fila 1, compás 1, tiempo 1, acorde C'),
    ).toBeInTheDocument();

    act(() => {
      adapter.seekTo(4);
      clock.tickOnce();
    });
    expect(
      screen.getByText('Fila 1, compás 2, tiempo 1, acorde G'),
    ).toBeInTheDocument();

    act(() => {
      adapter.seekTo(12);
      clock.tickOnce();
    });
    expect(
      screen.getByText('Fila 2, compás 4, tiempo 1, acorde —'),
    ).toBeInTheDocument();
    clock.destroy();
  });

  it('switches between grid and list without touching playback', () => {
    const adapter = new FakePlayerAdapter(0, false);
    const clock = new PlaybackClock(adapter);
    clock.setSegments(segments);
    clock.setBeats(eightBeats);

    function Harness() {
      const [view, setView] = useState<GridView>('list');
      return (
        <ChordGrid
          segments={segments}
          notation="english"
          accidental="sharp"
          clock={clock}
          onSeek={() => undefined}
          beats={eightBeats}
          beatsPerBar={4}
          view={view}
          onViewChange={setView}
        />
      );
    }

    render(<Harness />);
    expect(screen.getByTestId('chord-row-0')).toBeInTheDocument();
    const timeBefore = adapter.getCurrentTime();

    fireEvent.click(screen.getByRole('button', { name: 'Parrilla' }));
    expect(screen.getByTestId('beat-row-0')).toBeInTheDocument();
    expect(screen.queryByTestId('chord-row-0')).not.toBeInTheDocument();
    expect(adapter.getCurrentTime()).toBe(timeBefore);

    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    expect(screen.getByTestId('chord-row-0')).toBeInTheDocument();
    expect(adapter.getCurrentTime()).toBe(timeBefore);
    clock.destroy();
  });

  it('falls back to the list with a notice when there are no beats', () => {
    setup({ beats: [], view: 'beats' });
    expect(
      screen.getByText('No se detectaron pulsos en esta canción; se muestra la vista de lista.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('chord-row-0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Parrilla' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
