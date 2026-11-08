import type { Chord, ChordSegment } from '@chordifree/chords';

export const MIN_SEGMENT_SECONDS = 0.25;
const EPSILON = 0.001;

export class EditorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EditorError';
  }
}

function clone(segments: ChordSegment[]): ChordSegment[] {
  return segments.map((segment) => ({ ...segment, chord: segment.chord ? { ...segment.chord } : null }));
}

export function changeChord(
  segments: ChordSegment[],
  index: number,
  chord: Chord | null,
): ChordSegment[] {
  if (!segments[index]) throw new EditorError('Segmento inexistente');
  return segments.map((segment, current) =>
    current === index ? { ...segment, chord: chord ? { ...chord } : null } : segment,
  );
}

export function setBoundary(
  segments: ChordSegment[],
  index: number,
  edge: 'start' | 'end',
  time: number,
  duration: number,
): ChordSegment[] {
  const segment = segments[index];
  if (!segment) throw new EditorError('Segmento inexistente');
  if (!Number.isFinite(time)) throw new EditorError('Tiempo no válido');

  const next = clone(segments);

  if (edge === 'start') {
    const previous = segments[index - 1];
    const lower = previous ? previous.start + MIN_SEGMENT_SECONDS : 0;
    if (time < lower) {
      throw new EditorError('El inicio no puede solaparse con el segmento anterior');
    }
    if (time > segment.end - MIN_SEGMENT_SECONDS) {
      throw new EditorError('El segmento resultante sería demasiado corto');
    }
    if (previous) next[index - 1] = { ...previous, end: time };
    next[index] = { ...segment, start: time };
  } else {
    const following = segments[index + 1];
    const upper = following ? following.end - MIN_SEGMENT_SECONDS : duration;
    if (time > upper) {
      throw new EditorError('El fin no puede solaparse con el segmento siguiente');
    }
    if (time < segment.start + MIN_SEGMENT_SECONDS) {
      throw new EditorError('El segmento resultante sería demasiado corto');
    }
    if (following) next[index + 1] = { ...following, start: time };
    next[index] = { ...segment, end: time };
  }

  return next;
}

export function splitSegment(
  segments: ChordSegment[],
  index: number,
  time: number,
  _duration: number,
): ChordSegment[] {
  const segment = segments[index];
  if (!segment) throw new EditorError('Segmento inexistente');
  if (time <= segment.start + MIN_SEGMENT_SECONDS || time >= segment.end - MIN_SEGMENT_SECONDS) {
    throw new EditorError('El punto de corte debe dejar dos segmentos suficientemente largos');
  }
  const next = clone(segments);
  next.splice(index, 1, { ...segment, end: time }, { ...segment, start: time });
  return next;
}

export function canMerge(segments: ChordSegment[], index: number): boolean {
  const current = segments[index];
  const following = segments[index + 1];
  if (!current || !following) return false;
  return Math.abs(current.end - following.start) < EPSILON;
}

export function mergeSegments(
  segments: ChordSegment[],
  index: number,
  _duration: number,
): ChordSegment[] {
  if (!canMerge(segments, index)) {
    throw new EditorError('Solo se pueden fusionar segmentos adyacentes');
  }
  const current = segments[index];
  const following = segments[index + 1];
  if (!current || !following) throw new EditorError('Segmento inexistente');
  const next = clone(segments);
  next.splice(index, 2, { ...current, end: following.end });
  return next;
}

export function restoreDetected(detected: ChordSegment[]): ChordSegment[] {
  return clone(detected);
}
