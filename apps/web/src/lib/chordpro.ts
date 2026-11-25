import {
  formatChord,
  noteName,
  parseChord,
  type Accidental,
  type ChordSegment,
  type EstimatedKey,
  type Notation,
} from '@chordifree/chords';
import { alignLyrics, buildChordChanges } from '../lyrics/align';
import { harmonyBars } from '../lyrics/sections';
import type { Preferences, Song } from '../types';

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
    const rawIndex = Math.min(text.length, Math.max(0, Math.round(chord.offset * text.length)));
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
    const bars = harmonyBars(input.segments, input.beats, input.beatsPerBar, input.duration);
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

const DIRECTIVE = /^\{\s*([a-zA-Z_]+)\s*(?::\s*(.*?))?\s*\}$/;
const INLINE_CHORD = /\[([^\]]+)\]/g;

export class ChordProError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChordProError';
  }
}

function isChordLine(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed || !/\|/.test(trimmed)) return [];
  const tokens = trimmed
    .split('|')
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return [];
  if (!tokens.every((token) => parseChord(token) !== null)) return [];
  return tokens;
}

function isChordOnlyLine(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed || /[a-z]/.test(trimmed)) return [];
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  if (!tokens.every((token) => parseChord(token) !== null)) return [];
  return tokens;
}

interface ParsedSheet {
  title: string;
  artist: string;
  tempo: number;
  capo: number;
  lyricLines: string[];
  chords: string[];
}

function applyDirective(sheet: ParsedSheet, match: RegExpExecArray): void {
  const [, rawName = '', rawValue = ''] = match;
  const name = rawName.toLowerCase();
  if (name === 'title' || name === 't') {
    sheet.title = rawValue.trim();
  } else if (name === 'artist') {
    sheet.artist = rawValue.trim();
  } else if (name === 'tempo') {
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      sheet.tempo = Math.min(300, Math.max(30, parsed));
    }
  } else if (name === 'capo') {
    const parsed = Number(rawValue);
    if (Number.isInteger(parsed) && parsed > 0) sheet.capo = parsed;
  }
}

function readContentLine(sheet: ParsedSheet, line: string): void {
  const barChords = isChordLine(line);
  if (barChords.length > 0) {
    sheet.chords.push(...barChords);
    sheet.lyricLines.push('');
    return;
  }

  const inline: string[] = [];
  const plain = line.replace(INLINE_CHORD, (_match, chord: string) => {
    inline.push(chord.trim());
    return '';
  });
  if (inline.length > 0) {
    sheet.chords.push(...inline);
    sheet.lyricLines.push(plain.trim());
    return;
  }

  const chordOnly = isChordOnlyLine(line);
  if (chordOnly.length > 0) {
    sheet.chords.push(...chordOnly);
    sheet.lyricLines.push('');
    return;
  }

  sheet.lyricLines.push(plain);
}

function readSheet(text: string): ParsedSheet {
  const sheet: ParsedSheet = {
    title: '',
    artist: '',
    tempo: 120,
    capo: 0,
    lyricLines: [],
    chords: [],
  };

  for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trimEnd();
    const directive = DIRECTIVE.exec(line.trim());
    if (directive) {
      applyDirective(sheet, directive);
      continue;
    }
    if (line.trim().startsWith('#')) continue;
    readContentLine(sheet, line);
  }

  while (sheet.lyricLines.length > 0 && !sheet.lyricLines[0]?.trim()) sheet.lyricLines.shift();
  while (sheet.lyricLines.length > 0 && !sheet.lyricLines[sheet.lyricLines.length - 1]?.trim()) {
    sheet.lyricLines.pop();
  }
  return sheet;
}

function segmentsFromChords(chords: string[], barSeconds: number): ChordSegment[] {
  return chords.map((label, index) => ({
    start: Math.round(index * barSeconds * 1000) / 1000,
    end: Math.round((index + 1) * barSeconds * 1000) / 1000,
    chord: parseChord(label),
  }));
}

function beatsUntil(duration: number, beatSeconds: number): number[] {
  const beats: number[] = [];
  for (let time = 0; time < duration; time += beatSeconds) {
    beats.push(Math.round(time * 1000) / 1000);
  }
  return beats;
}

/**
 * Imports a ChordPro file as a timed song. ChordPro has no audio timing, so
 * every chord gets one bar at the declared tempo. The user can then edit the
 * chords, lyrics and timing with the normal tools.
 */
export function parseChordPro(
  text: string,
  filename: string,
  preferences: Preferences,
  now: Date = new Date(),
): Song {
  const sheet = readSheet(text);
  const cleanedTitle =
    sheet.title.trim() || filename.replace(/\.(cho|pro|crd|txt)$/i, '') || 'Imported song';
  const lyrics = sheet.lyricLines.join('\n');
  if (!lyrics.trim() && sheet.chords.length === 0) {
    throw new ChordProError('The file does not contain chords or lyrics');
  }

  const beatSeconds = 60 / sheet.tempo;
  const barSeconds = beatSeconds * 4;
  const segments =
    sheet.chords.length > 0
      ? segmentsFromChords(sheet.chords, barSeconds)
      : [{ start: 0, end: barSeconds * 2, chord: null }];

  const duration = Math.max(4, segments[segments.length - 1]?.end ?? 4);
  const timestamp = now.toISOString();
  const song: Song = {
    id: crypto.randomUUID(),
    title: cleanedTitle,
    source: { type: 'sheet', filename },
    duration,
    segments,
    detectedSegments: segments,
    beats: beatsUntil(duration, beatSeconds),
    beatsPerBar: 4,
    vocalRegions: [],
    analyzerVersion: 'chordpro-import',
    transpose: preferences.transpose,
    notation: preferences.notation,
    accidentalPreference: preferences.accidentalPreference,
    createdAt: timestamp,
    updatedAt: timestamp,
    lyrics,
  };
  if (sheet.artist) song.artist = sheet.artist;
  if (sheet.capo > 0) song.capo = sheet.capo;
  return song;
}
