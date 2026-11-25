import type { Chord, ChordSegment } from './types';

export const MIN_SEGMENT_SECONDS = 0.25;
const EPSILON = 1e-6;

export function chordEquals(a: Chord | null, b: Chord | null): boolean {
  if (a === null || b === null) return a === b;
  return a.root === b.root && a.quality === b.quality && (a.bass ?? null) === (b.bass ?? null);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function prepareSegments(input: ChordSegment[], duration: number): ChordSegment[] {
  return input
    .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end))
    .map((segment) => ({
      ...segment,
      start: clamp(segment.start, 0, duration),
      end: clamp(segment.end, 0, duration),
    }))
    .filter((segment) => segment.end - segment.start > EPSILON)
    .sort((a, b) => a.start - b.start);
}

/** Drops or trims segments so they stop overlapping, preserving the earlier one. */
function resolveOverlaps(segments: ChordSegment[]): ChordSegment[] {
  const resolved: ChordSegment[] = [];
  for (const segment of segments) {
    const previous = resolved[resolved.length - 1];
    const start = previous ? Math.max(segment.start, previous.end) : segment.start;
    if (segment.end - start <= EPSILON) continue;
    resolved.push({ ...segment, start });
  }
  return resolved;
}

/** Merges equal neighbours and gives short segments to the previous chord. */
function absorbShortSegments(segments: ChordSegment[], minDuration: number): ChordSegment[] {
  const kept: ChordSegment[] = [];
  for (const segment of segments) {
    const previous = kept[kept.length - 1];
    if (previous && chordEquals(previous.chord, segment.chord)) {
      previous.end = segment.end;
      continue;
    }
    if (previous && segment.end - segment.start < minDuration) {
      previous.end = segment.end;
      continue;
    }
    kept.push({ ...segment });
  }
  return kept;
}

/** Merges equal neighbours into a single segment. */
function mergeAdjacentChords(segments: ChordSegment[]): ChordSegment[] {
  const merged: ChordSegment[] = [];
  for (const segment of segments) {
    const previous = merged[merged.length - 1];
    if (previous && chordEquals(previous.chord, segment.chord)) {
      previous.end = segment.end;
      continue;
    }
    merged.push({ ...segment });
  }
  return merged;
}

/** Inserts silence so the timeline covers `duration` without gaps. */
function fillGaps(segments: ChordSegment[], duration: number): ChordSegment[] {
  const filled: ChordSegment[] = [];
  let cursor = 0;
  for (const segment of segments) {
    if (segment.start - cursor > EPSILON) {
      filled.push({ start: cursor, end: segment.start, chord: null });
    }
    filled.push({ ...segment });
    cursor = segment.end;
  }
  if (duration - cursor > EPSILON) {
    filled.push({ start: cursor, end: duration, chord: null });
  }
  return filled;
}

/** Moves a short first segment into the one that follows it. */
function shiftLeadingShort(segments: ChordSegment[], minDuration: number): ChordSegment[] {
  const first = segments[0];
  if (segments.length <= 1 || !first || first.end - first.start >= minDuration) {
    return segments;
  }
  const next = segments[1];
  if (!next) return segments;
  next.start = first.start;
  segments.shift();
  return segments;
}

/** Gives every short segment except the first to the one before it. */
function removeTrailingShort(segments: ChordSegment[], minDuration: number): ChordSegment[] {
  for (let index = segments.length - 1; index >= 1; index -= 1) {
    const segment = segments[index];
    const previous = segments[index - 1];
    if (!segment || !previous) continue;
    if (segment.end - segment.start < minDuration) {
      previous.end = segment.end;
      segments.splice(index, 1);
    }
  }
  return segments;
}

/**
 * Repairs the invariants of a timeline: order, no overlap,
 * minimum duration, merging of equal chords and full coverage of the audio.
 */
export function normalizeSegments(
  input: ChordSegment[],
  duration: number,
  minDuration: number = MIN_SEGMENT_SECONDS,
): ChordSegment[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];

  const prepared = resolveOverlaps(prepareSegments(input, duration));
  const kept = shiftLeadingShort(absorbShortSegments(prepared, minDuration), minDuration);

  const filled = fillGaps(kept, duration);
  if (filled.length === 0) return [{ start: 0, end: duration, chord: null }];

  const trimmed = shiftLeadingShort(
    removeTrailingShort(mergeAdjacentChords(filled), minDuration),
    minDuration,
  );
  const final = mergeAdjacentChords(trimmed);

  if (final.length === 0) return [{ start: 0, end: duration, chord: null }];
  const first = final[0];
  const last = final[final.length - 1];
  if (first) first.start = 0;
  if (last) last.end = duration;
  return final;
}

/**
 * Index of the active segment at `time`, or -1 if the time falls outside the timeline.
 */
export function findActiveSegmentIndex(segments: ChordSegment[], time: number): number {
  if (segments.length === 0 || !Number.isFinite(time)) return -1;
  if (time < (segments[0]?.start ?? 0)) return -1;

  let low = 0;
  let high = segments.length - 1;
  let candidate = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const segment = segments[mid];
    if (!segment) break;
    if (segment.start <= time) {
      candidate = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const segment = segments[candidate];
  if (!segment) return -1;
  if (time < segment.end - EPSILON) return candidate;
  if (candidate === segments.length - 1 && time <= segment.end + EPSILON) return candidate;
  return -1;
}

export function totalDuration(segments: ChordSegment[]): number {
  return segments.reduce((max, segment) => Math.max(max, segment.end), 0);
}
