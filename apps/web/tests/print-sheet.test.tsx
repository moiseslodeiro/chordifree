import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PrintSheet } from '../src/components/PrintSheet';
import { createDemoSong } from '../src/demo';
import { DEFAULT_PREFERENCES } from '../src/storage/preferences';
import type { Instrument } from '../src/types';

const song = createDemoSong(DEFAULT_PREFERENCES);

function renderSheet(instrument: Instrument) {
  return render(
    <PrintSheet
      song={song}
      artist="Chordifree"
      instrument={instrument}
      keyLabel="C mayor"
      capo={0}
      bpm={120}
      segments={song.segments}
      lyricsSegments={song.segments}
      beats={song.beats ?? []}
      beatsPerBar={song.beatsPerBar ?? 4}
      duration={song.duration}
      accidental="sharp"
      notation="english"
    />,
  );
}

describe('PrintSheet', () => {
  it('incluye logo, letra con acordes y progresión', () => {
    renderSheet('guitar');

    expect(screen.getAllByAltText('chordifree').length).toBeGreaterThan(0);
    expect(screen.getAllByText(song.title).length).toBeGreaterThan(0);
    expect(screen.getByText('Letra y acordes')).toBeInTheDocument();
    expect(screen.getByText('Progresión de acordes')).toBeInTheDocument();
    expect(screen.getByText(song.lyrics!.split('\n')[0]!)).toBeInTheDocument();
  });

  it('dibuja los diagramas del instrumento seleccionado', () => {
    const guitar = renderSheet('guitar');
    expect(screen.getAllByRole('img', { name: /^Guitarra:/, hidden: true }).length).toBeGreaterThan(0);
    guitar.unmount();

    renderSheet('piano');
    expect(screen.getAllByRole('img', { name: /^Piano:/, hidden: true }).length).toBeGreaterThan(0);
  });

  it('muestra los acordes una sola vez en la columna lateral', () => {
    renderSheet('guitar');

    const figures = screen.getAllByRole('figure', { hidden: true });
    const labels = figures.map((figure) => figure.querySelector('figcaption')?.textContent);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
