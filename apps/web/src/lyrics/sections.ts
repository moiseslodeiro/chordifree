import type { Chord } from '@chordifree/chords';
import { buildBeatGrid } from '../grid/beats';

export interface HarmonyBar {
  start: number;
  end: number;
  chord: Chord | null;
}

export interface InstrumentalSpan {
  start: number;
  end: number;
  kind: 'intro' | 'interlude' | 'outro';
}

const PHRASE_BARS = 4;
const MIN_INTRO_BARS = 2;
const MAX_INTRO_BARS = 16;
const MIN_OUTRO_BARS = 2;
const MAX_OUTRO_BARS = 16;
const MIN_INTERLUDE_BARS = 4;
const MAX_INTERLUDE_CHORDS = 2;

function chordKey(chord: Chord | null): string {
  return chord ? `${chord.root}:${chord.quality}:${chord.bass ?? ''}` : '-';
}

function phraseKey(chords: Array<Chord | null>, start: number): string | null {
  const window = chords.slice(start, start + PHRASE_BARS);
  if (window.length < PHRASE_BARS || window.some((chord) => chord === null)) return null;
  const distinct = new Set(window.map((chord) => chordKey(chord)));
  if (distinct.size < 2) return null;
  return window.map(chordKey).join('|');
}

/**
 * Labels each bar with the chord of its first beat. The label is
 * enough to recognize repeated harmonic phrases; it is not meant to describe
 * chord changes within the bar.
 */
export function harmonyBars(
  segments: Parameters<typeof buildBeatGrid>[0],
  beats: number[],
  beatsPerBar: number,
  duration: number,
): HarmonyBar[] {
  const bars = buildBeatGrid(segments, beats, beatsPerBar, duration);
  return bars.map((bar, index) => {
    const chord = bar.cells.find((cell) => cell?.chord)?.chord ?? null;
    const next = bars[index + 1];
    return {
      start: bar.start,
      end: next?.start ?? Math.max(duration, bar.start + 1),
      chord,
    };
  });
}

/**
 * Conservative detection of instrumental passages from the harmonic
 * structure. It only marks an intro/outro when the main phrase appears at
 * least twice and an interlude when the gap is long and uses at most two
 * chords (vamp or pedal). When in doubt, it marks nothing.
 */
export function detectInstrumentalSpans(
  bars: HarmonyBar[],
  duration: number,
): InstrumentalSpan[] {
  if (bars.length < PHRASE_BARS * 2) return [];

  const chords = bars.map((bar) => bar.chord);
  const counts = new Map<string, number>();
  for (let index = 0; index + PHRASE_BARS <= chords.length; index += 1) {
    const key = phraseKey(chords, index);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let mainKey: string | null = null;
  let mainCount = 0;
  for (const [key, count] of counts) {
    if (count > mainCount) {
      mainCount = count;
      mainKey = key;
    }
  }
  if (!mainKey || mainCount < 2) return [];

  const occurrences: Array<[number, number]> = [];
  for (let index = 0; index + PHRASE_BARS <= chords.length; ) {
    if (phraseKey(chords, index) === mainKey) {
      occurrences.push([index, index + PHRASE_BARS]);
      index += PHRASE_BARS;
    } else {
      index += 1;
    }
  }
  if (occurrences.length < 2) return [];

  const spans: InstrumentalSpan[] = [];
  const first = occurrences[0]!;
  if (first[0] >= MIN_INTRO_BARS && first[0] <= MAX_INTRO_BARS) {
    spans.push({ start: bars[0]!.start, end: bars[first[0]]!.start, kind: 'intro' });
  }

  const last = occurrences[occurrences.length - 1]!;
  const lastBar = bars[last[1] - 1]!;
  const tailBars = bars.length - last[1];
  if (tailBars >= MIN_OUTRO_BARS && tailBars <= MAX_OUTRO_BARS && duration > lastBar.end) {
    spans.push({ start: lastBar.end, end: duration, kind: 'outro' });
  }

  for (let index = 1; index < occurrences.length; index += 1) {
    const previousEnd = occurrences[index - 1]![1];
    const nextStart = occurrences[index]![0];
    if (nextStart - previousEnd < MIN_INTERLUDE_BARS) continue;
    const gapChords = new Set(
      chords
        .slice(previousEnd, nextStart)
        .filter((chord): chord is Chord => chord !== null)
        .map((chord) => chordKey(chord)),
    );
    if (gapChords.size > MAX_INTERLUDE_CHORDS) continue;
    spans.push({
      start: bars[previousEnd]!.start,
      end: bars[nextStart]!.start,
      kind: 'interlude',
    });
  }

  return spans;
}
