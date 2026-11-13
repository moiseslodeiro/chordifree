import { chordEquals } from './segments';
import { simplifyChord } from './simplify';
import type { Chord, ChordSegment, PitchClass, Quality } from './types';

const FALLBACK_BEAT_SECONDS = 1.5;
const EPSILON = 1e-6;

/**
 * Reduction strength: `normal` absorbs passing chords and `max` leaves
 * at most one chord per bar, keeping the one that sounds the most in each.
 */
export type ReduceLevel = 'normal' | 'max';

/** Minimum window for max mode to avoid absurd bars. */
const MIN_BAR_SECONDS = 0.5;

/**
 * A chord that lasts at least this many beats is considered structural
 * even if it does not reappear in the song.
 */
const MIN_KEEP_BEATS = 1.5;

/**
 * A family (major, minor, diminished…) needs to sound for at least this many
 * beats over the song so that its brief appearances are not
 * discarded as passing chords.
 */
const MIN_ROOT_BEATS = 1.5;

/** Minimum share of the root that the chord family must cover. */
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
  /** Total duration, in seconds, of each root. */
  rootTotals: Map<PitchClass, number>;
  /** Total duration of each quality family within each root. */
  familyTotals: Map<PitchClass, Map<QualityFamily, number>>;
}

function sanitizeBeats(beats: number[]): number[] {
  const values = beats.filter((beat) => Number.isFinite(beat) && beat >= 0).sort((a, b) => a - b);
  return values.filter((value, index) => index === 0 || value > values[index - 1]!);
}

/**
 * Duration of a beat: median of the detected intervals. Without usable
 * beats a conservative value of 1.5 s is used.
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
 * Harmonic profile of the song: how much each root sounds and which quality
 * families dominate in it. It helps distinguish the chords that sustain
 * the harmony from those that only pass briefly through a foreign color.
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
 * A chord is structural if it lasts at least a beat and a half, if its
 * root and quality family are part of the recurring harmony of
 * the song, or if it is not surrounded by longer chords. Only the brief
 * changes between stable chords are considered passing; thus progressions with
 * changes on every beat are preserved.
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

/** Duration plus global harmonic weight of the root, to break ties. */
function importance(segment: ChordSegment, profile: HarmonyProfile): number {
  if (!segment.chord) return duration(segment);
  return duration(segment) + rootDuration(segment.chord.root, profile);
}

/** Chord with the most presence within a window (one bar). */
function dominantChord(slots: ChordSegment[]): Chord | null {
  const totals: Array<{ chord: Chord; total: number }> = [];
  for (const slot of slots) {
    if (!slot.chord) continue;
    const found = totals.find((entry) => chordEquals(entry.chord, slot.chord));
    if (found) found.total += duration(slot);
    else totals.push({ chord: slot.chord, total: duration(slot) });
  }
  // `sort` is stable: on a tie the chord that appears first wins.
  totals.sort((a, b) => b.total - a.total);
  return totals[0]?.chord ?? null;
}

/**
 * Max mode: splits the timeline into bars of four beats (anchored to the
 * first detected beat) and leaves a single chord per bar, the one that sounds
 * the most inside it. Silences are respected and consecutive bars with the
 * same chord are merged at the end.
 */
function collapseToBars(
  segments: ChordSegment[],
  beats: number[],
  beatsPerBar: number,
): ChordSegment[] {
  if (segments.length === 0) return [];

  const times = sanitizeBeats(beats);
  const anchor = times[0] ?? segments[0]!.start;
  const barBeats = Number.isFinite(beatsPerBar) && beatsPerBar > 0 ? Math.floor(beatsPerBar) : 4;
  const window = Math.max(beatDuration(beats) * barBeats, MIN_BAR_SECONDS);
  const first = segments[0]!.start;
  const last = segments[segments.length - 1]!.end;

  // Segment and bar boundaries; thus each stretch belongs to a single
  // chord and a single bar.
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

  const collapsed: ChordSegment[] = [];
  const keys = [...windows.keys()].sort((a, b) => a - b);
  for (const key of keys) {
    const list = windows.get(key)!;
    const windowStart = list[0]!.start;
    const windowEnd = list[list.length - 1]!.end;
    const dominant = dominantChord(list);

    if (dominant === null) {
      collapsed.push({ start: windowStart, end: windowEnd, chord: null });
      continue;
    }

    const firstDominant = list.find(
      (slot) => slot.chord !== null && chordEquals(slot.chord, dominant),
    );
    const dominantStart = firstDominant?.start ?? windowStart;

    if (dominantStart > windowStart + EPSILON) {
      const before = list.filter((slot) => slot.start < dominantStart - EPSILON);
      const lead = before[before.length - 1];
      collapsed.push({
        start: windowStart,
        end: dominantStart,
        chord: lead?.chord ?? null,
      });
    }

    collapsed.push({
      start: Math.max(windowStart, dominantStart),
      end: windowEnd,
      chord: dominant,
    });
  }

  return mergeAdjacent(collapsed);
}

/**
 * Reduces the timeline to its important chords for presentation:
 * simplifies the quality, merges consecutive equal chords and absorbs the
 * passing chords. A passing chord is a brief change that does not belong to the
 * recurring harmony of the song (or that uses a minority quality within the
 * same root, such as a lone `E♭` major in a song in `E♭m`).
 * Real progressions are preserved because their chords, although brief,
 * reappear and dominate the harmonic profile of the piece.
 *
 * Does not mutate the input. Silences are preserved and, if all chords had to
 * be discarded, the one with the longest duration is kept.
 *
 * With `level: 'max'` a pass is added that leaves at most one chord per
 * bar, keeping the dominant chord at its real time. If the dominant
 * enters halfway through the bar, the previous chord is kept until that point.
 */
export function reduceChordSegments(
  segments: ChordSegment[],
  beats: number[] = [],
  level: ReduceLevel = 'normal',
  beatsPerBar = 4,
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

    // Absorbs the whole run of contiguous passing chords at once.
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
      // Isolated run between silences or extremes: there is no stable harmony
      // to absorb it into, so it is kept as is.
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
  return level === 'max' ? collapseToBars(result, beats, beatsPerBar) : result;
}
