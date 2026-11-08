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
const MIN_OUTRO_BARS = 2;
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
 * Etiqueta cada compás con el acorde de su primer tiempo. La etiqueta es
 * suficiente para reconocer frases armónicas repetidas; no pretende describir
 * cambios internos del compás.
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
 * Detección conservadora de tramos instrumentales a partir de la estructura
 * armónica. Solo marca una intro/outro cuando la frase principal aparece al
 * menos dos veces y un interludio cuando el hueco es largo y usa como mucho dos
 * acordes (vamp o pedal). Ante la duda, no marca nada.
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
  if (first[0] >= MIN_INTRO_BARS) {
    spans.push({ start: bars[0]!.start, end: bars[first[0]]!.start, kind: 'intro' });
  }

  const last = occurrences[occurrences.length - 1]!;
  const lastBar = bars[last[1] - 1]!;
  if (bars.length - last[1] >= MIN_OUTRO_BARS && duration > lastBar.end) {
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
