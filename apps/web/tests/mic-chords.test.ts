import { describe, expect, it } from 'vitest';
import { parseChord } from '@chordifree/chords';
import { chordMatches, chromaFromSpectrum, detectChordFromChroma } from '../src/practice/chords';

function chroma(notes: number[]): Float32Array {
  const values = new Float32Array(12);
  for (const note of notes) values[note] = 1;
  return values;
}

describe('microphone chord detection', () => {
  it('detects a C major triad', () => {
    const result = detectChordFromChroma(chroma([0, 4, 7]));
    expect(result?.chord.root).toBe(0);
    expect(result?.chord.quality).toBe('major');
  });

  it('detects an A minor triad', () => {
    const result = detectChordFromChroma(chroma([9, 0, 4]));
    expect(result?.chord.root).toBe(9);
    expect(result?.chord.quality).toBe('minor');
  });

  it('detects a dominant seventh', () => {
    const result = detectChordFromChroma(chroma([7, 11, 2, 5]));
    expect(result?.chord.root).toBe(7);
    expect(result?.chord.quality).toBe('7');
  });

  it('folds a synthetic spectrum into a chord', () => {
    const sampleRate = 48_000;
    const fftSize = 4096;
    const spectrum = new Float32Array(fftSize / 2).fill(-100);
    for (const frequency of [261.63, 329.63, 392.0]) {
      const bin = Math.round((frequency * fftSize) / sampleRate);
      spectrum[bin] = -20;
      spectrum[bin + 1] = -24;
      spectrum[bin - 1] = -24;
    }

    const result = detectChordFromChroma(chromaFromSpectrum(spectrum, sampleRate, fftSize));
    expect(result).not.toBeNull();
    expect(chordMatches(parseChord('C')!, result!.chord)).toBe(true);
  });

  it('accepts extensions and power chords for the same root', () => {
    const c = parseChord('C')!;
    const cmaj7 = parseChord('Cmaj7')!;
    const c5 = parseChord('C5')!;
    expect(chordMatches(c, cmaj7)).toBe(true);
    expect(chordMatches(cmaj7, c)).toBe(true);
    expect(chordMatches(c, c5)).toBe(true);
  });

  it('rejects a different root or a major/minor mismatch', () => {
    expect(chordMatches(parseChord('C')!, parseChord('G')!)).toBe(false);
    expect(chordMatches(parseChord('C')!, parseChord('Cm')!)).toBe(false);
    expect(chordMatches(parseChord('Csus4')!, parseChord('C')!)).toBe(false);
  });
});
