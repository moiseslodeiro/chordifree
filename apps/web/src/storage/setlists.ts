import type { Setlist } from '../types';
import { readEnvelope, writeEnvelope } from './envelope';
import { KEYS, type StorageLike } from './keys';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSetlist(value: unknown): value is Setlist {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.songIds) &&
    value.songIds.every((id) => typeof id === 'string') &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isSetlistList(value: unknown): value is Setlist[] {
  return Array.isArray(value) && value.every(isSetlist);
}

export function loadSetlists(storage: StorageLike): Setlist[] {
  return readEnvelope(storage, KEYS.setlists, isSetlistList) ?? [];
}

export function saveSetlists(
  storage: StorageLike,
  setlists: Setlist[],
): void {
  writeEnvelope(storage, KEYS.setlists, setlists);
}

export function createSetlist(name: string, now: Date = new Date()): Setlist {
  const timestamp = now.toISOString();
  return {
    id: crypto.randomUUID(),
    name: name.trim() || 'Untitled setlist',
    songIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function renameSetlist(
  setlist: Setlist,
  name: string,
  now: Date = new Date(),
): Setlist {
  return {
    ...setlist,
    name: name.trim() || setlist.name,
    updatedAt: now.toISOString(),
  };
}

export function addSongToSetlist(
  setlist: Setlist,
  songId: string,
  now: Date = new Date(),
): Setlist {
  if (setlist.songIds.includes(songId)) return setlist;
  return {
    ...setlist,
    songIds: [...setlist.songIds, songId],
    updatedAt: now.toISOString(),
  };
}

export function removeSongFromSetlist(
  setlist: Setlist,
  songId: string,
  now: Date = new Date(),
): Setlist {
  return {
    ...setlist,
    songIds: setlist.songIds.filter((id) => id !== songId),
    updatedAt: now.toISOString(),
  };
}

export function moveSongInSetlist(
  setlist: Setlist,
  songId: string,
  direction: -1 | 1,
  now: Date = new Date(),
): Setlist {
  const index = setlist.songIds.indexOf(songId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= setlist.songIds.length) return setlist;
  const songIds = [...setlist.songIds];
  [songIds[index], songIds[target]] = [songIds[target]!, songIds[index]!];
  return { ...setlist, songIds, updatedAt: now.toISOString() };
}
