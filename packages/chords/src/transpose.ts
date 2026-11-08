import { mod12 } from './notes';
import type { Chord } from './types';

export function transposeChord(chord: Chord, semitones: number): Chord {
  const shift = ((Math.trunc(semitones) % 12) + 12) % 12;
  const result: Chord = {
    root: mod12(chord.root + shift),
    quality: chord.quality,
  };
  if (chord.bass !== undefined) {
    const bass = mod12(chord.bass + shift);
    if (bass !== result.root) result.bass = bass;
  }
  return result;
}

export function clampTranspose(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-11, Math.min(11, Math.trunc(value)));
}
