import type { Chord, ChordSegment } from '@chordifree/chords';
import type { AnalysisResult, Folder, Song, SongSummary } from '../types';
import { sourceKey } from '../types';
import { listKeys, readEnvelope, removeKey, writeEnvelope } from './envelope';
import { KEYS, PREFIX, StorageQuotaError, type StorageLike } from './keys';

interface LibraryData {
  songs: SongSummary[];
  folders: Folder[];
}

export interface LibrarySnapshot {
  songs: Song[];
  folders: Folder[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isChord(value: unknown): value is Chord {
  if (!isRecord(value)) return false;
  return typeof value.root === 'number' && typeof value.quality === 'string';
}

function isSegment(value: unknown): value is ChordSegment {
  if (!isRecord(value)) return false;
  return (
    typeof value.start === 'number' &&
    typeof value.end === 'number' &&
    (value.chord === null || isChord(value.chord))
  );
}

function isSource(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.type === 'youtube') return typeof value.videoId === 'string';
  if (value.type === 'upload') return typeof value.filename === 'string';
  if (value.type === 'sheet') return typeof value.filename === 'string';
  return false;
}

function isVocalRegion(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.start === 'number' &&
    typeof value.end === 'number' &&
    value.end > value.start
  );
}

export function isFolder(value: unknown): value is Folder {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

export function isSong(value: unknown): value is Song {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    (value.artist === undefined || typeof value.artist === 'string') &&
    (value.folderId === undefined || typeof value.folderId === 'string') &&
    isSource(value.source) &&
    typeof value.duration === 'number' &&
    Array.isArray(value.segments) &&
    value.segments.every(isSegment) &&
    Array.isArray(value.detectedSegments) &&
    value.detectedSegments.every(isSegment) &&
    (value.beats === undefined ||
      (Array.isArray(value.beats) && value.beats.every((beat) => typeof beat === 'number'))) &&
    (value.beatsPerBar === undefined || typeof value.beatsPerBar === 'number') &&
    (value.vocalRegions === undefined ||
      (Array.isArray(value.vocalRegions) && value.vocalRegions.every(isVocalRegion))) &&
    (value.capo === undefined || typeof value.capo === 'number') &&
    (value.lyrics === undefined || typeof value.lyrics === 'string') &&
    typeof value.analyzerVersion === 'string' &&
    typeof value.transpose === 'number' &&
    (value.notation === 'english' || value.notation === 'spanish') &&
    typeof value.updatedAt === 'string'
  );
}

function isLibraryData(value: unknown): value is LibraryData {
  if (!isRecord(value) || !Array.isArray(value.songs)) return false;
  if (value.folders !== undefined && (!Array.isArray(value.folders) || !value.folders.every(isFolder))) {
    return false;
  }
  return value.songs.every(
    (song) =>
      isRecord(song) &&
      typeof song.id === 'string' &&
      typeof song.title === 'string' &&
      (song.folderId === undefined || typeof song.folderId === 'string') &&
      typeof song.updatedAt === 'string' &&
      typeof song.duration === 'number' &&
      isSource(song.source),
  );
}

function summaryOf(song: Song): SongSummary {
  return {
    id: song.id,
    title: song.title,
    source: song.source,
    duration: song.duration,
    ...(song.folderId ? { folderId: song.folderId } : {}),
    updatedAt: song.updatedAt,
  };
}

function sortSummaries(songs: SongSummary[]): SongSummary[] {
  return [...songs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function sortFolders(folders: Folder[]): Folder[] {
  return [...folders].sort((a, b) => a.name.localeCompare(b.name));
}

/** Purges the oldest analysis cache entries. */
export function purgeAnalysisCache(storage: StorageLike, count = 5): number {
  const entries = listKeys(storage, `${PREFIX}:analysis:`)
    .map((key) => {
      const raw = storage.getItem(key);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as { data?: { lastAccessedAt?: number } };
        return { key, lastAccessedAt: parsed.data?.lastAccessedAt ?? 0 };
      } catch {
        return { key, lastAccessedAt: 0 };
      }
    })
    .filter((entry): entry is { key: string; lastAccessedAt: number } => entry !== null)
    .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

  entries.slice(0, count).forEach((entry) => removeKey(storage, entry.key));
  return Math.min(count, entries.length);
}

export function clearAnalysisCache(storage: StorageLike): number {
  const keys = listKeys(storage, `${PREFIX}:analysis:`);
  for (const key of keys) removeKey(storage, key);
  return keys.length;
}

export function analysisCacheStats(storage: StorageLike): { entries: number; bytes: number } {
  const keys = listKeys(storage, `${PREFIX}:analysis:`);
  let bytes = 0;
  for (const key of keys) {
    bytes += (key.length + (storage.getItem(key)?.length ?? 0)) * 2;
  }
  return { entries: keys.length, bytes };
}

export interface ImportResult {
  added: number;
  updated: number;
}

export class Library {
  constructor(private readonly storage: StorageLike) {}

  list(): SongSummary[] {
    const data = readEnvelope(this.storage, KEYS.library, isLibraryData);
    return sortSummaries(data?.songs ?? []);
  }

  listFolders(): Folder[] {
    const data = readEnvelope(this.storage, KEYS.library, isLibraryData);
    return sortFolders(data?.folders ?? []);
  }

  get(id: string): Song | null {
    return readEnvelope(this.storage, KEYS.song(id), isSong);
  }

  /** All complete songs, in the same order as the library. */
  exportSongs(): Song[] {
    return this.list()
      .map((summary) => this.get(summary.id))
      .filter((song): song is Song => song !== null);
  }

  exportSnapshot(): LibrarySnapshot {
    return { songs: this.exportSongs(), folders: this.listFolders() };
  }

  createFolder(name: string): Folder {
    const clean = name.trim();
    if (!clean) throw new Error('Folder name is required');
    const timestamp = new Date().toISOString();
    const folder: Folder = {
      id: crypto.randomUUID(),
      name: clean,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.writeLibrary(this.list(), [...this.listFolders(), folder]);
    return folder;
  }

  renameFolder(id: string, name: string): Folder | null {
    const clean = name.trim();
    if (!clean) return null;
    const folders = this.listFolders();
    const current = folders.find((folder) => folder.id === id);
    if (!current) return null;
    const next: Folder = { ...current, name: clean, updatedAt: new Date().toISOString() };
    this.writeLibrary(
      this.list(),
      folders.map((folder) => (folder.id === id ? next : folder)),
    );
    return next;
  }

  /** Removes a folder and moves its songs to the unfiled group. */
  deleteFolder(id: string): boolean {
    const folders = this.listFolders();
    if (!folders.some((folder) => folder.id === id)) return false;

    const summaries = this.list();
    for (const summary of summaries) {
      if (summary.folderId !== id) continue;
      const song = this.get(summary.id);
      if (!song) continue;
      const { folderId: _folderId, ...rest } = song;
      writeEnvelope(this.storage, KEYS.song(song.id), {
        ...rest,
        updatedAt: new Date().toISOString(),
      });
    }

    this.writeLibrary(
      summaries.map((summary) =>
        summary.folderId === id ? { ...summary, folderId: undefined } : summary,
      ),
      folders.filter((folder) => folder.id !== id),
    );
    return true;
  }

  moveSong(id: string, folderId: string | null): boolean {
    const song = this.get(id);
    if (!song) return false;
    const target = folderId && this.listFolders().some((folder) => folder.id === folderId)
      ? folderId
      : undefined;
    const { folderId: _folderId, ...rest } = song;
    const next: Song = {
      ...rest,
      ...(target ? { folderId: target } : {}),
      updatedAt: new Date().toISOString(),
    };
    writeEnvelope(this.storage, KEYS.song(id), next);
    const others = this.list().filter((summary) => summary.id !== id);
    this.writeLibrary([summaryOf(next), ...others], this.listFolders());
    return true;
  }

  /** Adds a shared song as a new entry; it never overwrites by source. */
  add(song: Song): Song {
    const stored: Song = {
      ...song,
      id: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    this.save(stored);
    return stored;
  }

  /**
   * Merges a backup with the current library. Songs that share a source are
   * updated while keeping their id (and their practice state); the rest are
   * added. If an id conflicts with another song, a new one is generated.
   */
  importSongs(songs: Song[]): ImportResult {
    return this.writeImported(songs, this.listFolders());
  }

  /** Restores a backup, including its folders. */
  importSnapshot(snapshot: LibrarySnapshot): ImportResult {
    const foldersById = new Map(this.listFolders().map((folder) => [folder.id, folder] as const));
    for (const folder of snapshot.folders) {
      if (!isFolder(folder)) continue;
      const existing = foldersById.get(folder.id);
      foldersById.set(
        folder.id,
        existing
          ? { ...existing, name: folder.name, updatedAt: folder.updatedAt }
          : folder,
      );
    }

    const folders = [...foldersById.values()];
    const songs = snapshot.songs.map((song) =>
      song.folderId && foldersById.has(song.folderId)
        ? song
        : { ...song, folderId: undefined },
    );
    return this.writeImported(songs, folders);
  }

  private writeImported(songs: Song[], folders: Folder[]): ImportResult {
    const unique = new Map<string, Song>();
    for (const song of songs) unique.set(sourceKey(song.source), song);

    try {
      return this.writeImportedOnce([...unique.values()], folders);
    } catch (error) {
      if (!(error instanceof StorageQuotaError)) throw error;
      purgeAnalysisCache(this.storage);
      return this.writeImportedOnce([...unique.values()], folders);
    }
  }

  private writeImportedOnce(songs: Song[], folders: Folder[]): ImportResult {
    const folderIds = new Set(folders.map((folder) => folder.id));
    const summaries = new Map(this.list().map((summary) => [summary.id, summary] as const));
    const bySource = new Map(
      [...summaries.values()].map((summary) => [sourceKey(summary.source), summary] as const),
    );
    const ids = new Set(summaries.keys());
    let added = 0;
    let updated = 0;

    for (const song of songs) {
      const key = sourceKey(song.source);
      const match = bySource.get(key);
      let id = match?.id ?? song.id;
      if (!id) id = crypto.randomUUID();
      if (!match && ids.has(id)) id = crypto.randomUUID();
      const folderId = song.folderId && folderIds.has(song.folderId) ? song.folderId : undefined;

      const stored: Song = {
        ...song,
        id,
        ...(folderId ? { folderId } : { folderId: undefined }),
      };
      writeEnvelope(this.storage, KEYS.song(id), stored);

      const summary = summaryOf(stored);
      summaries.set(id, summary);
      bySource.set(key, summary);
      ids.add(id);
      if (match) updated += 1;
      else added += 1;
    }

    this.writeLibrary([...summaries.values()], folders);
    return { added, updated };
  }

  private writeLibrary(songs: SongSummary[], folders: Folder[]): void {
    writeEnvelope(this.storage, KEYS.library, {
      songs: sortSummaries(songs),
      folders: sortFolders(folders),
    });
  }

  save(song: Song): void {
    const folderId =
      song.folderId && this.listFolders().some((folder) => folder.id === song.folderId)
        ? song.folderId
        : undefined;
    const normalized: Song = {
      ...song,
      ...(folderId ? { folderId } : { folderId: undefined }),
      updatedAt: new Date().toISOString(),
    };
    const write = () => {
      writeEnvelope(this.storage, KEYS.song(normalized.id), normalized);
      const others = this.list().filter((summary) => summary.id !== normalized.id);
      // The new summary goes first so that, if two saves share the
      // same millisecond, the stable order keeps the most recent on top.
      this.writeLibrary([summaryOf(normalized), ...others], this.listFolders());
    };

    try {
      write();
    } catch (error) {
      if (!(error instanceof StorageQuotaError)) throw error;
      purgeAnalysisCache(this.storage);
      write();
    }
  }

  remove(id: string): void {
    removeKey(this.storage, KEYS.song(id));
    const remaining = this.list().filter((summary) => summary.id !== id);
    this.writeLibrary(remaining, this.listFolders());
  }
}

export function cacheKey(sourceKey: string, analyzerVersion: string): string {
  let hash = 2166136261;
  const input = `${sourceKey}|${analyzerVersion}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

interface CachedAnalysis {
  sourceKey: string;
  analyzerVersion: string;
  result: AnalysisResult;
  lastAccessedAt: number;
}

function isCachedAnalysis(value: unknown): value is CachedAnalysis {
  if (!isRecord(value)) return false;
  return (
    typeof value.sourceKey === 'string' &&
    typeof value.analyzerVersion === 'string' &&
    typeof value.lastAccessedAt === 'number' &&
    isRecord(value.result) &&
    typeof value.result.duration === 'number' &&
    Array.isArray(value.result.segments)
  );
}

export class AnalysisCache {
  constructor(
    private readonly storage: StorageLike,
    private readonly now: () => number = Date.now,
  ) {}

  get(sourceKey: string, analyzerVersion: string): AnalysisResult | null {
    const key = KEYS.analysis(cacheKey(sourceKey, analyzerVersion));
    const entry = readEnvelope(this.storage, key, isCachedAnalysis);
    if (!entry) return null;
    if (entry.sourceKey !== sourceKey || entry.analyzerVersion !== analyzerVersion) return null;
    writeEnvelope(this.storage, key, { ...entry, lastAccessedAt: this.now() });
    return entry.result;
  }

  set(sourceKey: string, analyzerVersion: string, result: AnalysisResult): void {
    const key = KEYS.analysis(cacheKey(sourceKey, analyzerVersion));
    const entry: CachedAnalysis = {
      sourceKey,
      analyzerVersion,
      result,
      lastAccessedAt: this.now(),
    };
    try {
      writeEnvelope(this.storage, key, entry);
    } catch (error) {
      if (!(error instanceof StorageQuotaError)) throw error;
      purgeAnalysisCache(this.storage);
      writeEnvelope(this.storage, key, entry);
    }
  }

  purge(count = 5): number {
    return purgeAnalysisCache(this.storage, count);
  }

  clear(): number {
    return clearAnalysisCache(this.storage);
  }
}
