import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parseChord, type ChordSegment } from '@chordifree/chords';
import { ChordGrid } from '../src/components/ChordGrid';
import { LyricsChordView } from '../src/components/LyricsChordView';
import { FakePlayerAdapter } from '../src/player/fake';
import { PlaybackClock } from '../src/sync/clock';

const segments: ChordSegment[] = [
  { start: 0, end: 10, chord: parseChord('C') },
  { start: 10, end: 20, chord: parseChord('G') },
];

function setup({
  lyrics = 'Primera línea\nSegunda línea',
  at = 0,
  chords = segments,
  vocalRegions = [],
  chordOffsets,
  chordLines,
  onChordOffsetChange,
  onChordLineChange,
  onResetChordOffsets,
}: {
  lyrics?: string;
  at?: number;
  chords?: ChordSegment[];
  vocalRegions?: Array<{ start: number; end: number }>;
  chordOffsets?: Record<string, number>;
  chordLines?: Record<string, number>;
  onChordOffsetChange?: (segmentIndex: number, offset: number) => void;
  onChordLineChange?: (segmentIndex: number, lineIndex: number | null) => void;
  onResetChordOffsets?: () => void;
} = {}) {
  const adapter = new FakePlayerAdapter(at, false);
  const clock = new PlaybackClock(adapter);
  clock.setSegments(chords);
  const onSeek = vi.fn();
  const onEdit = vi.fn();
  const view = render(
    <LyricsChordView
      lyrics={lyrics}
      segments={chords}
      beats={[]}
      beatsPerBar={4}
      duration={20}
      notation="english"
      accidental="sharp"
      clock={clock}
      vocalRegions={vocalRegions}
      chordOffsets={chordOffsets}
      chordLines={chordLines}
      onChordOffsetChange={onChordOffsetChange}
      onChordLineChange={onChordLineChange}
      onResetChordOffsets={onResetChordOffsets}
      onSeek={onSeek}
      onEdit={onEdit}
    />,
  );
  return { adapter, clock, onSeek, onEdit, view };
}

describe('LyricsChordView', () => {
  it('shows lines and chords aligned with their time', () => {
    setup();

    expect(screen.getByText('Primera línea')).toBeInTheDocument();
    expect(screen.getByText('Segunda línea')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'C en 00:00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'G en 00:10' })).toBeInTheDocument();
  });

  it('highlights the active line and chord', () => {
    setup({ at: 10 });

    const activeLine = screen.getByText('Segunda línea').closest('li');
    expect(activeLine).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'G en 00:10' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: 'C en 00:00' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('does not activate lyrics during the intro when there are vocal regions', () => {
    setup({ at: 4, vocalRegions: [{ start: 10, end: 20 }] });

    expect(screen.getByText('Primera línea').closest('li')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Segunda línea').closest('li')).not.toHaveAttribute('aria-current');
  });

  it('starts the first line when the vocals come in', () => {
    setup({ at: 10, vocalRegions: [{ start: 10, end: 20 }] });

    expect(screen.getByText('Primera línea').closest('li')).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('seeks to the chord or line time when clicked', () => {
    const { onSeek } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'G en 00:10' }));
    expect(onSeek).toHaveBeenCalledWith(10);

    fireEvent.click(screen.getByText('Primera línea'));
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('applies the saved offset of each chord', () => {
    setup({ chordOffsets: { '0': 0.5 } });

    // jsdom 31 resolves em units in the computed style, so assert the
    // inline declaration that the component actually sets.
    expect(screen.getByRole('button', { name: 'C en 00:00' }).style.transform).toBe(
      'translateX(0.5em)',
    );
    expect(screen.getByRole('button', { name: 'G en 00:10' }).style.transform).toBe(
      'translateX(0em)',
    );
  });

  it('enables adjustment and moves the chord with the arrow keys', () => {
    const onChordOffsetChange = vi.fn();
    setup({ onChordOffsetChange });

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar acordes' }));
    const handle = screen.getByRole('button', { name: 'Mover C' });
    handle.focus();
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onChordOffsetChange).toHaveBeenCalledWith(0, 0.25);

    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(onChordOffsetChange).toHaveBeenLastCalledWith(0, -0.25);
  });

  it('moves a chord to the next line and renders it there', () => {
    const onChordLineChange = vi.fn();
    setup({ onChordOffsetChange: vi.fn(), onChordLineChange });

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar acordes' }));
    const handle = screen.getByRole('button', { name: 'Mover C' });
    handle.focus();
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(onChordLineChange).toHaveBeenCalledWith(0, 1);
  });

  it('moves a chord to the previous line', () => {
    const onChordLineChange = vi.fn();
    setup({
      chordLines: { '0': 1 },
      onChordOffsetChange: vi.fn(),
      onChordLineChange,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar acordes' }));
    const handle = screen.getByRole('button', { name: 'Mover C' });
    handle.focus();
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(onChordLineChange).toHaveBeenCalledWith(0, 0);
  });

  it('visually places the chord on the indicated line', () => {
    setup({ chordLines: { '0': 1 } });

    const firstLine = screen.getByText('Primera línea').closest('li');
    const secondLine = screen.getByText('Segunda línea').closest('li');
    expect(firstLine).not.toBeNull();
    expect(secondLine).not.toBeNull();
    expect(within(firstLine!).queryByRole('button', { name: 'C en 00:00' })).not.toBeInTheDocument();
    expect(within(secondLine!).getByRole('button', { name: 'C en 00:00' })).toBeInTheDocument();
  });

  it('resets the line and horizontal position with Home', () => {
    const onChordOffsetChange = vi.fn();
    const onChordLineChange = vi.fn();
    setup({
      chordLines: { '0': 1 },
      onChordOffsetChange,
      onChordLineChange,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar acordes' }));
    const handle = screen.getByRole('button', { name: 'Mover C' });
    handle.focus();
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(onChordLineChange).toHaveBeenCalledWith(0, null);
    expect(onChordOffsetChange).toHaveBeenCalledWith(0, 0);
  });

  it('allows resetting all positions', () => {
    const onResetChordOffsets = vi.fn();
    setup({ onChordOffsetChange: vi.fn(), onResetChordOffsets });

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar acordes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer posiciones' }));
    expect(onResetChordOffsets).toHaveBeenCalledTimes(1);
  });

  it('highlights nothing without a playback clock', () => {
    render(
      <LyricsChordView
        lyrics={'Primera línea\nSegunda línea'}
        segments={segments}
        beats={[]}
        beatsPerBar={4}
        duration={20}
        notation="english"
        accidental="sharp"
        clock={null}
        onSeek={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('Segunda línea').closest('li')).not.toHaveAttribute('aria-current');
  });

  it('shows the empty state and allows adding lyrics', () => {
    const { onEdit } = setup({ lyrics: '' });

    expect(screen.getByText('Todavía no hay letra')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir letra' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('renders literal HTML as text', () => {
    const { view } = setup({ lyrics: '<b>Hola</b>\nSegunda', chords: [] });

    expect(screen.getByText('<b>Hola</b>')).toBeInTheDocument();
    expect(view.container.querySelector('b')).toBeNull();
  });

  it('shows lyrics without chords when there are no segments', () => {
    setup({ lyrics: 'Primera línea\nSegunda línea', chords: [] });

    expect(screen.getByText('Primera línea')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'C en 00:00' })).not.toBeInTheDocument();
    expect(screen.getByText(/la letra se muestra sin capa de acordes/)).toBeInTheDocument();
  });

  it('skips detected intro and interlude and assigns no chords to them', () => {
    const labels = ['C', 'Dm', 'C', 'G', 'Am', 'F', 'C', 'C', 'C', 'C', 'C', 'G', 'Am', 'F'];
    const chords = labels.map((label, index) => ({
      start: index * 4,
      end: (index + 1) * 4,
      chord: parseChord(label),
    }));
    const beats = Array.from({ length: 56 }, (_, index) => index);

    render(
      <LyricsChordView
        lyrics={'Primera línea\nSegunda línea'}
        segments={chords}
        beats={beats}
        beatsPerBar={4}
        duration={56}
        notation="english"
        accidental="sharp"
        clock={null}
        onSeek={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'C en 00:08' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'G en 00:12' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'C en 00:40' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'F en 00:52' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'C en 00:00' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dm en 00:04' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'C en 00:24' })).not.toBeInTheDocument();
  });
});

describe('ChordGrid with the lyrics view', () => {
  it('enables the Lyrics view and keeps Grid disabled without beats', () => {
    const adapter = new FakePlayerAdapter(0, false);
    const clock = new PlaybackClock(adapter);
    clock.setSegments(segments);
    const onViewChange = vi.fn();

    render(
      <ChordGrid
        segments={segments}
        notation="english"
        accidental="sharp"
        clock={clock}
        onSeek={vi.fn()}
        duration={20}
        view="lyrics"
        lyrics={'Primera línea\nSegunda línea'}
        onViewChange={onViewChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'Letra' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Parrilla' })).toBeDisabled();
    expect(screen.getByText('Primera línea')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'C en 00:00' })).toBeInTheDocument();
  });

  it('notifies the view change when clicking Lyrics', () => {
    const adapter = new FakePlayerAdapter(0, false);
    const clock = new PlaybackClock(adapter);
    clock.setSegments(segments);
    const onViewChange = vi.fn();

    render(
      <ChordGrid
        segments={segments}
        notation="english"
        accidental="sharp"
        clock={clock}
        onSeek={vi.fn()}
        duration={20}
        view="list"
        lyrics="Primera línea"
        onViewChange={onViewChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Letra' }));
    expect(onViewChange).toHaveBeenCalledWith('lyrics');
  });
});
