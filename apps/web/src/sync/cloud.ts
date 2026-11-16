import type { Setlist, Song } from '@chordifree/contracts';
import { sourceKey } from '../types';

export interface CloudSnapshot {
  songs: Song[];
  setlists: Setlist[];
}

/**
 * Songs are matched by their source (YouTube id or upload/sheet filename), not
 * by the local id, because two devices can create different ids for the same
 * source. The newest `updatedAt` wins; remote wins ties.
 */
export function mergeSongs(local: Song[], remote: Song[]): Song[] {
  const bySource = new Map<string, Song>();
  for (const song of remote) {
    bySource.set(sourceKey(song.source), song);
  }
  for (const song of local) {
    const key = sourceKey(song.source);
    const current = bySource.get(key);
    if (!current || new Date(song.updatedAt).getTime() > new Date(current.updatedAt).getTime()) {
      bySource.set(key, song);
    }
  }
  return [...bySource.values()];
}

/** Setlists are matched by id. The newest `updatedAt` wins; remote wins ties. */
export function mergeSetlists(local: Setlist[], remote: Setlist[]): Setlist[] {
  const byId = new Map(local.map((setlist) => [setlist.id, setlist] as const));
  for (const setlist of remote) {
    const current = byId.get(setlist.id);
    if (
      !current ||
      new Date(setlist.updatedAt).getTime() >= new Date(current.updatedAt).getTime()
    ) {
      byId.set(setlist.id, setlist);
    }
  }
  return [...byId.values()];
}

export function mergeSnapshot(local: CloudSnapshot, remote: CloudSnapshot): CloudSnapshot {
  return {
    songs: mergeSongs(local.songs, remote.songs),
    setlists: mergeSetlists(local.setlists, remote.setlists),
  };
}
