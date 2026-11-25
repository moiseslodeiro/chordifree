import type { Chord, ChordSegment } from '@chordifree/chords';
import type { Song, SongSection } from '../types';

/** Semantic labels the detector can assign. Custom text is also allowed. */
export const SECTION_LABELS = [
  'intro',
  'verse',
  'chorus',
  'bridge',
  'instrumental',
  'outro',
] as const;

export type SectionLabel = (typeof SECTION_LABELS)[number];

/** A sung block: one or more vocal regions close enough to be one section. */
interface Block {
  start: number;
  end: number;
  chords: string[];
}

const MIN_SECTION_SECONDS = 8;
const MIN_INSTRUMENTAL_BARS = 4;
const CHORUS_MIN_REPEATS = 2;

function chordLabel(chord: Chord | null): string {
  if (!chord) return '—';
  return `${chord.root}${chord.quality}${chord.bass ?? ''}`;
}

function chordLabelsInRange(segments: ChordSegment[], start: number, end: number): string[] {
  return segments
    .filter((segment) => segment.end > start + 0.05 && segment.start < end - 0.05)
    .map((segment) => chordLabel(segment.chord));
}

function normalizeSequence(labels: string[]): string {
  return labels.join('|');
}

/** Same harmonic content in a different transposition is still the same section. */
function sequenceEquivalent(a: string, b: string): boolean {
  const left = a.split('|').filter((label) => label !== '—');
  const right = b.split('|').filter((label) => label !== '—');
  if (left.length !== right.length || left.length === 0) return false;
  const offset = (left[0]!.charCodeAt(0) - right[0]!.charCodeAt(0) + 12) % 12;
  return left.every((label, index) => {
    const other = right[index]!;
    const shifted = String.fromCharCode(((other.charCodeAt(0) - offset + 12) % 12) + 65);
    return label === `${shifted}${other.slice(1)}`;
  });
}

function mergeVocalBlocks(regions: Array<{ start: number; end: number }>): Block[] {
  const sorted = [...regions]
    .filter((region) => region.end > region.start)
    .sort((a, b) => a.start - b.start);
  const blocks: Block[] = [];
  for (const region of sorted) {
    const previous = blocks[blocks.length - 1];
    if (previous && region.start - previous.end < 2) {
      previous.end = Math.max(previous.end, region.end);
      continue;
    }
    blocks.push({ start: region.start, end: region.end, chords: [] });
  }
  return blocks;
}

function isSameSectionType(block: Block, candidate: Block): boolean {
  const a = normalizeSequence(block.chords);
  const b = normalizeSequence(candidate.chords);
  if (a === b) return true;
  if (Math.abs(block.chords.length - candidate.chords.length) > 2) return false;
  return sequenceEquivalent(a, b);
}

/** Index of the most repeated vocal block, excluding the first one. */
function chorusBlockIndex(blocks: Block[]): number {
  for (let candidate = 1; candidate < blocks.length; candidate += 1) {
    const target = blocks[candidate]!;
    let repeats = 1;
    for (let other = 0; other < blocks.length; other += 1) {
      if (other === candidate) continue;
      if (isSameSectionType(target, blocks[other]!)) repeats += 1;
    }
    if (repeats >= CHORUS_MIN_REPEATS) return candidate;
  }
  return -1;
}

function snapDownToBar(time: number, beats: number[], beatsPerBar: number): number {
  if (beats.length === 0) return Math.max(0, time - 0.05);
  const bar = beatsPerBar > 0 ? beatsPerBar : 4;
  const downbeats = beats.filter((_, index) => index % bar === 0);
  for (let index = downbeats.length - 1; index >= 0; index -= 1) {
    if (downbeats[index]! <= time + 0.05) return downbeats[index]!;
  }
  return 0;
}

function snapUpToBar(time: number, beats: number[], beatsPerBar: number): number {
  if (beats.length === 0) return Math.max(0, time - 0.05);
  const bar = beatsPerBar > 0 ? beatsPerBar : 4;
  const downbeats = beats.filter((_, index) => index % bar === 0);
  for (const downbeat of downbeats) {
    if (downbeat >= time - 0.05) return downbeat;
  }
  return Math.max(0, time - 0.05);
}

/** Earliest downbeat at or after a time: the section covers the last sung bar. */
function snapEndToBar(time: number, beats: number[], beatsPerBar: number): number {
  return Math.max(snapUpToBar(time, beats, beatsPerBar), time);
}

function buildBlocks(
  segments: ChordSegment[],
  vocalRegions: Array<{ start: number; end: number }>,
): Block[] {
  return mergeVocalBlocks(vocalRegions).map((block) => ({
    ...block,
    chords: chordLabelsInRange(segments, block.start, block.end),
  }));
}

function barSecondsOf(beats: number[], beatsPerBar: number): number {
  if (beats.length <= beatsPerBar) return 0;
  return ((beats[beats.length - 1]! - beats[0]!) / (beats.length - 1)) * beatsPerBar;
}

function longEnough(
  length: number,
  barSeconds: number,
  minSeconds: number,
  minBars: number,
): boolean {
  return length >= minSeconds || (barSeconds > 0 && length >= barSeconds * minBars);
}

function chorusIndexSet(blocks: Block[]): Set<number> {
  const indices = new Set<number>();
  const chorus = chorusBlockIndex(blocks);
  if (chorus < 0) return indices;
  for (let index = 0; index < blocks.length; index += 1) {
    if (isSameSectionType(blocks[chorus]!, blocks[index]!)) indices.add(index);
  }
  return indices;
}

function snappedRange(
  block: Block,
  beats: number[],
  beatsPerBar: number,
): { start: number; end: number } {
  return {
    start: snapDownToBar(block.start, beats, beatsPerBar),
    end: snapEndToBar(block.end, beats, beatsPerBar),
  };
}

function appendBlockSections(
  sections: SongSection[],
  blocks: Block[],
  index: number,
  chorusIndices: Set<number>,
  beats: number[],
  beatsPerBar: number,
  duration: number,
  barSeconds: number,
): void {
  const block = blocks[index]!;
  const range = snappedRange(block, beats, beatsPerBar);
  if (range.end - range.start < 1) return;
  sections.push({
    label: chorusIndices.has(index) ? 'chorus' : 'verse',
    start: Math.max(0, range.start),
    end: Math.min(duration, range.end),
  });

  const next = blocks[index + 1];
  if (!next) return;
  const gapStart = range.end;
  const gapEnd = snapDownToBar(next.start, beats, beatsPerBar);
  const gapLength = gapEnd - gapStart;
  if (
    gapEnd > gapStart &&
    longEnough(gapLength, barSeconds, MIN_SECTION_SECONDS, MIN_INSTRUMENTAL_BARS)
  ) {
    sections.push({ label: 'instrumental', start: gapStart, end: gapEnd });
  }
}

/**
 * Derives intro/verse/chorus/instrumental/outro sections from the vocal regions,
 * the detected bars and the chords. Sections snap to bar lines and are meant as
 * a starting point: the user can rename or remove them.
 */
export function detectSections(song: Song): SongSection[] {
  const duration = song.duration;
  const beats = song.beats ?? [];
  const beatsPerBar = song.beatsPerBar ?? 4;
  const vocal = song.vocalRegions ?? [];
  if (duration <= 0 || vocal.length === 0) return [];

  const blocks = buildBlocks(song.segments, vocal);
  if (blocks.length === 0) return [];

  const barSeconds = barSecondsOf(beats, beatsPerBar);
  const first = blocks[0]!;
  const last = blocks[blocks.length - 1]!;
  // A section starts on the downbeat of the bar that contains the vocals and
  // ends on the downbeat after the last sung bar, so partial bars stay inside.
  const introEnd = snapDownToBar(first.start, beats, beatsPerBar);
  const outroStart = snapEndToBar(last.end, beats, beatsPerBar);
  const chorusIndices = chorusIndexSet(blocks);

  const sections: SongSection[] = [];
  if (longEnough(introEnd, barSeconds, MIN_SECTION_SECONDS, 2)) {
    sections.push({ label: 'intro', start: 0, end: introEnd });
  }

  for (let index = 0; index < blocks.length; index += 1) {
    appendBlockSections(
      sections,
      blocks,
      index,
      chorusIndices,
      beats,
      beatsPerBar,
      duration,
      barSeconds,
    );
  }

  const outroLength = duration - outroStart;
  if (outroStart < duration && longEnough(outroLength, barSeconds, MIN_SECTION_SECONDS, 2)) {
    sections.push({ label: 'outro', start: outroStart, end: duration });
  }

  return sections.filter((section) => section.end > section.start);
}

export function activeSectionAt(sections: SongSection[], time: number): SongSection | null {
  for (const section of sections) {
    if (time >= section.start && time < section.end) return section;
  }
  return null;
}

export function nextSection(sections: SongSection[], time: number): SongSection | null {
  return sections.find((section) => section.start > time + 0.05) ?? null;
}

export function previousSection(sections: SongSection[], time: number): SongSection | null {
  const active = activeSectionAt(sections, time);
  if (active && time - active.start > 3) return active;
  const index = sections.indexOf(active ?? sections[0]!);
  for (let candidate = index - 1; candidate >= 0; candidate -= 1) {
    const section = sections[candidate];
    if (section && section.end <= time + 0.05) return section;
  }
  return active;
}
