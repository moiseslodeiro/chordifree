import type { Chord, ChordSegment } from '@chordifree/chords';
import type { AnalysisResult, Song, SongSummary } from '../types';
import { sourceKey } from '../types';
import { listKeys, readEnvelope, removeKey, writeEnvelope } from './envelope';
import { KEYS, PREFIX, StorageQuotaError, type StorageLike } from './keys';

interface LibraryData {
  songs: SongSummary[];
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

export function isSong(value: unknown): value is Song {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    (value.artist === undefined || typeof value.artist === 'string') &&
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
  return value.songs.every(
    (song) =>
      isRecord(song) &&
      typeof song.id === 'string' &&
      typeof song.title === 'string' &&
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
    updatedAt: song.updatedAt,
  };
}

function sortSummaries(songs: SongSummary[]): SongSummary[] {
  return [...songs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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

  get(id: string): Song | null {
    return readEnvelope(this.storage, KEYS.song(id), isSong);
  }

  /** All complete songs, in the same order as the library. */
  exportSongs(): Song[] {
    return this.list()
      .map((summary) => this.get(summary.id))
      .filter((song): song is Song => song !== null);
  }

  /**
   * Merges a backup with the current library. Songs that share a source are
   * updated while keeping their id (and their practice state); the rest are
   * added. If an id conflicts with another song, a new one is generated.
   */
  importSongs(songs: Song[]): ImportResult {
    const unique = new Map<string, Song>();
    for (const song of songs) unique.set(sourceKey(song.source), song);

    try {
      return this.writeImported([...unique.values()]);
    } catch (error) {
      if (!(error instanceof StorageQuotaError)) throw error;
      purgeAnalysisCache(this.storage);
      return this.writeImported([...unique.values()]);
    }
  }

  private writeImported(songs: Song[]): ImportResult {
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

      const stored: Song = { ...song, id };
      writeEnvelope(this.storage, KEYS.song(id), stored);

      const summary = summaryOf(stored);
      summaries.set(id, summary);
      bySource.set(key, summary);
      ids.add(id);
      if (match) updated += 1;
      else added += 1;
    }

    writeEnvelope(this.storage, KEYS.library, {
      songs: sortSummaries([...summaries.values()]),
    });
    return { added, updated };
  }

  save(song: Song): void {
    const normalized: Song = { ...song, updatedAt: new Date().toISOString() };
    const write = () => {
      writeEnvelope(this.storage, KEYS.song(normalized.id), normalized);
      const others = this.list().filter((summary) => summary.id !== normalized.id);
      // The new summary goes first so that, if two saves share the
      // same millisecond, the stable order keeps the most recent on top.
      writeEnvelope(this.storage, KEYS.library, {
        songs: sortSummaries([summaryOf(normalized), ...others]),
      });
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
    writeEnvelope(this.storage, KEYS.library, { songs: remaining });
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
