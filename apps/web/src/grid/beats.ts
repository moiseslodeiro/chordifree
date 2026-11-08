import {
  chordEquals,
  findActiveSegmentIndex,
  type Chord,
  type ChordSegment,
} from '@chordifree/chords';

export interface BeatCell {
  /** Tiempo del pulso en segundos. */
  time: number;
  /** Índice global del pulso dentro de la canción. */
  beatIndex: number;
  /** Acorde vigente al inicio del pulso. */
  chord: Chord | null;
  /** El acorde difiere del pulso anterior. */
  change: boolean;
  /** Índice del segmento vigente, o -1 si no hay ninguno. */
  segmentIndex: number;
}

export interface BeatBar {
  index: number;
  start: number;
  cells: (BeatCell | null)[];
}

export interface BeatRow {
  index: number;
  start: number;
  bars: BeatBar[];
  cells: (BeatCell | null)[];
  barStarts: number[];
}

/**
 * Mediana de los intervalos entre pulsos. Devuelve 0 si no hay al menos dos
 * pulsos utilizables.
 */
export function medianInterval(times: number[]): number {
  if (times.length < 2) return 0;
  const intervals: number[] = [];
  for (let index = 1; index < times.length; index += 1) {
    const interval = times[index]! - times[index - 1]!;
    if (interval > 0) intervals.push(interval);
  }
  if (intervals.length === 0) return 0;
  intervals.sort((a, b) => a - b);
  const middle = Math.floor(intervals.length / 2);
  return intervals.length % 2 === 0
    ? (intervals[middle - 1]! + intervals[middle]!) / 2
    : intervals[middle]!;
}

/**
 * Sanea los pulsos y construye una rejilla de tempo constante anclada en el
 * primer pulso detectado. El analizador puede devolver pulsos con pequeñas
 * variaciones (jitter) o saltarse alguno; al reconstruir la rejilla con el
 * intervalo mediano las celdas vuelven a caer sobre el pulso real de la
 * canción y la reproducción no se va desalineando.
 *
 * Cuando no hay duración disponible se devuelve la lista saneada tal cual,
 * porque no se puede saber hasta dónde prolongar.
 *
 * Es idempotente: si los pulsos ya forman una rejilla regular, devuelve la
 * misma lista.
 */
export function extendBeats(beats: number[], duration?: number): number[] {
  const values = beats.filter((beat) => Number.isFinite(beat) && beat >= 0).sort((a, b) => a - b);
  const times = values.filter((value, index) => index === 0 || value > values[index - 1]!);
  if (times.length === 0 || duration === undefined || !Number.isFinite(duration)) {
    return times;
  }

  const interval = medianInterval(times);
  if (!(interval > 0)) return times;

  const start = times[0]!;
  const end = Math.max(duration, times.at(-1)!);
  const grid: number[] = [];
  for (let index = 0; ; index += 1) {
    const time = start + index * interval;
    if (time > end + 1e-9) break;
    if (time >= duration && index > 0) break;
    if (grid.length >= 200_000) break;
    grid.push(Number(time.toFixed(6)));
  }
  return grid;
}

/**
 * Tempo estimado en pulsos por minuto a partir de la mediana de los intervalos
 * entre pulsos. Devuelve `null` si no hay datos suficientes.
 */
export function tempoFromBeats(beats: number[]): number | null {
  const times = beats
    .filter((beat) => Number.isFinite(beat) && beat >= 0)
    .sort((a, b) => a - b)
    .filter((beat, index, values) => index === 0 || beat > values[index - 1]!);
  const interval = medianInterval(times);
  if (!(interval > 0)) return null;
  return Math.round(60 / interval);
}

/**
 * Agrupa los pulsos en compases de `beatsPerBar` tiempos y resuelve el acorde
 * vigente de cada celda. Las celdas que faltan en el último compás son `null`.
 */
export function buildBeatGrid(
  segments: ChordSegment[],
  beats: number[],
  beatsPerBar = 4,
  duration?: number,
): BeatBar[] {
  const size = Number.isFinite(beatsPerBar) && beatsPerBar > 0 ? Math.floor(beatsPerBar) : 4;
  const times = extendBeats(beats, duration);
  if (times.length === 0) return [];

  // Los segmentos empiezan en el pulso detectado original; la rejilla se
  // reconstruye con el tempo mediano, así que se admite una pequeña tolerancia
  // para que un cambio de acorde no se muestre un pulso tarde por unos pocos
  // milisegundos de diferencia.
  const interval = medianInterval(times);
  const tolerance = interval > 0 ? interval * 0.2 : 0;

  const bars: BeatBar[] = [];
  let previousChord: Chord | null = null;
  let hasPrevious = false;

  for (let start = 0; start < times.length; start += size) {
    const barTimes = times.slice(start, start + size);
    const cells: (BeatCell | null)[] = barTimes.map((time, offset) => {
      const beatIndex = start + offset;
      const segmentIndex = findActiveSegmentIndex(segments, time + tolerance);
      const chord = segmentIndex >= 0 ? (segments[segmentIndex]?.chord ?? null) : null;
      const change = !hasPrevious || !chordEquals(previousChord, chord);
      previousChord = chord;
      hasPrevious = true;
      return { time, beatIndex, chord, change, segmentIndex };
    });

    while (cells.length < size) cells.push(null);
    bars.push({ index: bars.length, start: barTimes[0]!, cells });
  }

  return bars;
}

/**
 * Agrupa los compases en filas de dos compases (ocho pulsos en 4/4) para la
 * presentación. La última fila se rellena con celdas `null` hasta completar
 * todas las posiciones.
 */
export function buildBeatRows(
  segments: ChordSegment[],
  beats: number[],
  beatsPerBar = 4,
  barsPerRow = 2,
  duration?: number,
): BeatRow[] {
  const bars = buildBeatGrid(segments, beats, beatsPerBar, duration);
  if (bars.length === 0) return [];

  const barSize = bars[0]?.cells.length ?? 4;
  const chunkSize = Math.max(1, Math.floor(barsPerRow));
  const rowSize = barSize * chunkSize;
  const rows: BeatRow[] = [];

  for (let start = 0; start < bars.length; start += chunkSize) {
    const rowBars = bars.slice(start, start + chunkSize);
    const cells = rowBars.flatMap((bar) => bar.cells);
    while (cells.length < rowSize) cells.push(null);
    rows.push({
      index: rows.length,
      start: rowBars[0]!.start,
      bars: rowBars,
      cells,
      barStarts: rowBars.map((bar) => bar.start),
    });
  }

  return rows;
}
