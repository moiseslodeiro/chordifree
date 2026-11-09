import { fireEvent, render, screen } from '@testing-library/react';
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
}: {
  lyrics?: string;
  at?: number;
  chords?: ChordSegment[];
  vocalRegions?: Array<{ start: number; end: number }>;
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
      onSeek={onSeek}
      onEdit={onEdit}
    />,
  );
  return { adapter, clock, onSeek, onEdit, view };
}

describe('LyricsChordView', () => {
  it('muestra las líneas y los acordes alineados con su tiempo', () => {
    setup();

    expect(screen.getByText('Primera línea')).toBeInTheDocument();
    expect(screen.getByText('Segunda línea')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'C en 00:00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'G en 00:10' })).toBeInTheDocument();
  });

  it('resalta la línea y el acorde activos', () => {
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

  it('no activa la letra durante la intro cuando hay regiones vocales', () => {
    setup({ at: 4, vocalRegions: [{ start: 10, end: 20 }] });

    expect(screen.getByText('Primera línea').closest('li')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Segunda línea').closest('li')).not.toHaveAttribute('aria-current');
  });

  it('empieza la primera línea al entrar la voz', () => {
    setup({ at: 10, vocalRegions: [{ start: 10, end: 20 }] });

    expect(screen.getByText('Primera línea').closest('li')).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('salta al tiempo del acorde o de la línea al pulsar', () => {
    const { onSeek } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'G en 00:10' }));
    expect(onSeek).toHaveBeenCalledWith(10);

    fireEvent.click(screen.getByText('Primera línea'));
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('no resalta nada sin reloj de reproducción', () => {
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

  it('muestra el estado vacío y permite añadir letra', () => {
    const { onEdit } = setup({ lyrics: '' });

    expect(screen.getByText('Todavía no hay letra')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir letra' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('renderiza HTML literal como texto', () => {
    const { view } = setup({ lyrics: '<b>Hola</b>\nSegunda', chords: [] });

    expect(screen.getByText('<b>Hola</b>')).toBeInTheDocument();
    expect(view.container.querySelector('b')).toBeNull();
  });

  it('muestra la letra sin acordes cuando no hay segmentos', () => {
    setup({ lyrics: 'Primera línea\nSegunda línea', chords: [] });

    expect(screen.getByText('Primera línea')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'C en 00:00' })).not.toBeInTheDocument();
    expect(screen.getByText(/la letra se muestra sin capa de acordes/)).toBeInTheDocument();
  });

  it('omite intro e interludio detectados y no les asigna acordes', () => {
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

describe('ChordGrid con vista Letra', () => {
  it('activa la vista Letra y mantiene Parrilla deshabilitada sin pulsos', () => {
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

  it('notifica el cambio de vista al pulsar Letra', () => {
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
