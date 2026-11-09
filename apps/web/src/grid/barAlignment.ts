import { chordEquals, type Chord, type ChordSegment } from '@chordifree/chords';
import { medianInterval, tempoFromBeats } from './beats';

export type BarTempo = 'auto' | 'normal' | 'half';

export interface BarCell {
  start: number;
  end: number;
  index: number;
  chord: Chord | null;
}

export interface BarAlignment {
  factor: 'normal' | 'half';
  phase: number;
  beatsPerBar: number;
  barSeconds: number;
  bars: BarCell[];
}

interface Candidate {
  factor: 'normal' | 'half';
  phase: number;
  beats: number[];
  bars: BarCell[];
  score: number;
}

const EPSILON = 1e-6;

function sanitizeBeats(beats: number[]): number[] {
  const values = beats
    .filter((beat) => Number.isFinite(beat) && beat >= 0)
    .sort((a, b) => a - b);
  return values.filter((value, index) => index === 0 || value > values[index - 1]!);
}

function chordKey(chord: Chord): string {
  return `${chord.root}:${chord.quality}:${chord.bass ?? ''}`;
}

function dominantForBar(
  segments: ChordSegment[],
  start: number,
  end: number,
): { chord: Chord | null; coverage: number } {
  const totals = new Map<string, { chord: Chord; total: number }>();
  for (const segment of segments) {
    if (!segment.chord) continue;
    const from = Math.max(start, segment.start);
    const to = Math.min(end, segment.end);
    if (to - from <= EPSILON) continue;
    const key = chordKey(segment.chord);
    const found = totals.get(key);
    if (found) found.total += to - from;
    else totals.set(key, { chord: segment.chord, total: to - from });
  }
  if (totals.size === 0) return { chord: null, coverage: 0 };
  const best = [...totals.values()].sort((a, b) => b.total - a.total)[0]!;
  return { chord: best.chord, coverage: Math.min(1, best.total / Math.max(EPSILON, end - start)) };
}

function buildBars(
  beats: number[],
  beatsPerBar: number,
  phase: number,
  duration: number,
  segments: ChordSegment[],
): BarCell[] {
  const size = Math.max(1, Math.floor(beatsPerBar) || 4);
  const bars: BarCell[] = [];
  for (let index = phase; index < beats.length; index += size) {
    const start = beats[index]!;
    const next = beats[index + size];
    const end = next ?? Math.max(duration, start + 1);
    if (end <= start + EPSILON) continue;
    const dominant = dominantForBar(segments, start, end);
    bars.push({ start, end, index: bars.length, chord: dominant.chord });
  }
  if (bars.length === 0 && duration > 0) {
    const dominant = dominantForBar(segments, 0, duration);
    bars.push({ start: 0, end: duration, index: 0, chord: dominant.chord });
  }
  return bars;
}

function changeTimes(segments: ChordSegment[]): number[] {
  const times: number[] = [];
  let previous: Chord | null = null;
  for (const segment of segments) {
    if (!segment.chord) {
      previous = null;
      continue;
    }
    if (previous && chordEquals(previous, segment.chord)) continue;
    previous = segment.chord;
    times.push(segment.start);
  }
  return times;
}

function alignmentScore(bars: BarCell[], changes: number[]): number {
  if (bars.length === 0 || changes.length === 0) return 0;
  const barSeconds = bars.reduce((sum, bar) => sum + bar.end - bar.start, 0) / bars.length;
  if (!(barSeconds > 0)) return 0;
  let total = 0;
  for (const time of changes) {
    let best = Infinity;
    for (const bar of bars) best = Math.min(best, Math.abs(time - bar.start));
    total += Math.max(0, 1 - best / (barSeconds * 0.5));
  }
  return total / changes.length;
}

function coverageScore(bars: BarCell[], segments: ChordSegment[]): number {
  if (bars.length === 0) return 0;
  let total = 0;
  for (const bar of bars) {
    total += dominantForBar(segments, bar.start, bar.end).coverage;
  }
  return total / bars.length;
}

function candidateBeats(beats: number[], factor: 'normal' | 'half'): number[][] {
  if (factor === 'normal') return [beats];
  return [beats.filter((_, index) => index % 2 === 0), beats.filter((_, index) => index % 2 === 1)];
}

function bestCandidate(
  beats: number[],
  factor: 'normal' | 'half',
  beatsPerBar: number,
  duration: number,
  segments: ChordSegment[],
  changes: number[],
): Candidate | null {
  let best: Candidate | null = null;
  const size = Math.max(1, Math.floor(beatsPerBar) || 4);
  for (const [candidateIndex, candidate] of candidateBeats(beats, factor).entries()) {
    if (candidate.length < size) continue;
    for (let phase = 0; phase < size; phase += 1) {
      const bars = buildBars(candidate, size, phase, duration, segments);
      if (bars.length === 0) continue;
      const score =
        alignmentScore(bars, changes) * 0.7 +
        coverageScore(bars, segments) * 0.3 -
        phase * 0.01 -
        candidateIndex * 0.005;
      if (!best || score > best.score) {
        best = { factor, phase, beats: candidate, bars, score };
      }
    }
  }
  return best;
}

/**
 * Elige una rejilla de compases. En automático prefiere mitad de tempo cuando
 * el detector devuelve más de 100 BPM (el caso habitual de baladas detectadas
 * al doble) y busca la fase que mejor alinea los cambios de acorde.
 */
export function chooseBarAlignment(
  segments: ChordSegment[],
  beats: number[],
  beatsPerBar: number,
  duration: number,
  tempo: BarTempo = 'auto',
): BarAlignment {
  const clean = sanitizeBeats(beats);
  const size = Math.max(1, Math.floor(beatsPerBar) || 4);
  if (clean.length < size) {
    const bars = buildBars(clean, size, 0, duration, segments);
    return {
      factor: 'normal',
      phase: 0,
      beatsPerBar: size,
      barSeconds: bars[0]?.end ?? duration,
      bars,
    };
  }

  const changes = changeTimes(segments);
  const normal = bestCandidate(clean, 'normal', size, duration, segments, changes);
  const half = bestCandidate(clean, 'half', size, duration, segments, changes);
  const bpm = tempoFromBeats(clean) ?? 0;

  let chosen: Candidate | null;
  if (tempo === 'normal') chosen = normal;
  else if (tempo === 'half') chosen = half;
  else chosen = bpm > 100 && half ? half : (normal ?? half);

  if (!chosen) {
    const bars = buildBars(clean, size, 0, duration, segments);
    return {
      factor: 'normal',
      phase: 0,
      beatsPerBar: size,
      barSeconds: bars[0]?.end ?? duration,
      bars,
    };
  }

  const interval = medianInterval(chosen.beats);
  return {
    factor: chosen.factor,
    phase: chosen.phase,
    beatsPerBar: size,
    barSeconds: interval * size,
    bars: chosen.bars,
  };
}
