import { describe, expect, it } from 'vitest';
import type { Chord } from '@chordifree/chords';
import { getPianoVoicing, getStringShape } from '../src/chords/shapes';

function chord(quality: Chord['quality'], root: Chord['root'] = 0): Chord {
  return { root, quality };
}

describe('getStringShape', () => {
  it('computes the major guitar shape from the root on the sixth string', () => {
    const shape = getStringShape(chord('major', 0), 'guitar');
    expect(shape).not.toBeNull();
    expect(shape?.frets).toEqual([8, 10, 10, 9, 8, 8]);
    expect(shape?.rootFret).toBe(8);
  });

  it('computes the minor shape and power chord from the root', () => {
    expect(getStringShape(chord('minor', 9), 'guitar')?.frets).toEqual([5, 7, 7, 5, 5, 5]);
    expect(getStringShape(chord('power', 7), 'guitar')?.frets).toEqual([3, 5, 5, -1, -1, -1]);
  });

  it('resolves diminished and augmented chords without strings off the fretboard', () => {
    const dim = getStringShape(chord('dim', 4), 'guitar');
    expect(dim?.frets).toEqual([0, 1, 2, 0, -1, 0]);
    const aug = getStringShape(chord('aug', 4), 'guitar');
    expect(aug?.frets).toEqual([0, 3, 2, 1, 1, 0]);
  });

  it('computes movable ukulele shapes from the C string', () => {
    expect(getStringShape(chord('major', 0), 'ukelele')?.frets).toEqual([0, 0, 0, 3]);
    expect(getStringShape(chord('minor', 0), 'ukelele')?.frets).toEqual([0, 3, 3, 3]);
    expect(getStringShape(chord('major', 7), 'ukelele')?.frets).toEqual([7, 7, 7, 10]);
  });

  it('resolves the dominant seventh on guitar, ukulele and piano', () => {
    expect(getStringShape(chord('7', 0), 'guitar')?.frets).toEqual([8, 10, 8, 9, 8, 8]);
    expect(getStringShape(chord('7', 0), 'ukelele')?.frets).toEqual([0, 0, 0, 1]);
    expect(getPianoVoicing(chord('7', 0))).toEqual({
      pitchClasses: [0, 4, 7, 10],
      notes: [60, 64, 67, 70],
    });
  });

  it('returns null when the chord has no simplified shape', () => {
    expect(getStringShape(chord('maj7'), 'guitar')).toBeNull();
    expect(getStringShape(chord('m7b5'), 'ukelele')).toBeNull();
  });
});

describe('getPianoVoicing', () => {
  it('generates the notes of a major and a minor chord', () => {
    expect(getPianoVoicing(chord('major', 0))).toEqual({
      pitchClasses: [0, 4, 7],
      notes: [60, 64, 67],
    });
    expect(getPianoVoicing(chord('minor', 9))).toEqual({
      pitchClasses: [9, 0, 4],
      notes: [69, 72, 76],
    });
  });

  it('generates the notes of a diminished and an augmented chord', () => {
    expect(getPianoVoicing(chord('dim', 11))).toEqual({
      pitchClasses: [11, 2, 5],
      notes: [71, 74, 77],
    });
    expect(getPianoVoicing(chord('aug', 0))).toEqual({
      pitchClasses: [0, 4, 8],
      notes: [60, 64, 68],
    });
  });

  it('returns null for chords without a simplified voicing', () => {
    expect(getPianoVoicing(chord('maj9'))).toBeNull();
  });
});
