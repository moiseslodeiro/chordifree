import { describe, expect, it } from 'vitest';
import { parseChord, type ChordSegment } from '@chordifree/chords';
import { buildBeatGrid, buildBeatRows, extendBeats, tempoFromBeats } from '../src/grid/beats';

const segments: ChordSegment[] = [
  { start: 0, end: 2.5, chord: parseChord('C') },
  { start: 2.5, end: 10, chord: parseChord('G') },
];

describe('buildBeatGrid', () => {
  it('groups the beats into complete four-beat bars', () => {
    const bars = buildBeatGrid(segments, [0, 1, 2, 3, 4, 5, 6, 7]);
    expect(bars).toHaveLength(2);
    expect(bars[0]?.start).toBe(0);
    expect(bars[1]?.start).toBe(4);
    expect(bars[0]?.cells).toHaveLength(4);
    expect(bars[0]?.cells.every((cell) => cell !== null)).toBe(true);
  });

  it('fills the last incomplete bar with non-focusable cells', () => {
    const bars = buildBeatGrid(segments, [0, 1, 2, 3, 4, 5]);
    expect(bars).toHaveLength(2);
    expect(bars[1]?.cells.map((cell) => cell?.time ?? null)).toEqual([4, 5, null, null]);
  });

  it('marks the chord change on the corresponding beat', () => {
    const changing: ChordSegment[] = [
      { start: 0, end: 1.5, chord: parseChord('C') },
      { start: 1.5, end: 10, chord: parseChord('G') },
    ];
    const bars = buildBeatGrid(changing, [0, 1, 2, 3, 4]);
    expect(bars[0]?.cells.map((cell) => cell?.change)).toEqual([true, false, true, false]);
    expect(bars[0]?.cells.map((cell) => cell?.chord?.quality ?? null)).toEqual([
      'major',
      'major',
      'major',
      'major',
    ]);
    expect(bars[0]?.cells[2]?.chord?.root).toBe(7);
  });

  it('shows silence as an explicit absence of chord', () => {
    const withSilence: ChordSegment[] = [
      { start: 0, end: 2, chord: null },
      { start: 2, end: 10, chord: parseChord('C') },
    ];
    const bars = buildBeatGrid(withSilence, [0, 1, 2, 3]);
    expect(bars[0]?.cells[0]?.chord).toBeNull();
    expect(bars[0]?.cells[0]?.change).toBe(true);
    expect(bars[0]?.cells[1]?.change).toBe(false);
    expect(bars[0]?.cells[2]?.change).toBe(true);
  });

  it('returns an empty grid without beats', () => {
    expect(buildBeatGrid(segments, [])).toEqual([]);
  });

  it('sanitizes invalid beats and uses four beats by default', () => {
    const bars = buildBeatGrid(segments, [3, 0, 0, 1, -1, Number.NaN], 0);
    expect(bars).toHaveLength(1);
    expect(bars[0]?.cells.map((cell) => cell?.time ?? null)).toEqual([0, 1, 3, null]);
  });

  it('extends incomplete beats up to the duration using the median interval', () => {
    const bars = buildBeatGrid(segments, [0, 1, 2, 3, 4], 4, 9.5);
    const times = bars
      .flatMap((bar) => bar.cells)
      .filter((cell) => cell !== null)
      .map((cell) => cell.time);
    expect(times).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('does not invent beats when the list arrives empty', () => {
    expect(buildBeatGrid(segments, [], 4, 120)).toEqual([]);
  });

  it('does not extend if the last beat already covers up to the duration', () => {
    const bars = buildBeatGrid(segments, [0, 1, 2, 3], 4, 4);
    const times = bars.flatMap((bar) => bar.cells.map((cell) => cell?.time ?? null));
    expect(times).toEqual([0, 1, 2, 3]);
  });
});

describe('extendBeats', () => {
  it('extends using the median interval and is idempotent', () => {
    const once = extendBeats([0, 2, 4], 7);
    expect(once).toEqual([0, 2, 4, 6]);
    expect(extendBeats(once, 7)).toEqual(once);
  });

  it('returns the sanitized list without a duration', () => {
    expect(extendBeats([3, 0, 0, -1, Number.NaN])).toEqual([0, 3]);
  });

  it('rebuilds the grid at a constant tempo and corrects jitter', () => {
    expect(extendBeats([0, 1.1, 1.9, 3.1, 4], 6)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('tempoFromBeats', () => {
  it('estimates beats per minute from the median of the intervals', () => {
    expect(tempoFromBeats([0, 0.5, 1, 1.5, 2])).toBe(120);
    expect(tempoFromBeats([0, 1.2, 2.4, 3.6])).toBe(50);
  });

  it('returns null without enough beats', () => {
    expect(tempoFromBeats([])).toBeNull();
    expect(tempoFromBeats([12])).toBeNull();
  });
});

describe('buildBeatRows', () => {
  const beats = Array.from({ length: 24 }, (_, index) => index);

  it('groups two four-beat bars into a row of eight cells', () => {
    const rows = buildBeatRows(segments, beats, 4);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.cells).toHaveLength(8);
    expect(rows[0]?.bars).toHaveLength(2);
    expect(rows[0]?.start).toBe(0);
    expect(rows[0]?.barStarts).toEqual([0, 4]);
    expect(rows[1]?.start).toBe(8);
    expect(rows[1]?.barStarts).toEqual([8, 12]);
    expect(rows[2]?.start).toBe(16);
    expect(rows[2]?.barStarts).toEqual([16, 20]);
  });

  it('fills the last incomplete row up to eight positions', () => {
    const rows = buildBeatRows(segments, beats.slice(0, 18), 4);
    expect(rows).toHaveLength(3);
    expect(rows[2]?.cells).toHaveLength(8);
    expect(rows[2]?.cells.filter((cell) => cell !== null)).toHaveLength(2);
    expect(rows[2]?.cells.slice(2)).toEqual([null, null, null, null, null, null]);
  });

  it('respects the boundary between rows when resolving the current chord', () => {
    const changing: ChordSegment[] = [
      { start: 0, end: 7.5, chord: parseChord('C') },
      { start: 7.5, end: 30, chord: parseChord('G') },
    ];
    const rows = buildBeatRows(changing, beats, 4);
    expect(rows[0]?.cells[7]?.chord?.root).toBe(0);
    expect(rows[1]?.cells[0]?.chord?.root).toBe(7);
  });

  it('covers the whole song when the saved beats are cut short', () => {
    const rows = buildBeatRows(segments, [0, 1, 2, 3, 4], 4, 2, 20);
    const cells = rows.flatMap((row) => row.cells).filter((cell) => cell !== null);
    expect(cells.at(-1)?.time).toBe(19);
    expect(cells.length).toBe(20);
  });

  it('returns an empty list without beats', () => {
    expect(buildBeatRows(segments, [], 4)).toEqual([]);
  });
});
