import type { GridView, Instrument, Language, Preferences, Theme } from '../types';
import { readEnvelope, writeEnvelope } from './envelope';
import { KEYS, type StorageLike } from './keys';

export const DEFAULT_PREFERENCES: Preferences = {
  notation: 'english',
  accidentalPreference: 'auto',
  transpose: 0,
  simplifyChords: false,
  reduceChords: false,
  reduceChordsMax: false,
  instrument: 'guitar',
  gridView: 'beats',
  theme: 'light',
  language: 'en',
};

const INSTRUMENTS: Instrument[] = ['guitar', 'piano', 'ukelele'];
const GRID_VIEWS: GridView[] = ['beats', 'list', 'bars', 'lyrics'];
const THEMES: Theme[] = ['light', 'dark'];
const LANGUAGES: Language[] = ['en', 'es'];

function clampTranspose(value: number): number {
  return Math.max(-11, Math.min(11, Math.trunc(value)));
}

function isPreferences(value: unknown): value is Partial<Preferences> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.notation === undefined ||
      candidate.notation === 'english' ||
      candidate.notation === 'spanish') &&
    (candidate.accidentalPreference === undefined ||
      candidate.accidentalPreference === 'auto' ||
      candidate.accidentalPreference === 'sharp' ||
      candidate.accidentalPreference === 'flat') &&
    (candidate.transpose === undefined || typeof candidate.transpose === 'number') &&
    (candidate.simplifyChords === undefined || typeof candidate.simplifyChords === 'boolean') &&
    (candidate.reduceChords === undefined || typeof candidate.reduceChords === 'boolean') &&
    (candidate.reduceChordsMax === undefined || typeof candidate.reduceChordsMax === 'boolean') &&
    (candidate.instrument === undefined ||
      INSTRUMENTS.includes(candidate.instrument as Instrument)) &&
    (candidate.gridView === undefined || GRID_VIEWS.includes(candidate.gridView as GridView)) &&
    (candidate.theme === undefined || THEMES.includes(candidate.theme as Theme)) &&
    (candidate.language === undefined || LANGUAGES.includes(candidate.language as Language))
  );
}

export function loadPreferences(storage: StorageLike): Preferences {
  const stored = readEnvelope(storage, KEYS.preferences, isPreferences);
  if (!stored) return { ...DEFAULT_PREFERENCES };
  return {
    notation: stored.notation === 'spanish' ? 'spanish' : 'english',
    accidentalPreference:
      stored.accidentalPreference === 'sharp' || stored.accidentalPreference === 'flat'
        ? stored.accidentalPreference
        : 'auto',
    transpose: typeof stored.transpose === 'number' ? clampTranspose(stored.transpose) : 0,
    simplifyChords: stored.simplifyChords === true,
    reduceChords: stored.reduceChords === true,
    reduceChordsMax: stored.reduceChords === true && stored.reduceChordsMax === true,
    instrument: stored.instrument ?? DEFAULT_PREFERENCES.instrument,
    gridView: stored.gridView ?? DEFAULT_PREFERENCES.gridView,
    theme: stored.theme ?? DEFAULT_PREFERENCES.theme,
    language: stored.language === 'es' ? 'es' : 'en',
  };
}

export function savePreferences(storage: StorageLike, preferences: Preferences): void {
  writeEnvelope(storage, KEYS.preferences, preferences);
}
