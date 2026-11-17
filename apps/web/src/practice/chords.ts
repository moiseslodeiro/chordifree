import { CHORD_TONES, mod12, type Chord, type PitchClass, type Quality } from '@chordifree/chords';

/** Qualities the microphone detector tries to recognize. */
export const DETECTED_QUALITIES: Quality[] = [
  'major',
  'minor',
  '7',
  'm7',
  'maj7',
  '6',
  'm6',
  'sus2',
  'sus4',
  'dim',
  'aug',
  'power',
];

export interface DetectedChord {
  chord: Chord;
  score: number;
}

export interface DetectChordOptions {
  /** Minimum combined score to accept a chord. */
  minScore?: number;
  /** How much the best candidate must beat the runner-up. */
  minMargin?: number;
}

const DEFAULT_MIN_SCORE = 0.62;
const DEFAULT_MIN_MARGIN = 0.005;
const MIN_FREQ = 70;
const MAX_FREQ = 1600;
const MIN_DB = -85;
const TUNING_TOLERANCE_CENTS = 35;

/**
 * Builds a 12-bin chroma vector from an AnalyserNode magnitude spectrum.
 *
 * Bins are folded into the nearest pitch class with a Gaussian weight around
 * the exact note centre, which keeps the detector usable with slightly
 * out-of-tune instruments.
 */
export function chromaFromSpectrum(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
  minFreq = MIN_FREQ,
  maxFreq = MAX_FREQ,
): Float32Array {
  const chroma = new Float32Array(12);
  for (let bin = 1; bin < magnitudes.length; bin += 1) {
    const frequency = (bin * sampleRate) / fftSize;
    if (frequency < minFreq || frequency > maxFreq) continue;
    const db = magnitudes[bin];
    if (db === undefined || !Number.isFinite(db) || db < MIN_DB) continue;

    const magnitude = 10 ** (db / 20);
    const midi = 69 + 12 * Math.log2(frequency / 440);
    const nearest = Math.round(midi);
    const cents = (midi - nearest) * 100;
    const weight = Math.exp(-0.5 * (cents / TUNING_TOLERANCE_CENTS) ** 2);
    if (weight < 0.05) continue;

    const pitchClass = mod12(nearest);
    chroma[pitchClass] = (chroma[pitchClass] ?? 0) + magnitude * weight;
  }

  const max = Math.max(...chroma);
  if (max > 0) {
    for (let index = 0; index < chroma.length; index += 1) {
      chroma[index] = (chroma[index] ?? 0) / max;
    }
  }
  return chroma;
}

function normalize(vector: ArrayLike<number>): Float32Array {
  let sum = 0;
  for (let index = 0; index < vector.length; index += 1) {
    const value = vector[index] ?? 0;
    sum += value * value;
  }
  const length = Math.sqrt(sum);
  const result = new Float32Array(12);
  if (length === 0) return result;
  for (let index = 0; index < 12; index += 1) {
    result[index] = (vector[index] ?? 0) / length;
  }
  return result;
}

function templateFor(root: PitchClass, quality: Quality): Float32Array {
  const template = new Float32Array(12);
  for (const interval of CHORD_TONES[quality] ?? [0]) {
    template[mod12(root + interval)] = 1;
  }
  return template;
}

function scoreTemplate(chroma: Float32Array, template: Float32Array): number {
  const normalizedChroma = normalize(chroma);
  const normalizedTemplate = normalize(template);

  let dot = 0;
  let toneEnergy = 0;
  let offEnergy = 0;
  for (let index = 0; index < 12; index += 1) {
    const value = chroma[index] ?? 0;
    dot += (normalizedChroma[index] ?? 0) * (normalizedTemplate[index] ?? 0);
    if ((template[index] ?? 0) > 0) toneEnergy += value;
    else offEnergy += value;
  }

  const coverage = toneEnergy / (toneEnergy + offEnergy + 1e-9);
  return 0.75 * dot + 0.25 * coverage;
}

/**
 * Picks the most likely chord from a chroma vector.
 *
 * The score combines cosine similarity with the chord template and how much
 * of the captured energy belongs to chord tones. A minimum margin avoids
 * swapping between ambiguous relative chords frame by frame.
 */
export function detectChordFromChroma(
  chroma: ArrayLike<number>,
  options: DetectChordOptions = {},
): DetectedChord | null {
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const minMargin = options.minMargin ?? DEFAULT_MIN_MARGIN;

  const values = new Float32Array(12);
  let total = 0;
  for (let index = 0; index < 12; index += 1) {
    const value = chroma[index] ?? 0;
    values[index] = value;
    total += value;
  }
  if (total <= 0) return null;

  let best: DetectedChord | null = null;
  let secondScore = 0;

  for (const quality of DETECTED_QUALITIES) {
    for (let root = 0; root < 12; root += 1) {
      const score = scoreTemplate(values, templateFor(root as PitchClass, quality));
      if (!best || score > best.score) {
        if (best) secondScore = best.score;
        best = { chord: { root: root as PitchClass, quality }, score };
      } else if (score > secondScore) {
        secondScore = score;
      }
    }
  }

  if (!best || best.score < minScore) return null;
  if (best.score - secondScore < minMargin) return null;
  return best;
}

function essentialPitchClasses(chord: Chord): Set<number> {
  const intervals = CHORD_TONES[chord.quality] ?? [0];
  const third = intervals.find((interval) => interval === 3 || interval === 4);
  const suspended = intervals.find((interval) => interval === 2 || interval === 5);
  const fifth = intervals.find((interval) => interval === 6 || interval === 7 || interval === 8);
  const core = [0, third ?? suspended, fifth].filter(
    (interval): interval is number => interval !== undefined,
  );
  return new Set(core.map((interval) => mod12(chord.root + interval)));
}

function isSubset(left: Set<number>, right: Set<number>): boolean {
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

/**
 * Practice-friendly comparison: the root must match and one chord's essential
 * tones (root, third/suspension, fifth) must contain the other's. This accepts
 * Cmaj7/C6/C5 shapes for a C chord while rejecting C major against C minor.
 */
export function chordMatches(expected: Chord, detected: Chord): boolean {
  if (expected.root !== detected.root) return false;
  const expectedCore = essentialPitchClasses(expected);
  const detectedCore = essentialPitchClasses(detected);
  return isSubset(expectedCore, detectedCore) || isSubset(detectedCore, expectedCore);
}
