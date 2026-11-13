import { mod12 } from './notes';
import type { Chord, PitchClass, Quality } from './types';

const SUFFIX_TO_QUALITY: Record<string, Quality> = {
  '': 'major',
  maj: 'major',
  M: 'major',
  major: 'major',
  m: 'minor',
  min: 'minor',
  mi: 'minor',
  '-': 'minor',
  minor: 'minor',
  dim: 'dim',
  '°': 'dim',
  o: 'dim',
  aug: 'aug',
  '+': 'aug',
  sus: 'sus4',
  sus4: 'sus4',
  sus2: 'sus2',
  '5': 'power',
  '6': '6',
  m6: 'm6',
  min6: 'm6',
  '7': '7',
  dom7: '7',
  maj7: 'maj7',
  M7: 'maj7',
  'Δ7': 'maj7',
  m7: 'm7',
  min7: 'm7',
  '-7': 'm7',
  dim7: 'dim7',
  '°7': 'dim7',
  m7b5: 'm7b5',
  'm7-5': 'm7b5',
  'ø7': 'm7b5',
  ø: 'm7b5',
  '7sus4': '7sus4',
  '7sus': '7sus4',
  add9: 'add9',
  '9': '9',
  maj9: 'maj9',
  M9: 'maj9',
  m9: 'm9',
  min9: 'm9',
  '11': '11',
  m11: 'm11',
  '13': '13',
  m13: 'm13',
  '6/9': '6/9',
};

const QUALITY_TO_SUFFIX: Record<Quality, string> = {
  major: '',
  minor: 'm',
  dim: 'dim',
  aug: 'aug',
  sus2: 'sus2',
  sus4: 'sus4',
  power: '5',
  '6': '6',
  m6: 'm6',
  '7': '7',
  maj7: 'maj7',
  m7: 'm7',
  dim7: 'dim7',
  m7b5: 'm7b5',
  '7sus4': '7sus4',
  add9: 'add9',
  '9': '9',
  maj9: 'maj9',
  m9: 'm9',
  '11': '11',
  m11: 'm11',
  '13': '13',
  m13: 'm13',
  '6/9': '6/9',
};

const ENGLISH_ROOTS: Record<string, PitchClass> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
};

const SPANISH_ROOTS: Record<string, PitchClass> = {
  do: 0,
  re: 2,
  mi: 4,
  fa: 5,
  sol: 7,
  la: 9,
  si: 11,
};

const ROOT_PATTERN = /^(sol|do|re|mi|fa|la|si|[a-g])([#b♯♭]?)/i;
const BASS_PATTERN = /^(sol|do|re|mi|fa|la|si|[a-g])([#b♯♭]?)$/i;

function accidentalOffset(value: string | undefined): number {
  if (!value) return 0;
  if (value === '#' || value === '♯') return 1;
  if (value === 'b' || value === '♭') return -1;
  return 0;
}

function rootToPitchClass(token: string, accidental: string | undefined): PitchClass | null {
  const key = token.toLowerCase();
  const base = SPANISH_ROOTS[key] ?? ENGLISH_ROOTS[key];
  if (base === undefined) return null;
  return mod12(base + accidentalOffset(accidental));
}

function normalizeSuffix(value: string): string {
  return value
    .replace(/^:/, '')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/°/g, '°')
    .replace(/ø/g, 'ø');
}

function lookupQuality(suffix: string): Quality | null {
  if (Object.prototype.hasOwnProperty.call(SUFFIX_TO_QUALITY, suffix)) {
    return SUFFIX_TO_QUALITY[suffix] ?? null;
  }
  const lower = suffix.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(SUFFIX_TO_QUALITY, lower)) {
    return SUFFIX_TO_QUALITY[lower] ?? null;
  }
  return null;
}

export function qualitySuffix(quality: Quality): string {
  return QUALITY_TO_SUFFIX[quality];
}

function parseWithRoot(trimmed: string, match: RegExpExecArray): Chord | null {
  const root = rootToPitchClass(match[1], match[2]);
  if (root === null) return null;

  let rest = normalizeSuffix(trimmed.slice(match[0].length));
  let bass: PitchClass | undefined;

  if (!Object.prototype.hasOwnProperty.call(SUFFIX_TO_QUALITY, rest) && rest.includes('/')) {
    const slashIndex = rest.lastIndexOf('/');
    const bassToken = rest.slice(slashIndex + 1);
    const bassMatch = BASS_PATTERN.exec(bassToken);
    if (bassMatch) {
      const parsedBass = rootToPitchClass(bassMatch[1], bassMatch[2]);
      if (parsedBass !== null) {
        bass = parsedBass;
        rest = rest.slice(0, slashIndex);
      }
    }
  }

  const quality = lookupQuality(rest);
  if (quality === null) return null;

  const chord: Chord = { root, quality, raw: trimmed };
  if (bass !== undefined && bass !== root) chord.bass = bass;
  return chord;
}

/**
 * Parses a chord label in English or Spanish notation.
 * Returns `null` for silence (`N`, `-`, empty string) or for unrecognized entries.
 */
export function parseChord(label: string): Chord | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  if (/^(n|-|none|silencio)$/i.test(trimmed)) return null;

  const first = trimmed[0] ?? '';
  const candidates: RegExpExecArray[] = [];

  // Spanish candidates first (sol, do, re, mi, fa, la, si) and then the English letter.
  const spanishMatch = ROOT_PATTERN.exec(trimmed);
  if (spanishMatch) candidates.push(spanishMatch);

  const englishPattern = new RegExp(`^(${first})([#b♯♭]?)`, 'i');
  const englishMatch = englishPattern.exec(trimmed);
  if (englishMatch && !candidates.some((candidate) => candidate[0] === englishMatch[0])) {
    candidates.push(englishMatch);
  }

  for (const candidate of candidates) {
    const chord = parseWithRoot(trimmed, candidate);
    if (chord) return chord;
  }
  return null;
}


export type ParseChordInputResult =
  | { ok: true; chord: Chord | null }
  | { ok: false; error: string };

/**
 * Variant for forms: distinguishes valid silence from an invalid label.
 */
export function parseChordInput(input: string): ParseChordInputResult {
  const trimmed = input.trim();
  if (!trimmed || /^(n|-|none|silencio)$/i.test(trimmed)) {
    return { ok: true, chord: null };
  }
  const chord = parseChord(trimmed);
  if (!chord) {
    return { ok: false, error: `Acorde no reconocido: ${input}` };
  }
  return { ok: true, chord };
}

/** Parses only the root part of a label, without quality. */
export function parsePitchClass(input: string): PitchClass | null {
  const match = BASS_PATTERN.exec(input.trim());
  if (!match) return null;
  return rootToPitchClass(match[1], match[2]);
}
