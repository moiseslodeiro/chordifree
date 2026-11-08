import { chordEquals, type Chord, type ChordSegment } from '@chordifree/chords';
import type { InstrumentalSpan } from './sections';

export interface ChordChange {
  /** Segundo en el que empieza el cambio de acorde. */
  time: number;
  /** Segundo en el que termina el acorde, ya fusionado con repeticiones. */
  end: number;
  /** Índice del primer segmento que introduce este acorde. */
  segmentIndex: number;
  /** Etiqueta formateada que se muestra sobre la letra. */
  label: string;
}

export interface AlignedChord extends ChordChange {
  /** Posición horizontal aproximada dentro de la línea, entre 0 y 1. */
  offset: number;
}

export interface TimeSpan {
  start: number;
  end: number;
}

export interface LyricLine {
  /** Índice de la línea en el texto original. */
  index: number;
  text: string;
  start: number;
  end: number;
  /** Intervalos de tiempo que cubre la línea (puede haber huecos instrumentales). */
  spans: TimeSpan[];
  chords: AlignedChord[];
  /** Ancla explícita en segundos, si la línea empieza por `[mm:ss]`. */
  anchor: number | null;
}

export interface AlignOptions {
  instrumental?: InstrumentalSpan[];
}

const EPSILON = 1e-6;
const ANCHOR_PATTERN = /^\s*\[(\d{1,3}):([0-5]\d)\]\s?/;

/** Separa la letra conservando líneas vacías y normalizando saltos de línea. */
export function splitLyricLines(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n');
}

/** Extrae un ancla `[mm:ss]` del inicio de una línea. */
export function parseLyricLine(line: string): { text: string; anchor: number | null } {
  const match = ANCHOR_PATTERN.exec(line);
  if (!match) return { text: line, anchor: null };
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return { text: line.slice(match[0].length), anchor: minutes * 60 + seconds };
}

/**
 * Convierte la línea de tiempo en cambios de acorde. Los acordes consecutivos
 * iguales se fusionan y los silencios cortan la fusión, igual que en la hoja
 * imprimible.
 */
export function buildChordChanges(
  segments: ChordSegment[],
  format: (chord: Chord) => string,
): ChordChange[] {
  const changes: ChordChange[] = [];
  let previous: Chord | null = null;

  segments.forEach((segment, index) => {
    if (!segment.chord) {
      previous = null;
      return;
    }
    if (previous && chordEquals(previous, segment.chord)) {
      const last = changes[changes.length - 1];
      if (last) last.end = Math.max(last.end, segment.end);
      return;
    }
    previous = segment.chord;
    changes.push({
      time: segment.start,
      end: segment.end,
      segmentIndex: index,
      label: format(segment.chord),
    });
  });

  return changes;
}

function musicalSpan(changes: ChordChange[], duration: number): TimeSpan {
  if (changes.length === 0) {
    return { start: 0, end: Math.max(0, Number.isFinite(duration) ? duration : 0) };
  }
  const start = changes.reduce((min, change) => Math.min(min, change.time), changes[0]!.time);
  const end = changes.reduce((max, change) => Math.max(max, change.end), changes[0]!.end);
  return { start, end: end > start ? end : start + 1 };
}

/** Separación mínima estimada entre dos acordes de una misma línea. */
export function chordGap(label: string): number {
  return Math.min(0.25, 0.04 + label.length * 0.008);
}

/**
 * Ordena los acordes de una línea y reparte el espacio disponible dejando una
 * separación mínima entre etiquetas. Si hay demasiados acordes, las etiquetas
 * se compactan; la fila flexible de la vista permite además el salto de línea.
 */
function placeChords(chords: AlignedChord[]): AlignedChord[] {
  const sorted = [...chords].sort((a, b) => a.time - b.time || a.segmentIndex - b.segmentIndex);
  if (sorted.length === 0) return [];

  let gaps = sorted.map((chord) => chordGap(chord.label));
  const totalGaps = gaps.reduce((sum, gap) => sum + gap, 0);
  if (totalGaps > 0.8) {
    const scale = 0.8 / totalGaps;
    gaps = gaps.map((gap) => gap * scale);
  }
  const usable = Math.max(0, 1 - gaps.reduce((sum, gap) => sum + gap, 0));

  let previousRaw = -Infinity;
  let cumulative = 0;
  return sorted.map((chord, index) => {
    const raw = Math.min(1, Math.max(chord.offset, previousRaw + 0.001));
    previousRaw = raw;
    const offset = Math.min(1, raw * usable + cumulative);
    cumulative += gaps[index] ?? 0;
    return { ...chord, offset };
  });
}

function subtractSpans(span: TimeSpan, instrumental: InstrumentalSpan[]): TimeSpan[] {
  const gaps = instrumental
    .map((item) => ({
      start: Math.max(span.start, item.start),
      end: Math.min(span.end, item.end),
    }))
    .filter((item) => item.end > item.start + EPSILON)
    .sort((a, b) => a.start - b.start);

  const result: TimeSpan[] = [];
  let cursor = span.start;
  for (const gap of gaps) {
    if (gap.start > cursor + EPSILON) result.push({ start: cursor, end: gap.start });
    cursor = Math.max(cursor, gap.end);
  }
  if (cursor < span.end - EPSILON) result.push({ start: cursor, end: span.end });
  return result.length > 0 ? result : [{ ...span }];
}

function sliceByOffset(intervals: TimeSpan[], from: number, to: number): TimeSpan[] {
  const result: TimeSpan[] = [];
  let cursor = 0;
  for (const interval of intervals) {
    const length = interval.end - interval.start;
    const start = Math.max(0, from - cursor);
    const end = Math.min(length, to - cursor);
    if (end > start + EPSILON) {
      result.push({ start: interval.start + start, end: interval.start + end });
    }
    cursor += length;
  }
  return result;
}

function distribute(
  lines: LyricLine[],
  intervals: TimeSpan[],
  fallback: number,
): void {
  if (lines.length === 0) return;
  const total = intervals.reduce((sum, interval) => sum + interval.end - interval.start, 0);
  if (total <= EPSILON) {
    for (const line of lines) {
      line.start = fallback;
      line.end = fallback;
      line.spans = [];
    }
    return;
  }

  const step = total / lines.length;
  lines.forEach((line, index) => {
    const spans = sliceByOffset(intervals, index * step, (index + 1) * step);
    line.spans = spans;
    line.start = spans[0]?.start ?? fallback;
    line.end = spans[spans.length - 1]?.end ?? fallback;
  });
}

/**
 * Reparte las líneas sobre el tiempo disponible y coloca cada cambio de acorde
 * en la línea que lo contiene. Si hay anclas `[mm:ss]`, mandan sobre la
 * heurística; si no, se excluyen los tramos instrumentales detectados.
 */
export function alignLyrics(
  text: string,
  changes: ChordChange[],
  duration: number,
  options: AlignOptions = {},
): LyricLine[] {
  const rawLines = splitLyricLines(text);
  const lines: LyricLine[] = rawLines.map((raw, index) => {
    const parsed = parseLyricLine(raw);
    return {
      index,
      text: parsed.text,
      start: 0,
      end: 0,
      spans: [],
      chords: [],
      anchor: parsed.anchor,
    };
  });

  const nonEmpty = lines.filter((line) => line.text.trim().length > 0);
  if (nonEmpty.length === 0) return [];

  const span = musicalSpan(changes, duration);
  const anchors = lines
    .map((line) => line.anchor)
    .filter((anchor): anchor is number => anchor !== null);
  if (anchors.length > 0) {
    span.start = Math.min(span.start, ...anchors);
    span.end = Math.max(span.end, ...anchors);
  }
  const anchored = lines.some((line) => line.anchor !== null);

  if (anchored) {
    const instrumental = options.instrumental ?? [];
    let blockStart = span.start;
    let blockAnchored = false;
    let blockLines: LyricLine[] = [];
    const finalize = (end: number) => {
      if (blockLines.length === 0) return;
      const start = Math.max(span.start, Math.min(blockStart, span.end));
      const safeEnd = Math.max(start, Math.min(end, span.end));
      const ignored = blockAnchored
        ? instrumental.filter(
            (item) => item.start < start - EPSILON && item.end > start + EPSILON,
          )
        : [];
      const usable = subtractSpans(
        { start, end: safeEnd },
        instrumental.filter((item) => !ignored.includes(item)),
      );
      distribute(blockLines, usable, start);
    };

    for (const line of lines) {
      if (line.anchor !== null) {
        const anchor = Math.max(span.start, Math.min(line.anchor, span.end));
        finalize(anchor);
        blockStart = anchor;
        blockAnchored = true;
        blockLines = line.text.trim().length > 0 ? [line] : [];
      } else if (line.text.trim().length > 0) {
        blockLines.push(line);
      }
    }
    finalize(span.end);
  } else {
    distribute(nonEmpty, subtractSpans(span, options.instrumental ?? []), span.start);
  }

  const ordered = [...changes].sort((a, b) => a.time - b.time || a.segmentIndex - b.segmentIndex);
  for (const change of ordered) {
    const line = nonEmpty.find((candidate) =>
      candidate.spans.some(
        (span) => change.time < span.end - EPSILON && change.end > span.start + EPSILON,
      ),
    );
    if (!line) continue;
    const chordSpan = line.spans.find(
      (span) => change.time < span.end - EPSILON && change.end > span.start + EPSILON,
    );
    const time = Math.max(change.time, chordSpan?.start ?? change.time);
    const offset =
      chordSpan && chordSpan.end > chordSpan.start
        ? Math.max(0, Math.min(1, (time - chordSpan.start) / (chordSpan.end - chordSpan.start)))
        : 0;
    line.chords.push({ ...change, time, offset });
  }

  for (const line of lines) {
    if (line.chords.length > 0) line.chords = placeChords(line.chords);
  }
  return lines;
}
