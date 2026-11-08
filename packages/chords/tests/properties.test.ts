import { describe, expect, it } from 'vitest';
import { formatChord } from '../src/format';
import { parseChord } from '../src/parse';
import { transposeChord } from '../src/transpose';
import type { PitchClass, Quality } from '../src/types';

const QUALITIES: Quality[] = [
  'major',
  'minor',
  'dim',
  'aug',
  'sus2',
  'sus4',
  'power',
  '6',
  'm6',
  '7',
  'maj7',
  'm7',
  'dim7',
  'm7b5',
  '7sus4',
  'add9',
  '9',
  'maj9',
  'm9',
  '11',
  'm11',
  '13',
  'm13',
  '6/9',
];

describe('propiedades de trasposición', () => {
  it('ida y vuelta devuelve el acorde original', () => {
    for (let root = 0; root < 12; root += 1) {
      for (const quality of QUALITIES) {
        const original = { root: root as PitchClass, quality };
        for (let shift = -11; shift <= 11; shift += 1) {
          const result = transposeChord(transposeChord(original, shift), -shift);
          expect(result.root).toBe(original.root);
          expect(result.quality).toBe(original.quality);
        }
      }
    }
  });

  it('conserva la ortografía al reformatear en notación inglesa y española', () => {
    for (let root = 0; root < 12; root += 1) {
      for (const quality of QUALITIES) {
        const chord = { root: root as PitchClass, quality };
        for (const notation of ['english', 'spanish'] as const) {
          const label = formatChord(chord, notation, 'sharp');
          const reparsed = parseChord(label);
          expect(reparsed?.root).toBe(chord.root);
          expect(reparsed?.quality).toBe(chord.quality);
        }
      }
    }
  });
});
