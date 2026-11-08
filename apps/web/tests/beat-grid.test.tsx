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
}: {
  beats?: number[];
  view?: GridView;
  onSeek?: ReturnType<typeof vi.fn>;
  duration?: number;
  loopA?: number | null;
  loopB?: number | null;
} = {}) {
  const adapter = new FakePlayerAdapter(0, false);
  const clock = new PlaybackClock(adapter);
  const clockBeats = duration === undefined ? beats : extendBeats(beats, duration);
  clock.setSegments(segments);
  clock.setBeats(clockBeats);
  const onViewChange = vi.fn();
  const view_result = render(
    <ChordGrid
      segments={segments}
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
    />,
  );
  return { adapter, clock, onSeek, onViewChange, view: view_result };
}

describe('ChordGrid en vista de parrilla', () => {
  it('renderiza filas de ocho celdas con dos compases y agrupa la etiqueta del acorde', () => {
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

  it('deja vacías y no focusables las celdas de la última fila incompleta', () => {
    setup({ beats: twentyFourBeats.slice(0, 18) });
    const thirdRow = screen.getByTestId('beat-row-2');
    expect(within(thirdRow).getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByTestId('beat-cell-18')).not.toBeInTheDocument();
    expect(screen.queryByTestId('beat-cell-19')).not.toBeInTheDocument();
  });

  it('completa la parrilla y el seguimiento hasta la duración si los pulsos se cortan', () => {
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

  it('resalta el pulso activo y salta al tiempo de la celda', () => {
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

  it('navega dentro de la fila, entre filas y en los extremos', () => {
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

  it('desplaza la fila activa al cruzar el límite de ocho pulsos', () => {
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

  it('muestra el contador de filas y compases', () => {
    setup({ beats: twentyFourBeats });
    expect(screen.getByText('3 filas · 6 compases')).toBeInTheDocument();
  });

  it('anuncia fila, compás, tiempo y acorde en la región aria-live', () => {
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

  it('alterna entre parrilla y lista sin tocar la reproducción', () => {
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

  it('cae a la lista con aviso cuando no hay pulsos', () => {
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
