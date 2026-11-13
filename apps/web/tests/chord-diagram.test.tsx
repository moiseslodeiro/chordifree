import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseChord } from '@chordifree/chords';
import { ChordDiagram } from '../src/components/ChordDiagram';

describe('ChordDiagram', () => {
  it('describes the guitar fretboard and its positions', () => {
    render(
      <ChordDiagram
        chord={parseChord('C')}
        instrument="guitar"
        notation="english"
        accidental="sharp"
      />,
    );
    const diagram = screen.getByRole('img', { name: /Guitarra: C\./ });
    expect(diagram).toBeInTheDocument();
    expect(diagram).toHaveAccessibleName(/cuerda 6 traste 8/);
  });

  it('describes the piano keyboard with the notes of the chord', () => {
    render(
      <ChordDiagram
        chord={parseChord('C')}
        instrument="piano"
        notation="english"
        accidental="sharp"
      />,
    );
    expect(
      screen.getByRole('img', { name: /Piano: C\. Notas: C, E, G/ }),
    ).toBeInTheDocument();
  });

  it('describes the ukulele fretboard', () => {
    render(
      <ChordDiagram
        chord={parseChord('C')}
        instrument="ukelele"
        notation="english"
        accidental="sharp"
      />,
    );
    expect(
      screen.getByRole('img', { name: /Ukelele: C\./ }),
    ).toHaveAccessibleName(/cuerda 1 traste 3/);
  });

  it('uses Spanish notation in the accessible label', () => {
    render(
      <ChordDiagram
        chord={parseChord('C')}
        instrument="piano"
        notation="spanish"
        accidental="sharp"
      />,
    );
    expect(
      screen.getByRole('img', { name: /Piano: Do\. Notas: Do, Mi, Sol/ }),
    ).toBeInTheDocument();
  });

  it('warns when no fingering is available', () => {
    render(
      <ChordDiagram
        chord={parseChord('Cmaj7')}
        instrument="guitar"
        notation="english"
        accidental="sharp"
      />,
    );
    expect(screen.getByRole('img', { name: /Sin digitación disponible/ })).toBeInTheDocument();
    expect(screen.getByText('Sin digitación disponible')).toBeInTheDocument();
    expect(screen.getByText('Cmaj7')).toBeInTheDocument();
  });

  it('shows an empty state with no active chord', () => {
    render(
      <ChordDiagram
        chord={null}
        instrument="guitar"
        notation="english"
        accidental="sharp"
      />,
    );
    expect(screen.getByRole('img', { name: 'Sin acorde activo' })).toBeInTheDocument();
  });
});
