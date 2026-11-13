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
  it('shows the progression and the degree of each chord', () => {
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

  it('summarizes confidence and warns about doubtful chords', () => {
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

  it('omits confidence when the analyzer does not provide it', () => {
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

  it('explains that there are no degrees when the key could not be estimated', () => {
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

  it('indicates that the grid uses capo shapes', () => {
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
