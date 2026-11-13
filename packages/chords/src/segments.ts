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

  const clamped = input
    .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end))
    .map((segment) => ({
      ...segment,
      start: clamp(segment.start, 0, duration),
      end: clamp(segment.end, 0, duration),
    }))
    .filter((segment) => segment.end - segment.start > EPSILON)
    .sort((a, b) => a.start - b.start);

  const resolved: ChordSegment[] = [];
  for (const segment of clamped) {
    const previous = resolved[resolved.length - 1];
    const start = previous ? Math.max(segment.start, previous.end) : segment.start;
    if (segment.end - start <= EPSILON) continue;
    resolved.push({ ...segment, start });
  }

  const kept: ChordSegment[] = [];
  for (const segment of resolved) {
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

  if (kept.length > 1 && kept[0] && kept[0].end - kept[0].start < minDuration) {
    const first = kept.shift();
    const next = kept[0];
    if (first && next) next.start = first.start;
  }

  const filled: ChordSegment[] = [];
  let cursor = 0;
  for (const segment of kept) {
    if (segment.start - cursor > EPSILON) {
      filled.push({ start: cursor, end: segment.start, chord: null });
    }
    filled.push({ ...segment });
    cursor = segment.end;
  }
  if (duration - cursor > EPSILON) {
    filled.push({ start: cursor, end: duration, chord: null });
  }
  if (filled.length === 0) {
    return [{ start: 0, end: duration, chord: null }];
  }

  const merged: ChordSegment[] = [];
  for (const segment of filled) {
    const previous = merged[merged.length - 1];
    if (previous && chordEquals(previous.chord, segment.chord)) {
      previous.end = segment.end;
      continue;
    }
    merged.push({ ...segment });
  }

  for (let i = merged.length - 1; i >= 1; i -= 1) {
    const segment = merged[i];
    const previous = merged[i - 1];
    if (!segment || !previous) continue;
    if (segment.end - segment.start < minDuration) {
      previous.end = segment.end;
      merged.splice(i, 1);
    }
  }
  if (merged.length > 1 && merged[0] && merged[0].end - merged[0].start < minDuration) {
    const first = merged.shift();
    const next = merged[0];
    if (first && next) next.start = first.start;
  }

  const final: ChordSegment[] = [];
  for (const segment of merged) {
    const previous = final[final.length - 1];
    if (previous && chordEquals(previous.chord, segment.chord)) {
      previous.end = segment.end;
      continue;
    }
    final.push({ ...segment });
  }

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
