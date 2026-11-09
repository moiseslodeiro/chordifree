import type { SongHistory } from '../types';
import { readEnvelope, writeEnvelope } from './envelope';
import { KEYS, type StorageLike } from './keys';

export type HistoryMap = Record<string, SongHistory>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHistory(value: unknown): value is HistoryMap {
  if (!isRecord(value)) return false;
  return Object.values(value).every(
    (entry) =>
      isRecord(entry) &&
      typeof entry.lastOpenedAt === 'string' &&
      typeof entry.openCount === 'number' &&
      entry.openCount >= 0,
  );
}

export function loadHistory(storage: StorageLike): HistoryMap {
  return readEnvelope(storage, KEYS.history, isHistory) ?? {};
}

export function saveHistory(storage: StorageLike, history: HistoryMap): void {
  writeEnvelope(storage, KEYS.history, history);
}

/** Record that a song was opened. Returns a new map ready to persist. */
export function markOpened(
  history: HistoryMap,
  songId: string,
  now: Date = new Date(),
): HistoryMap {
  const previous = history[songId];
  const next: HistoryMap = {
    ...history,
    [songId]: {
      lastOpenedAt: now.toISOString(),
      openCount: (previous?.openCount ?? 0) + 1,
    },
  };

  const entries = Object.entries(next);
  if (entries.length <= 500) return next;
  return Object.fromEntries(
    entries
      .sort(([, a], [, b]) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))
      .slice(0, 500),
  );
}
