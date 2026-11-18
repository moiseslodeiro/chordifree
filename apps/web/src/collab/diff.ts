import type { Chord } from '@chordifree/chords';
import type { Song } from '../types';

export interface FieldChange {
  label: string;
  before: string;
  after: string;
}

export interface ChordChange {
  /** Position in the resulting timeline. */
  index: number;
  start: number;
  before: string;
  after: string;
}

export type LyricChange =
  | { type: 'added'; after: string }
  | { type: 'removed'; before: string }
  | { type: 'changed'; before: string; after: string };

export interface SongDiff {
  fields: FieldChange[];
  chords: ChordChange[];
  lyrics: LyricChange[];
  empty: boolean;
}

export type ChordFormatter = (chord: Chord | null) => string;

interface LyricPair {
  type: 'same' | 'added' | 'removed';
  value: string;
}

/** Line-level LCS so unchanged lyrics do not appear in the diff. */
export function diffLines(before: string, after: string): LyricChange[] {
  const left = before ? before.split('\n') : [];
  const right = after ? after.split('\n') : [];
  const rows = left.length;
  const cols = right.length;
  const table: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array<number>(cols + 1).fill(0),
  );
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i]![j] =
        left[i] === right[j]
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }

  const pairs: LyricPair[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (left[i] === right[j]) {
      pairs.push({ type: 'same', value: left[i]! });
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      pairs.push({ type: 'removed', value: left[i]! });
      i += 1;
    } else {
      pairs.push({ type: 'added', value: right[j]! });
      j += 1;
    }
  }
  while (i < rows) {
    pairs.push({ type: 'removed', value: left[i]! });
    i += 1;
  }
  while (j < cols) {
    pairs.push({ type: 'added', value: right[j]! });
    j += 1;
  }

  const changes: LyricChange[] = [];
  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index]!;
    if (pair.type === 'same') continue;
    const next = pairs[index + 1];
    if (pair.type === 'removed' && next?.type === 'added') {
      changes.push({ type: 'changed', before: pair.value, after: next.value });
      index += 1;
      continue;
    }
    if (pair.type === 'added') changes.push({ type: 'added', after: pair.value });
    else changes.push({ type: 'removed', before: pair.value });
  }
  return changes;
}

export function diffSongs(before: Song, after: Song, format: ChordFormatter): SongDiff {
  const fields: FieldChange[] = [];
  const compare = (label: string, left: string, right: string) => {
    if (left !== right) fields.push({ label, before: left, after: right });
  };
  compare('title', before.title, after.title);
  compare('artist', before.artist ?? '', after.artist ?? '');
  compare('capo', String(before.capo ?? 0), String(after.capo ?? 0));
  compare('beatsPerBar', String(before.beatsPerBar ?? 4), String(after.beatsPerBar ?? 4));
  compare('transpose', String(before.transpose), String(after.transpose));

  const chords: ChordChange[] = [];
  const beforeSegments = before.segments;
  const afterSegments = after.segments;
  if (beforeSegments.length === afterSegments.length) {
    afterSegments.forEach((segment, index) => {
      const previous = beforeSegments[index]!;
      const left = format(previous.chord);
      const right = format(segment.chord);
      if (left !== right) chords.push({ index, start: segment.start, before: left, after: right });
    });
  } else {
    const left = beforeSegments.map((segment) => format(segment.chord));
    const right = afterSegments.map((segment) => format(segment.chord));
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      const beforeLabel = left[index] ?? '';
      const afterLabel = right[index] ?? '';
      if (beforeLabel !== afterLabel) {
        chords.push({
          index,
          start: afterSegments[index]?.start ?? beforeSegments[index]?.start ?? 0,
          before: beforeLabel,
          after: afterLabel,
        });
      }
    }
  }

  const lyrics = diffLines(before.lyrics ?? '', after.lyrics ?? '');

  return {
    fields,
    chords,
    lyrics,
    empty: chords.length === 0 && lyrics.length === 0 && fields.length === 0,
  };
}
