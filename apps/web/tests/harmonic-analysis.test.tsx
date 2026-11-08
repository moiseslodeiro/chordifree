import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseChord, type ChordSegment } from '@chordifree/chords';
import { HarmonicAnalysis } from '../src/components/HarmonicAnalysis';

const harmonyKey = { tonic: 0, mode: 'major' } as const;

const segments: ChordSegment[] = [
  { start: 0, end: 4, chord: parseChord('C'), confidence: 0.9 },
  { start: 4, end: 8, chord: parseChord('G'), confidence: 0.3 },
  { start: 8, end: 12, chord: parseChord('Am') },
  { start: 12, end: 16, chord: parseChord('F') },
];

describe('HarmonicAnalysis', () => {
  it('muestra la progresión y el grado de cada acorde', () => {
    render(
      <HarmonicAnalysis
        segments={segments}
        harmonyKey={harmonyKey}
        notation="english"
        accidental="sharp"
      />,
    );

    const progression = screen.getByRole('list', { name: 'Progresión por grados' });
    expect(
      within(progression)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['I', 'V', 'vi', 'IV']);

    const degrees = screen.getByRole('list', { name: 'Grado de cada acorde' });
    expect(within(degrees).getByText('vi')).toBeInTheDocument();
    expect(within(degrees).getByText('Am')).toBeInTheDocument();
    expect(within(degrees).getByText('IV')).toBeInTheDocument();
    expect(within(degrees).getByText('F')).toBeInTheDocument();
  });

  it('resume la confianza y avisa de los acordes dudosos', () => {
    render(
      <HarmonicAnalysis
        segments={segments}
        harmonyKey={harmonyKey}
        notation="english"
        accidental="sharp"
      />,
    );

    expect(
      screen.getByText('Confianza media 60% · 1 de 2 acordes dudosos'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Los acordes marcados con «\?»/)).toBeInTheDocument();
  });

  it('omite la confianza cuando el analizador no la proporciona', () => {
    render(
      <HarmonicAnalysis
        segments={segments.map(({ confidence: _confidence, ...segment }) => segment)}
        harmonyKey={harmonyKey}
        notation="english"
        accidental="sharp"
      />,
    );
    expect(screen.queryByText(/Confianza media/)).not.toBeInTheDocument();
  });

  it('explica que no hay grados si no se pudo estimar la tonalidad', () => {
    render(
      <HarmonicAnalysis
        segments={segments}
        harmonyKey={null}
        notation="english"
        accidental="sharp"
      />,
    );
    expect(
      screen.getByText('No se pudo estimar la tonalidad, así que no hay grados que mostrar.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Progresión por grados' })).not.toBeInTheDocument();
  });

  it('indica que la parrilla usa formas con capo', () => {
    render(
      <HarmonicAnalysis
        segments={segments}
        harmonyKey={harmonyKey}
        notation="english"
        accidental="sharp"
        capo={2}
      />,
    );
    expect(screen.getByText(/formas con capo en el traste/)).toBeInTheDocument();
  });
});
