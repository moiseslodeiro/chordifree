import {
  formatChord,
  noteName,
  type Accidental,
  type ChordSegment,
  type EstimatedKey,
  type Notation,
} from '@chordifree/chords';
import { alignLyrics, buildChordChanges } from '../lyrics/align';
import { harmonyBars } from '../lyrics/sections';

interface ChordProInput {
  title: string;
  artist?: string | null;
  key?: EstimatedKey | null;
  tempo?: number | null;
  lyrics?: string;
  segments: ChordSegment[];
  beats: number[];
  beatsPerBar: number;
  duration: number;
  notation: Notation;
  accidental: Accidental;
  vocalRegions?: Array<{ start: number; end: number }>;
}

function keyLabel(key: EstimatedKey, notation: Notation, accidental: Accidental): string {
  return `${noteName(key.tonic, notation, accidental)}${key.mode === 'minor' ? 'm' : ''}`;
}

function snapToWord(text: string, index: number): number {
  if (index <= 0) return 0;
  if (index >= text.length) return text.length;
  let before = index;
  while (before > 0 && text[before - 1] !== ' ') before -= 1;
  let after = index;
  while (after < text.length && text[after] !== ' ') after += 1;
  while (after < text.length && text[after] === ' ') after += 1;
  return index - before <= after - index ? before : after;
}

function formatLine(text: string, chords: Array<{ offset: number; label: string }>): string {
  if (chords.length === 0) return text;
  const byIndex = new Map<number, string[]>();
  for (const chord of chords) {
    const rawIndex = Math.min(
      text.length,
      Math.max(0, Math.round(chord.offset * text.length)),
    );
    const index = snapToWord(text, rawIndex);
    const list = byIndex.get(index) ?? [];
    list.push(`[${chord.label}]`);
    byIndex.set(index, list);
  }
  let result = '';
  for (let index = 0; index <= text.length; index += 1) {
    if (byIndex.has(index)) result += byIndex.get(index)!.join('');
    if (index < text.length) result += text[index];
  }
  return result;
}

/** Build a portable ChordPro document from lyrics or from the bar grid. */
export function buildChordPro(input: ChordProInput): string {
  const lines: string[] = [`{title: ${input.title}}`];
  if (input.artist) lines.push(`{artist: ${input.artist}}`);
  if (input.key) lines.push(`{key: ${keyLabel(input.key, input.notation, input.accidental)}}`);
  if (input.tempo) lines.push(`{tempo: ${Math.round(input.tempo)}}`);

  const changes = buildChordChanges(input.segments, (chord) =>
    formatChord(chord, input.notation, input.accidental),
  );

  if (input.lyrics?.trim()) {
    const aligned = alignLyrics(input.lyrics, changes, input.duration, {
      vocalRegions: input.vocalRegions ?? [],
    });
    for (const line of aligned) {
      if (!line.text.trim()) {
        lines.push('');
        continue;
      }
      lines.push(formatLine(line.text, line.chords));
    }
  } else {
    const bars = harmonyBars(
      input.segments,
      input.beats,
      input.beatsPerBar,
      input.duration,
    );
    const labels = bars.map((bar) =>
      bar.chord ? formatChord(bar.chord, input.notation, input.accidental) : 'N.C.',
    );
    for (let index = 0; index < labels.length; index += 4) {
      lines.push(`| ${labels.slice(index, index + 4).join(' | ')} |`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export function downloadChordPro(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
