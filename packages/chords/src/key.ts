import { mod12 } from './notes';
import type {
  Accidental,
  AccidentalPreference,
  ChordSegment,
  EstimatedKey,
  KeyMode,
  PitchClass,
} from './types';

/** Krumhansl-Schmuckler profiles, rotated over the tonic. */
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const FLAT_MAJOR_TONICS = new Set<PitchClass>([5, 10, 3, 8, 1, 6, 11]);
const FLAT_MINOR_TONICS = new Set<PitchClass>([2, 7, 0, 5, 10, 3, 8]);

const CHORD_TONES: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  power: [0, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  '7sus4': [0, 5, 7, 10],
  add9: [0, 4, 7, 2],
  '9': [0, 4, 7, 10, 2],
  maj9: [0, 4, 7, 11, 2],
  m9: [0, 3, 7, 10, 2],
  '11': [0, 4, 7, 10, 2, 5],
  m11: [0, 3, 7, 10, 2, 5],
  '13': [0, 4, 7, 10, 2, 9],
  m13: [0, 3, 7, 10, 2, 9],
  '6/9': [0, 4, 7, 9, 2],
};

const TONE_WEIGHTS = [1, 0.6, 0.45, 0.25, 0.2, 0.15];

function histogram(segments: ChordSegment[]): number[] {
  const values = new Array<number>(12).fill(0);
  for (const segment of segments) {
    if (!segment.chord) continue;
    const weight = Math.max(0, segment.end - segment.start);
    if (weight === 0) continue;
    const tones = CHORD_TONES[segment.chord.quality] ?? [0];
    tones.forEach((interval, index) => {
      const pc = mod12(segment.chord!.root + interval);
      values[pc] = (values[pc] ?? 0) + weight * (TONE_WEIGHTS[index] ?? 0.1);
    });
    if (segment.chord.bass !== undefined) {
      values[segment.chord.bass] = (values[segment.chord.bass] ?? 0) + weight * 0.3;
    }
  }
  return values;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const meanA = a.reduce((sum, value) => sum + value, 0) / n;
  const meanB = b.reduce((sum, value) => sum + value, 0) / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = (a[i] ?? 0) - meanA;
    const db = (b[i] ?? 0) - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  if (denA === 0 || denB === 0) return 0;
  return num / Math.sqrt(denA * denB);
}

function rotateProfile(profile: number[], tonic: number): number[] {
  const rotated = new Array<number>(12);
  for (let i = 0; i < 12; i += 1) {
    rotated[i] = profile[(i - tonic + 12) % 12] ?? 0;
  }
  return rotated;
}

/**
 * Estimates the dominant key from the roots weighted by duration.
 * Returns null if there is no harmonic material.
 */
export function estimateKey(segments: ChordSegment[]): EstimatedKey | null {
  const values = histogram(segments);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;

  let best: EstimatedKey | null = null;
  let bestScore = -Infinity;

  for (let tonic = 0; tonic < 12; tonic += 1) {
    for (const mode of ['major', 'minor'] as KeyMode[]) {
      const profile = rotateProfile(mode === 'major' ? MAJOR_PROFILE : MINOR_PROFILE, tonic);
      const score = pearson(values, profile);
      if (score > bestScore) {
        bestScore = score;
        best = { tonic: tonic as PitchClass, mode };
      }
    }
  }

  return best;
}

export function accidentalForKey(key: EstimatedKey | null): Accidental {
  if (!key) return 'sharp';
  const set = key.mode === 'major' ? FLAT_MAJOR_TONICS : FLAT_MINOR_TONICS;
  return set.has(key.tonic) ? 'flat' : 'sharp';
}

export function resolveAccidental(
  key: EstimatedKey | null,
  preference: AccidentalPreference,
): Accidental {
  if (preference === 'sharp' || preference === 'flat') return preference;
  return accidentalForKey(key);
}

export function relativeMajor(tonic: PitchClass): PitchClass {
  return mod12(tonic + 3);
}

/** Relative key: switches between major and minor while keeping the key signature. */
export function relativeKey(key: EstimatedKey): EstimatedKey {
  return {
    tonic: mod12(key.tonic + (key.mode === 'major' ? 9 : 3)),
    mode: key.mode === 'major' ? 'minor' : 'major',
  };
}

/** Transposes a whole key while keeping the mode. */
export function transposeKey(key: EstimatedKey, semitones: number): EstimatedKey {
  return {
    tonic: mod12(key.tonic + Math.trunc(semitones)),
    mode: key.mode,
  };
}
