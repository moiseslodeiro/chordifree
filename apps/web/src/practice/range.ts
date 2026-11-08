/**
 * Rango temporal del compás que contiene `time`. Si hay pulsos detectados, los
 * extremos se ajustan al compás real; si no, se usa una ventana de cuatro
 * segundos para que la práctica siga siendo utilizable.
 */
export interface BarRange {
  start: number;
  end: number;
}

export function barRangeAt(
  time: number,
  beats: number[],
  beatsPerBar = 4,
  duration?: number,
): BarRange {
  const size = Math.max(1, Math.floor(beatsPerBar) || 4);
  const safeTime = Number.isFinite(time) && time > 0 ? time : 0;

  if (beats.length === 0) {
    const start = Math.max(0, Math.floor(safeTime));
    const fallback = 4;
    const limit =
      duration !== undefined && Number.isFinite(duration) ? duration : start + fallback;
    const end = Math.min(start + fallback, limit);
    return { start, end: end > start ? end : start + fallback };
  }

  let low = 0;
  let high = beats.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const beat = beats[mid];
    if (beat === undefined) break;
    if (beat <= safeTime) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const bar = Math.max(0, Math.floor(found / size));
  const start = beats[bar * size] ?? beats[0] ?? safeTime;
  let end = beats[(bar + 1) * size];

  if (end === undefined) {
    const interval = beats[1] !== undefined ? beats[1] - beats[0]! : 1;
    end = start + Math.max(interval, 0.1) * size;
    if (duration !== undefined && Number.isFinite(duration)) {
      end = Math.min(end, duration);
    }
  }

  if (!(end > start)) end = start + 1;
  return { start, end };
}

/** Índice del primer pulso igual o posterior a `time`, o -1 si no existe. */
export function firstBeatAtOrAfter(beats: number[], time: number): number {
  let low = 0;
  let high = beats.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (beats[mid]! < time) low = mid + 1;
    else high = mid;
  }
  return low < beats.length ? low : -1;
}
