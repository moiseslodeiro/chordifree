import { describe, expect, it } from 'vitest';
import {
  accidentalForKey,
  estimateKey,
  relativeKey,
  relativeMajor,
  resolveAccidental,
  transposeKey,
} from '../src/key';
import { formatChord } from '../src/format';
import { parseChord } from '../src/parse';
import type { ChordSegment } from '../src/types';

const segment = (label: string, start: number, end: number): ChordSegment => ({
  start,
  end,
  chord: parseChord(label),
});

describe('estimateKey', () => {
  it('detecta Fa mayor y elige bemoles', () => {
    const key = estimateKey([
      segment('F', 0, 4),
      segment('Bb', 4, 8),
      segment('C', 8, 12),
      segment('F', 12, 16),
    ]);
    expect(key).toMatchObject({ tonic: 5, mode: 'major' });
    expect(accidentalForKey(key)).toBe('flat');
    expect(formatChord({ root: 10, quality: 'major' }, 'english', 'flat')).toBe('B♭');
  });

  it('detecta La menor', () => {
    const key = estimateKey([
      segment('Am', 0, 4),
      segment('Dm', 4, 8),
      segment('E7', 8, 12),
      segment('Am', 12, 16),
    ]);
    expect(key).toMatchObject({ tonic: 9, mode: 'minor' });
  });

  it('devuelve null sin material armónico', () => {
    expect(estimateKey([])).toBeNull();
    expect(estimateKey([segment('N', 0, 4)])).toBeNull();
  });
});

describe('resolveAccidental', () => {
  it('respeta la preferencia forzada', () => {
    const key = estimateKey([segment('F', 0, 8), segment('Bb', 8, 16)]);
    expect(resolveAccidental(key, 'auto')).toBe('flat');
    expect(resolveAccidental(key, 'sharp')).toBe('sharp');
    expect(resolveAccidental(key, 'flat')).toBe('flat');
  });
});

describe('relativeMajor', () => {
  it('calcula la relativa mayor', () => {
    expect(relativeMajor(9)).toBe(0);
  });
});

describe('relativeKey', () => {
  it('cambia entre mayor y menor conservando la armadura', () => {
    expect(relativeKey({ tonic: 0, mode: 'major' })).toEqual({ tonic: 9, mode: 'minor' });
    expect(relativeKey({ tonic: 9, mode: 'minor' })).toEqual({ tonic: 0, mode: 'major' });
    expect(relativeKey({ tonic: 5, mode: 'major' })).toEqual({ tonic: 2, mode: 'minor' });
  });
});

describe('transposeKey', () => {
  it('transporta la tónica y conserva el modo', () => {
    expect(transposeKey({ tonic: 2, mode: 'major' }, -2)).toEqual({ tonic: 0, mode: 'major' });
    expect(transposeKey({ tonic: 9, mode: 'minor' }, 3)).toEqual({ tonic: 0, mode: 'minor' });
    expect(transposeKey({ tonic: 0, mode: 'major' }, 14)).toEqual({ tonic: 2, mode: 'major' });
  });
});
