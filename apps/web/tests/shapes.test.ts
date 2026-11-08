import { describe, expect, it } from 'vitest';
import type { Chord } from '@chordifree/chords';
import { getPianoVoicing, getStringShape } from '../src/chords/shapes';

function chord(quality: Chord['quality'], root: Chord['root'] = 0): Chord {
  return { root, quality };
}

describe('getStringShape', () => {
  it('calcula la forma mayor de guitarra desde la fundamental en la sexta cuerda', () => {
    const shape = getStringShape(chord('major', 0), 'guitar');
    expect(shape).not.toBeNull();
    expect(shape?.frets).toEqual([8, 10, 10, 9, 8, 8]);
    expect(shape?.rootFret).toBe(8);
  });

  it('calcula la forma menor y el power chord según la fundamental', () => {
    expect(getStringShape(chord('minor', 9), 'guitar')?.frets).toEqual([5, 7, 7, 5, 5, 5]);
    expect(getStringShape(chord('power', 7), 'guitar')?.frets).toEqual([3, 5, 5, -1, -1, -1]);
  });

  it('resuelve disminuidos y aumentados sin cuerdas fuera del mástil', () => {
    const dim = getStringShape(chord('dim', 4), 'guitar');
    expect(dim?.frets).toEqual([0, 1, 2, 0, -1, 0]);
    const aug = getStringShape(chord('aug', 4), 'guitar');
    expect(aug?.frets).toEqual([0, 3, 2, 1, 1, 0]);
  });

  it('calcula las formas móviles de ukelele desde la cuerda de Do', () => {
    expect(getStringShape(chord('major', 0), 'ukelele')?.frets).toEqual([0, 0, 0, 3]);
    expect(getStringShape(chord('minor', 0), 'ukelele')?.frets).toEqual([0, 3, 3, 3]);
    expect(getStringShape(chord('major', 7), 'ukelele')?.frets).toEqual([7, 7, 7, 10]);
  });

  it('resuelve la séptima de dominante en guitarra, ukelele y piano', () => {
    expect(getStringShape(chord('7', 0), 'guitar')?.frets).toEqual([8, 10, 8, 9, 8, 8]);
    expect(getStringShape(chord('7', 0), 'ukelele')?.frets).toEqual([0, 0, 0, 1]);
    expect(getPianoVoicing(chord('7', 0))).toEqual({
      pitchClasses: [0, 4, 7, 10],
      notes: [60, 64, 67, 70],
    });
  });

  it('devuelve null cuando el acorde no tiene forma simplificada', () => {
    expect(getStringShape(chord('maj7'), 'guitar')).toBeNull();
    expect(getStringShape(chord('m7b5'), 'ukelele')).toBeNull();
  });
});

describe('getPianoVoicing', () => {
  it('genera las notas de un acorde mayor y menor', () => {
    expect(getPianoVoicing(chord('major', 0))).toEqual({
      pitchClasses: [0, 4, 7],
      notes: [60, 64, 67],
    });
    expect(getPianoVoicing(chord('minor', 9))).toEqual({
      pitchClasses: [9, 0, 4],
      notes: [69, 72, 76],
    });
  });

  it('genera las notas de un disminuido y un aumentado', () => {
    expect(getPianoVoicing(chord('dim', 11))).toEqual({
      pitchClasses: [11, 2, 5],
      notes: [71, 74, 77],
    });
    expect(getPianoVoicing(chord('aug', 0))).toEqual({
      pitchClasses: [0, 4, 8],
      notes: [60, 64, 68],
    });
  });

  it('devuelve null para acordes sin voicing simplificado', () => {
    expect(getPianoVoicing(chord('maj9'))).toBeNull();
  });
});
