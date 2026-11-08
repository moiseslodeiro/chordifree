import { noteName } from './notes';
import { qualitySuffix } from './parse';
import type { Accidental, Chord, Notation } from './types';

export function formatChord(
  chord: Chord,
  notation: Notation = 'english',
  accidental: Accidental = 'sharp',
): string {
  const base = `${noteName(chord.root, notation, accidental)}${qualitySuffix(chord.quality)}`;
  if (chord.bass === undefined) return base;
  return `${base}/${noteName(chord.bass, notation, accidental)}`;
}

export function formatChordOrSilence(
  chord: Chord | null,
  notation: Notation = 'english',
  accidental: Accidental = 'sharp',
): string {
  return chord ? formatChord(chord, notation, accidental) : '—';
}

export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const total = Math.floor(safe);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function formatTimeWithMs(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(1).padStart(4, '0')}`;
}
