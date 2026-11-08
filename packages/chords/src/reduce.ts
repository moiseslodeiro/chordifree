import { chordEquals } from './segments';
import { simplifyChord } from './simplify';
import type { Chord, ChordSegment, PitchClass, Quality } from './types';

const FALLBACK_BEAT_SECONDS = 1.5;
const EPSILON = 1e-6;

/**
 * Fuerza de la reducción: `normal` absorbe los acordes de paso y `max` deja
 * como mucho un acorde por compás, conservando el que más suena en cada uno.
 */
export type ReduceLevel = 'normal' | 'max';

/** Compás de referencia del modo máximo (4/4). */
const MAX_BAR_BEATS = 4;

/** Ventana mínima del modo máximo para evitar compases absurdos. */
const MIN_BAR_SECONDS = 0.5;

/**
 * Un acorde que dura al menos esta cantidad de pulsos se considera estructural
 * aunque no vuelva a aparecer en la canción.
 */
const MIN_KEEP_BEATS = 1.5;

/**
 * Una familia (mayor, menor, disminuida…) necesita sonar al menos esta cantidad
 * de pulsos a lo largo de la canción para que sus apariciones breves no se
 * descarten como acordes de paso.
 */
const MIN_ROOT_BEATS = 1.5;

/** Proporción mínima de la fundamental que debe cubrir la familia del acorde. */
const MIN_FAMILY_SHARE = 0.5;

type QualityFamily = 'major' | 'minor' | 'dim' | 'aug' | 'power';

function qualityFamily(quality: Quality): QualityFamily {
  switch (quality) {
    case 'minor':
    case 'm6':
    case 'm7':
    case 'm9':
    case 'm11':
    case 'm13':
      return 'minor';
    case 'dim':
    case 'dim7':
    case 'm7b5':
      return 'dim';
    case 'aug':
      return 'aug';
    case 'power':
      return 'power';
    default:
      return 'major';
  }
}

interface HarmonyProfile {
  /** Duración total, en segundos, de cada fundamental. */
  rootTotals: Map<PitchClass, number>;
  /** Duración total de cada familia de calidad dentro de cada fundamental. */
  familyTotals: Map<PitchClass, Map<QualityFamily, number>>;
}

function sanitizeBeats(beats: number[]): number[] {
  const values = beats.filter((beat) => Number.isFinite(beat) && beat >= 0).sort((a, b) => a - b);
  return values.filter((value, index) => index === 0 || value > values[index - 1]!);
}

/**
 * Duración de un pulso: mediana de los intervalos detectados. Sin pulsos
 * utilizables se usa un valor conservador de 1,5 s.
 */
export function beatDuration(beats: number[]): number {
  const times = sanitizeBeats(beats);
  if (times.length < 2) return FALLBACK_BEAT_SECONDS;

  const intervals: number[] = [];
  for (let index = 1; index < times.length; index += 1) {
    const interval = times[index]! - times[index - 1]!;
    if (interval > EPSILON) intervals.push(interval);
  }
  if (intervals.length === 0) return FALLBACK_BEAT_SECONDS;

  intervals.sort((a, b) => a - b);
  const middle = Math.floor(intervals.length / 2);
  const median =
    intervals.length % 2 === 0
      ? (intervals[middle - 1]! + intervals[middle]!) / 2
      : intervals[middle]!;
  return median > EPSILON ? median : FALLBACK_BEAT_SECONDS;
}

function mergeAdjacent(segments: ChordSegment[]): ChordSegment[] {
  const merged: ChordSegment[] = [];
  for (const segment of segments) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      segment.start <= previous.end + EPSILON &&
      chordEquals(previous.chord, segment.chord)
    ) {
      previous.end = Math.max(previous.end, segment.end);
      continue;
    }
    merged.push({ ...segment });
  }
  return merged;
}

function simplifiedCopy(segments: ChordSegment[]): ChordSegment[] {
  return segments
    .filter(
      (segment) =>
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.end - segment.start > EPSILON,
    )
    .map((segment) => ({
      ...segment,
      chord: segment.chord ? simplifyChord(segment.chord) : null,
    }))
    .sort((a, b) => a.start - b.start);
}

function duration(segment: ChordSegment): number {
  return segment.end - segment.start;
}

/**
 * Perfil armónico de la canción: cuánto suena cada fundamental y qué familias
 * de calidad dominan en ella. Sirve para distinguir los acordes que sostienen
 * la armonía de los que solo pasan brevemente por un color ajeno.
 */
function buildProfile(segments: ChordSegment[]): HarmonyProfile {
  const rootTotals = new Map<PitchClass, number>();
  const familyTotals = new Map<PitchClass, Map<QualityFamily, number>>();

  for (const segment of segments) {
    const chord = segment.chord;
    if (!chord) continue;
    const size = duration(segment);
    rootTotals.set(chord.root, (rootTotals.get(chord.root) ?? 0) + size);

    const families = familyTotals.get(chord.root) ?? new Map<QualityFamily, number>();
    const family = qualityFamily(chord.quality);
    families.set(family, (families.get(family) ?? 0) + size);
    familyTotals.set(chord.root, families);
  }

  return { rootTotals, familyTotals };
}

function rootDuration(root: PitchClass, profile: HarmonyProfile): number {
  return profile.rootTotals.get(root) ?? 0;
}

/**
 * Un acorde es estructural si dura al menos pulsación y media, si su
 * fundamental y su familia de calidad forman parte de la armonía recurrente de
 * la canción, o si no está rodeado por acordes más largos. Solo los cambios
 * breves entre acordes estables se consideran de paso; así las progresiones con
 * cambios en cada pulsación se conservan.
 */
function isStructural(
  segment: ChordSegment,
  segments: ChordSegment[],
  index: number,
  profile: HarmonyProfile,
  beat: number,
): boolean {
  const chord = segment.chord;
  if (!chord) return false;
  const size = duration(segment);
  if (size >= MIN_KEEP_BEATS * beat - EPSILON) return true;

  const rootTotal = rootDuration(chord.root, profile);
  if (rootTotal >= MIN_ROOT_BEATS * beat - EPSILON) {
    const familyTotal =
      profile.familyTotals.get(chord.root)?.get(qualityFamily(chord.quality)) ?? 0;
    if (familyTotal / rootTotal >= MIN_FAMILY_SHARE - EPSILON) return true;
  }

  if (size < 0.5 * beat - EPSILON) return false;
  if (size <= beat + EPSILON) {
    const previous = segments[index - 1];
    const next = segments[index + 1];
    const previousChord = previous?.chord ? previous : undefined;
    const nextChord = next?.chord ? next : undefined;
    const betweenLonger =
      previousChord !== undefined &&
      nextChord !== undefined &&
      duration(previousChord) > beat + EPSILON &&
      duration(nextChord) > beat + EPSILON;
    const sameBothSides =
      previousChord !== undefined &&
      nextChord !== undefined &&
      previousChord.chord !== null &&
      nextChord.chord !== null &&
      chordEquals(previousChord.chord, chord) &&
      chordEquals(nextChord.chord, chord);
    if (betweenLonger || sameBothSides) return false;
  }

  return true;
}

/** Duración más peso armónico global de la fundamental, para desempatar. */
function importance(segment: ChordSegment, profile: HarmonyProfile): number {
  if (!segment.chord) return duration(segment);
  return duration(segment) + rootDuration(segment.chord.root, profile);
}

/** Acorde con más presencia dentro de una ventana (un compás). */
function dominantChord(slots: ChordSegment[]): Chord | null {
  const totals: Array<{ chord: Chord; total: number }> = [];
  for (const slot of slots) {
    if (!slot.chord) continue;
    const found = totals.find((entry) => chordEquals(entry.chord, slot.chord));
    if (found) found.total += duration(slot);
    else totals.push({ chord: slot.chord, total: duration(slot) });
  }
  // `sort` es estable: en caso de empate gana el acorde que aparece antes.
  totals.sort((a, b) => b.total - a.total);
  return totals[0]?.chord ?? null;
}

/**
 * Modo máximo: divide la línea en compases de cuatro pulsos (anclados en el
 * primer pulso detectado) y deja un único acorde por compás, el que más suena
 * dentro de él. Los silencios se respetan y los compases consecutivos con el
 * mismo acorde se fusionan al final.
 */
function collapseToBars(segments: ChordSegment[], beats: number[]): ChordSegment[] {
  if (segments.length === 0) return [];

  const times = sanitizeBeats(beats);
  const anchor = times[0] ?? segments[0]!.start;
  const window = Math.max(beatDuration(beats) * MAX_BAR_BEATS, MIN_BAR_SECONDS);
  const first = segments[0]!.start;
  const last = segments[segments.length - 1]!.end;

  // Fronteras de segmento y de compás; así cada tramo pertenece a un solo
  // acorde y a un solo compás.
  const boundaries = new Set<number>();
  for (const segment of segments) {
    boundaries.add(segment.start);
    boundaries.add(segment.end);
  }
  const firstIndex = Math.floor((first - anchor) / window) - 1;
  const lastIndex = Math.ceil((last - anchor) / window) + 1;
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const time = anchor + index * window;
    if (time > first - EPSILON && time < last + EPSILON) {
      boundaries.add(Number(time.toFixed(6)));
    }
  }

  const sorted = [...boundaries].sort((a, b) => a - b);
  const slots: ChordSegment[] = [];
  let cursor = 0;
  for (let index = 0; index + 1 < sorted.length; index += 1) {
    const start = sorted[index]!;
    const end = sorted[index + 1]!;
    if (end - start <= EPSILON) continue;
    while (cursor < segments.length - 1 && segments[cursor]!.end <= start + EPSILON) {
      cursor += 1;
    }
    const source = segments[cursor];
    const covers =
      source !== undefined && source.start <= start + EPSILON && source.end >= end - EPSILON;
    slots.push({ start, end, chord: covers ? source.chord : null });
  }

  const windowKey = (time: number): number => {
    const raw = (time - anchor) / window;
    const nearest = Math.round(raw);
    return Math.abs(raw - nearest) < 1e-6 ? nearest : Math.floor(raw);
  };

  const windows = new Map<number, ChordSegment[]>();
  for (const slot of slots) {
    const key = windowKey(slot.start);
    const list = windows.get(key);
    if (list) list.push(slot);
    else windows.set(key, [slot]);
  }

  const dominant = new Map<number, Chord | null>();
  for (const [key, list] of windows) dominant.set(key, dominantChord(list));

  const collapsed = slots.map((slot) => ({
    ...slot,
    chord: slot.chord === null ? null : (dominant.get(windowKey(slot.start)) ?? slot.chord),
  }));

  return mergeAdjacent(collapsed);
}

/**
 * Reduce la línea de tiempo a sus acordes importantes para la presentación:
 * simplifica la calidad, fusiona acordes consecutivos iguales y absorbe los
 * acordes de paso. Un acorde de paso es un cambio breve que no pertenece a la
 * armonía recurrente de la canción (o que usa una calidad minoritaria dentro de
 * una misma fundamental, como un `E♭` mayor suelto en una canción en `E♭m`).
 * Las progresiones reales se conservan porque sus acordes, aunque breves,
 * vuelven a aparecer y dominan el perfil armónico de la pieza.
 *
 * No muta la entrada. Los silencios se conservan y, si hubiera que descartar
 * todos los acordes, se mantiene el de mayor duración.
 *
 * Con `level: 'max'` se añade una pasada que deja como mucho un acorde por
 * compás, útil para cifrados muy simplificados.
 */
export function reduceChordSegments(
  segments: ChordSegment[],
  beats: number[] = [],
  level: ReduceLevel = 'normal',
): ChordSegment[] {
  if (segments.length === 0) return [];

  const simplified = simplifiedCopy(segments);
  if (simplified.length === 0) return [];

  const beat = beatDuration(beats);
  const working = mergeAdjacent(simplified);
  const profile = buildProfile(working);
  const structural = working.map((segment, index) =>
    isStructural(segment, working, index, profile, beat),
  );

  if (!structural.some(Boolean)) {
    const longest = [...working]
      .filter((segment) => segment.chord !== null)
      .sort((a, b) => duration(b) - duration(a))[0];
    return longest ? [{ ...longest }] : working;
  }

  const reduced: ChordSegment[] = [];

  for (let index = 0; index < working.length; index += 1) {
    const segment = working[index]!;
    if (segment.chord === null || structural[index]) {
      reduced.push({ ...segment });
      continue;
    }

    // Absorbe de golpe toda la racha de acordes de paso contiguos.
    let last = index;
    while (last + 1 < working.length) {
      const candidate = working[last + 1]!;
      if (candidate.chord === null || structural[last + 1]) break;
      last += 1;
    }

    const previous = reduced[reduced.length - 1];
    const next = working[last + 1];
    const previousChord = previous && previous.chord !== null ? previous : undefined;
    const nextChord = next && next.chord !== null ? next : undefined;

    if (previousChord && nextChord) {
      if (importance(previousChord, profile) >= importance(nextChord, profile)) {
        previousChord.end = working[last]!.end;
      } else {
        nextChord.start = segment.start;
      }
    } else if (previousChord) {
      previousChord.end = working[last]!.end;
    } else if (nextChord) {
      nextChord.start = segment.start;
    } else {
      // Racha aislada entre silencios o extremos: no hay armonía estable a la
      // que absorberla, así que se conserva tal cual.
      for (let cursor = index; cursor <= last; cursor += 1) {
        reduced.push({ ...working[cursor]! });
      }
    }

    index = last;
  }

  const result = mergeAdjacent(reduced);
  if (!result.some((segment) => segment.chord !== null)) {
    const longest = [...simplified]
      .filter((segment) => segment.chord !== null)
      .sort((a, b) => duration(b) - duration(a))[0];
    return longest ? [longest] : [];
  }
  return level === 'max' ? collapseToBars(result, beats) : result;
}
