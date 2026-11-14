import { readEnvelope, removeKey, writeEnvelope } from './envelope';
import { KEYS, type StorageLike } from './keys';

/** Playback rates supported by the player and the practice selector. */
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5] as const;

export const MIN_BPM = 40;
export const MAX_BPM = 240;
export const DEFAULT_BPM = 90;
export const MIN_PITCH = -12;
export const MAX_PITCH = 12;

export interface PracticeSession {
  loopA: number | null;
  loopB: number | null;
  loopEnabled: boolean;
  rate: number;
  /** Manual BPM for the metronome when the analysis has no beats. */
  bpm: number;
  /** Audio pitch in semitones, independent from the chord transposition. */
  pitch: number;
}

export const DEFAULT_PRACTICE: PracticeSession = {
  loopA: null,
  loopB: null,
  loopEnabled: false,
  rate: 1,
  bpm: DEFAULT_BPM,
  pitch: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function timeOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function clampBpm(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_BPM;
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(value)));
}

function pickRate(value: unknown): number {
  return PLAYBACK_RATES.find((rate) => rate === value) ?? 1;
}

function clampPitch(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(MIN_PITCH, Math.min(MAX_PITCH, Math.round(value)));
}

/** Fixes inverted ranges, unsupported rates and out-of-range BPM. */
export function normalizePractice(value: unknown): PracticeSession {
  const candidate = isRecord(value) ? value : {};
  const loopA = timeOrNull(candidate.loopA);
  let loopB = timeOrNull(candidate.loopB);
  if (loopA !== null && loopB !== null && loopB <= loopA) loopB = null;

  return {
    loopA,
    loopB,
    loopEnabled: candidate.loopEnabled === true && loopA !== null && loopB !== null,
    rate: pickRate(candidate.rate),
    bpm: clampBpm(candidate.bpm),
    pitch: clampPitch(candidate.pitch),
  };
}

export function loadPractice(storage: StorageLike, songId: string): PracticeSession {
  const stored = readEnvelope<Record<string, unknown>>(
    storage,
    KEYS.practice(songId),
    isRecord,
  );
  return stored ? normalizePractice(stored) : { ...DEFAULT_PRACTICE };
}

export function savePractice(
  storage: StorageLike,
  songId: string,
  session: PracticeSession,
): void {
  writeEnvelope(storage, KEYS.practice(songId), normalizePractice(session));
}

export function removePractice(storage: StorageLike, songId: string): void {
  removeKey(storage, KEYS.practice(songId));
}
