import { describe, expect, it } from 'vitest';
import {
  chordEquals,
  findActiveSegmentIndex,
  normalizeSegments,
  totalDuration,
} from '../src/segments';
import { parseChord } from '../src/parse';
import type { ChordSegment } from '../src/types';

const c = parseChord('C');
const g = parseChord('G');
const am = parseChord('Am');

const seg = (start: number, end: number, chord: ChordSegment['chord']): ChordSegment => ({
  start,
  end,
  chord,
});

describe('normalizeSegments', () => {
  it('sorts, trims and covers the full duration', () => {
    const result = normalizeSegments([seg(4, 8, g), seg(0, 4, c)], 8);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ start: 0, end: 4 });
    expect(result[1]).toMatchObject({ start: 4, end: 8 });
    expect(result[result.length - 1]?.end).toBe(8);
  });

  it('merges consecutive equal chords', () => {
    const result = normalizeSegments([seg(0, 2, c), seg(2, 4, c), seg(4, 8, g)], 8);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ start: 0, end: 4 });
  });

  it('absorbs segments shorter than the minimum duration', () => {
    const result = normalizeSegments([seg(0, 4, c), seg(4, 4.1, g), seg(4.1, 8, c)], 8);
    expect(result).toHaveLength(1);
    expect(result[0]?.chord).toMatchObject({ root: 0 });
    expect(result[0]).toMatchObject({ start: 0, end: 8 });
  });

  it('fills gaps with silence', () => {
    const result = normalizeSegments([seg(2, 4, c)], 8);
    expect(result.map((item) => item.chord)).toEqual([null, c, null]);
    expect(result[0]).toMatchObject({ start: 0, end: 2 });
    expect(result[2]).toMatchObject({ start: 4, end: 8 });
  });

  it('resolves overlaps', () => {
    const result = normalizeSegments([seg(0, 5, c), seg(3, 8, g)], 8);
    expect(result).toHaveLength(2);
    expect(result[1]?.start).toBe(5);
    expect(result.every((item) => item.start < item.end)).toBe(true);
  });

  it('turns N into silence and keeps coverage', () => {
    const result = normalizeSegments([seg(0, 4, null), seg(4, 8, c)], 8);
    expect(result[0]?.chord).toBeNull();
    expect(result[1]?.chord).toMatchObject({ root: 0 });
  });

  it('returns an empty list for invalid durations', () => {
    expect(normalizeSegments([seg(0, 4, c)], 0)).toEqual([]);
    expect(normalizeSegments([seg(0, 4, c)], Number.NaN)).toEqual([]);
  });

  it('covers the whole duration when there are no segments', () => {
    expect(normalizeSegments([], 10)).toEqual([{ start: 0, end: 10, chord: null }]);
  });
});

describe('findActiveSegmentIndex', () => {
  const segments = [seg(0, 4, c), seg(4, 8, g), seg(8, 12, am)];

  it('finds the active segment', () => {
    expect(findActiveSegmentIndex(segments, 0)).toBe(0);
    expect(findActiveSegmentIndex(segments, 3.9)).toBe(0);
    expect(findActiveSegmentIndex(segments, 4)).toBe(1);
    expect(findActiveSegmentIndex(segments, 11.9)).toBe(2);
  });

  it('returns -1 out of range or without segments', () => {
    expect(findActiveSegmentIndex(segments, -1)).toBe(-1);
    expect(findActiveSegmentIndex(segments, 12.5)).toBe(-1);
    expect(findActiveSegmentIndex([], 1)).toBe(-1);
  });

  it('accepts the exact end of the last segment', () => {
    expect(findActiveSegmentIndex(segments, 12)).toBe(2);
  });
});

describe('utilities', () => {
  it('compares chords', () => {
    expect(chordEquals(c, parseChord('C'))).toBe(true);
    expect(chordEquals(c, g)).toBe(false);
    expect(chordEquals(null, null)).toBe(true);
    expect(chordEquals(null, c)).toBe(false);
  });

  it('computes the total duration', () => {
    expect(totalDuration([seg(0, 4, c), seg(4, 9, g)])).toBe(9);
  });
});
