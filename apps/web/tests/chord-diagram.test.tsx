import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseChord } from '@chordifree/chords';
import { ChordDiagram } from '../src/components/ChordDiagram';

describe('ChordDiagram', () => {
  it('describe el mástil de guitarra y sus posiciones', () => {
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

  it('describe el teclado de piano con las notas del acorde', () => {
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

  it('describe el mástil de ukelele', () => {
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

  it('usa la notación española en la etiqueta accesible', () => {
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

  it('avisa cuando no hay digitación disponible', () => {
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

  it('muestra un estado vacío sin acorde activo', () => {
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
