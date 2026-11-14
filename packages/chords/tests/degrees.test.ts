import { describe, expect, it } from 'vitest';
import { chordDegree, progressionDegrees } from '../src/degrees';
import { parseChord } from '../src/parse';
import type { ChordSegment, EstimatedKey } from '../src/types';

const C_MAJOR: EstimatedKey = { tonic: 0, mode: 'major' };
const A_MINOR: EstimatedKey = { tonic: 9, mode: 'minor' };

const degree = (label: string, key: EstimatedKey = C_MAJOR) =>
  chordDegree(parseChord(label)!, key);

describe('chordDegree', () => {
  it('numbers the diatonic chords of C major', () => {
    expect(degree('C')).toBe('I');
    expect(degree('Dm')).toBe('ii');
    expect(degree('Em')).toBe('iii');
    expect(degree('F')).toBe('IV');
    expect(degree('G')).toBe('V');
    expect(degree('Am')).toBe('vi');
    expect(degree('Bdim')).toBe('vii°');
  });

  it('adds extensions and sevenths to the degree', () => {
    expect(degree('G7')).toBe('V7');
    expect(degree('Cmaj7')).toBe('Imaj7');
    expect(degree('Dm7')).toBe('ii7');
    expect(degree('Bm7b5')).toBe('viiø7');
    expect(degree('Cadd9')).toBe('Iadd9');
  });

  it('marks chromatic alterations', () => {
    expect(degree('Eb')).toBe('♭III');
    expect(degree('F#')).toBe('♯IV');
    expect(degree('Ab')).toBe('♭VI');
    expect(degree('Bb')).toBe('♭VII');
    expect(degree('C#')).toBe('♭II');
  });

  it('numbers in natural and harmonic minor', () => {
    expect(degree('Am', A_MINOR)).toBe('i');
    expect(degree('C', A_MINOR)).toBe('III');
    expect(degree('Dm', A_MINOR)).toBe('iv');
    expect(degree('E', A_MINOR)).toBe('V');
    expect(degree('E7', A_MINOR)).toBe('V7');
    expect(degree('F', A_MINOR)).toBe('VI');
    expect(degree('G#dim', A_MINOR)).toBe('♯vii°');
  });

  it('includes the inverted bass', () => {
    expect(degree('C/E')).toBe('I/III');
    expect(degree('G/B')).toBe('V/VII');
  });
});

describe('progressionDegrees', () => {
  const segment = (label: string | null, start: number, end: number): ChordSegment => ({
    start,
    end,
    chord: label ? parseChord(label) : null,
  });

  it('collapses consecutive repeats and skips silences', () => {
    const segments = [
      segment('C', 0, 4),
      segment('C', 4, 6),
      segment(null, 6, 8),
      segment('G', 8, 12),
      segment('Am', 12, 16),
      segment('F', 16, 20),
      segment('C', 20, 24),
    ];
    expect(progressionDegrees(segments, C_MAJOR)).toEqual(['I', 'V', 'vi', 'IV', 'I']);
  });

  it('respects the degree limit', () => {
    const segments = ['C', 'G', 'Am', 'F', 'C', 'G'].map((label, index) =>
      segment(label, index * 4, index * 4 + 4),
    );
    expect(progressionDegrees(segments, C_MAJOR, 3)).toEqual(['I', 'V', 'vi']);
  });
});
