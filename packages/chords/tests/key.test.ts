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
  it('detects F major and picks flats', () => {
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

  it('detects A minor', () => {
    const key = estimateKey([
      segment('Am', 0, 4),
      segment('Dm', 4, 8),
      segment('E7', 8, 12),
      segment('Am', 12, 16),
    ]);
    expect(key).toMatchObject({ tonic: 9, mode: 'minor' });
  });

  it('returns null without harmonic material', () => {
    expect(estimateKey([])).toBeNull();
    expect(estimateKey([segment('N', 0, 4)])).toBeNull();
  });
});

describe('resolveAccidental', () => {
  it('respects the forced preference', () => {
    const key = estimateKey([segment('F', 0, 8), segment('Bb', 8, 16)]);
    expect(resolveAccidental(key, 'auto')).toBe('flat');
    expect(resolveAccidental(key, 'sharp')).toBe('sharp');
    expect(resolveAccidental(key, 'flat')).toBe('flat');
  });
});

describe('relativeMajor', () => {
  it('computes the relative major', () => {
    expect(relativeMajor(9)).toBe(0);
  });
});

describe('relativeKey', () => {
  it('switches between major and minor keeping the key signature', () => {
    expect(relativeKey({ tonic: 0, mode: 'major' })).toEqual({ tonic: 9, mode: 'minor' });
    expect(relativeKey({ tonic: 9, mode: 'minor' })).toEqual({ tonic: 0, mode: 'major' });
    expect(relativeKey({ tonic: 5, mode: 'major' })).toEqual({ tonic: 2, mode: 'minor' });
  });
});

describe('transposeKey', () => {
  it('transposes the tonic and keeps the mode', () => {
    expect(transposeKey({ tonic: 2, mode: 'major' }, -2)).toEqual({ tonic: 0, mode: 'major' });
    expect(transposeKey({ tonic: 9, mode: 'minor' }, 3)).toEqual({ tonic: 0, mode: 'minor' });
    expect(transposeKey({ tonic: 0, mode: 'major' }, 14)).toEqual({ tonic: 2, mode: 'major' });
  });
});
