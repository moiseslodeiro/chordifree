import {
  chordEquals,
  findActiveSegmentIndex,
  type Chord,
  type ChordSegment,
} from '@chordifree/chords';

export interface BeatCell {
  /** Beat time in seconds. */
  time: number;
  /** Global beat index within the song. */
  beatIndex: number;
  /** Chord active at the start of the beat. */
  chord: Chord | null;
  /** The chord differs from the previous beat. */
  change: boolean;
  /** Index of the active segment, or -1 if there is none. */
  segmentIndex: number;
  /** Detector confidence for the active chord, if available. */
  confidence?: number;
}

export interface BeatBar {
  index: number;
  start: number;
  cells: (BeatCell | null)[];
}

export interface BeatRow {
  index: number;
  start: number;
  bars: BeatBar[];
  cells: (BeatCell | null)[];
  barStarts: number[];
}

/**
 * Median of the intervals between beats. Returns 0 if there are not at least two
 * usable beats.
 */
export function medianInterval(times: number[]): number {
  if (times.length < 2) return 0;
  const intervals: number[] = [];
  for (let index = 1; index < times.length; index += 1) {
    const interval = times[index]! - times[index - 1]!;
    if (interval > 0) intervals.push(interval);
  }
  if (intervals.length === 0) return 0;
  intervals.sort((a, b) => a - b);
  const middle = Math.floor(intervals.length / 2);
  return intervals.length % 2 === 0
    ? (intervals[middle - 1]! + intervals[middle]!) / 2
    : intervals[middle]!;
}

/**
 * Sanitizes the beats and builds a constant-tempo grid anchored to the
 * first detected beat. The analyzer may return beats with small
 * variations (jitter) or skip some; rebuilding the grid with the
 * median interval makes the cells fall on the song's real beat again
 * and playback does not drift out of sync.
 *
 * When no duration is available, the sanitized list is returned as is,
 * because it is impossible to know how far to extend it.
 *
 * It is idempotent: if the beats already form a regular grid, it returns
 * the same list.
 */
export function extendBeats(beats: number[], duration?: number): number[] {
  const values = beats.filter((beat) => Number.isFinite(beat) && beat >= 0).sort((a, b) => a - b);
  const times = values.filter((value, index) => index === 0 || value > values[index - 1]!);
  if (times.length === 0 || duration === undefined || !Number.isFinite(duration)) {
    return times;
  }

  const interval = medianInterval(times);
  if (!(interval > 0)) return times;

  const start = times[0]!;
  const end = Math.max(duration, times.at(-1)!);
  const grid: number[] = [];
  for (let index = 0; ; index += 1) {
    const time = start + index * interval;
    if (time > end + 1e-9) break;
    if (time >= duration && index > 0) break;
    if (grid.length >= 200_000) break;
    grid.push(Number(time.toFixed(6)));
  }
  return grid;
}

/**
 * Estimated tempo in beats per minute from the median of the intervals
 * between beats. Returns `null` if there is not enough data.
 */
export function tempoFromBeats(beats: number[]): number | null {
  const times = beats
    .filter((beat) => Number.isFinite(beat) && beat >= 0)
    .sort((a, b) => a - b)
    .filter((beat, index, values) => index === 0 || beat > values[index - 1]!);
  const interval = medianInterval(times);
  if (!(interval > 0)) return null;
  return Math.round(60 / interval);
}

/**
 * Groups the beats into bars of `beatsPerBar` beats and resolves the active
 * chord of each cell. Missing cells in the last bar are `null`.
 */
export function buildBeatGrid(
  segments: ChordSegment[],
  beats: number[],
  beatsPerBar = 4,
  duration?: number,
): BeatBar[] {
  const size = Number.isFinite(beatsPerBar) && beatsPerBar > 0 ? Math.floor(beatsPerBar) : 4;
  const times = extendBeats(beats, duration);
  if (times.length === 0) return [];

  // The segments start at the original detected beat; the grid is
  // rebuilt with the median tempo, so a small tolerance is allowed
  // so that a chord change is not shown one beat late by a few
  // milliseconds of difference.
  const interval = medianInterval(times);
  const tolerance = interval > 0 ? interval * 0.2 : 0;

  const bars: BeatBar[] = [];
  let previousChord: Chord | null = null;
  let hasPrevious = false;

  for (let start = 0; start < times.length; start += size) {
    const barTimes = times.slice(start, start + size);
    const cells: (BeatCell | null)[] = barTimes.map((time, offset) => {
      const beatIndex = start + offset;
      const segmentIndex = findActiveSegmentIndex(segments, time + tolerance);
      const chord = segmentIndex >= 0 ? (segments[segmentIndex]?.chord ?? null) : null;
      const confidence =
        segmentIndex >= 0 ? segments[segmentIndex]?.confidence : undefined;
      const change = !hasPrevious || !chordEquals(previousChord, chord);
      previousChord = chord;
      hasPrevious = true;
      return {
        time,
        beatIndex,
        chord,
        change,
        segmentIndex,
        ...(confidence !== undefined ? { confidence } : {}),
      };
    });

    while (cells.length < size) cells.push(null);
    bars.push({ index: bars.length, start: barTimes[0]!, cells });
  }

  return bars;
}

/**
 * Groups the bars into rows of two bars (eight beats in 4/4) for
 * presentation. The last row is padded with `null` cells to complete
 * all positions.
 */
export function buildBeatRows(
  segments: ChordSegment[],
  beats: number[],
  beatsPerBar = 4,
  barsPerRow = 2,
  duration?: number,
): BeatRow[] {
  const bars = buildBeatGrid(segments, beats, beatsPerBar, duration);
  if (bars.length === 0) return [];

  const barSize = bars[0]?.cells.length ?? 4;
  const chunkSize = Math.max(1, Math.floor(barsPerRow));
  const rowSize = barSize * chunkSize;
  const rows: BeatRow[] = [];

  for (let start = 0; start < bars.length; start += chunkSize) {
    const rowBars = bars.slice(start, start + chunkSize);
    const cells = rowBars.flatMap((bar) => bar.cells);
    while (cells.length < rowSize) cells.push(null);
    rows.push({
      index: rows.length,
      start: rowBars[0]!.start,
      bars: rowBars,
      cells,
      barStarts: rowBars.map((bar) => bar.start),
    });
  }

  return rows;
}
