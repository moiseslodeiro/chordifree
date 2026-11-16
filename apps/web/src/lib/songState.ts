import { listKeys } from '../storage/envelope';
import { PREFIX, type StorageLike } from '../storage/keys';
import type { Song } from '../types';

/** Static audio shipped with the app (the built-in demo) has no object URL. */
export function audioUrlForSong(song: Song): string | null {
  return song.source.type === 'upload' && song.source.filename === 'demo.wav' ? '/demo.wav' : null;
}

/** Stable comparison that ignores timestamps and object key order. */
export function comparableSong(song: Song): string {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, stable(entry)]),
      );
    }
    return value;
  };
  const { updatedAt: _updatedAt, ...rest } = song;
  return JSON.stringify(stable(rest));
}

export function songIsDirty(current: Song | null, saved: Song | null): boolean {
  if (!current || !saved) return false;
  return comparableSong(current) !== comparableSong(saved);
}

export function hasQuarantinedData(storage: StorageLike): boolean {
  return listKeys(storage, `${PREFIX}:corrupt:`).length > 0;
}
