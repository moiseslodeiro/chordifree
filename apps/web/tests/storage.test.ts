import { describe, expect, it } from 'vitest';
import {
  createMemoryStorage,
  KEYS,
  LEGACY_PREFIX,
  migrateLegacyKeys,
  SCHEMA_VERSION,
  StorageQuotaError,
  type StorageLike,
} from '../src/storage/keys';
import { listKeys, readEnvelope, writeEnvelope } from '../src/storage/envelope';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences } from '../src/storage/preferences';
import { AnalysisCache, Library, purgeAnalysisCache } from '../src/storage/library';
import type { AnalysisResult, Song } from '../src/types';
import { parseChord } from '@chordifree/chords';

function quotaError(): Error {
  return Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
}

function song(id = 'song-1', title = 'Demo'): Song {
  return {
    id,
    title,
    source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
    duration: 8,
    segments: [
      { start: 0, end: 4, chord: parseChord('C') },
      { start: 4, end: 8, chord: parseChord('G') },
    ],
    detectedSegments: [
      { start: 0, end: 4, chord: parseChord('C') },
      { start: 4, end: 8, chord: parseChord('G') },
    ],
    analyzerVersion: 'essentia-1.0',
    transpose: 0,
    notation: 'english',
    accidentalPreference: 'auto',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function result(duration = 8): AnalysisResult {
  return {
    source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
    duration,
    segments: [{ start: 0, end: duration, chord: parseChord('C') }],
    analyzerVersion: 'essentia-1.0',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

class FlakyStorage implements StorageLike {
  private readonly inner = createMemoryStorage();
  failed = false;

  constructor(private readonly failOn: string) {}

  get length() {
    return this.inner.length;
  }
  getItem(key: string) {
    return this.inner.getItem(key);
  }
  setItem(key: string, value: string) {
    if (!this.failed && key.includes(this.failOn)) {
      this.failed = true;
      throw quotaError();
    }
    this.inner.setItem(key, value);
  }
  removeItem(key: string) {
    this.inner.removeItem(key);
  }
  key(index: number) {
    return this.inner.key(index);
  }
}

function passthrough(_value: unknown): _value is unknown {
  return true;
}

describe('versioned envelope', () => {
  it('writes and reads valid data', () => {
    const storage = createMemoryStorage();
    writeEnvelope(storage, 'clave', { hola: 'mundo' });
    const raw = JSON.parse(storage.getItem('clave') ?? '{}') as { schemaVersion: number };
    expect(raw.schemaVersion).toBe(SCHEMA_VERSION);
    expect(readEnvelope(storage, 'clave', passthrough)).toEqual({ hola: 'mundo' });
  });

  it('returns null when there is no data', () => {
    const storage = createMemoryStorage();
    expect(readEnvelope(storage, 'nada', passthrough)).toBeNull();
  });

  it('quarantines corrupt JSON and does not break reading', () => {
    const storage = createMemoryStorage();
    storage.setItem('roto', '{no es json');
    expect(readEnvelope(storage, 'roto', passthrough)).toBeNull();
    expect(storage.getItem('roto')).toBeNull();
    expect(listKeys(storage, 'chordifree:v1:corrupt:')).toHaveLength(1);
  });

  it('discards unsupported versions into quarantine', () => {
    const storage = createMemoryStorage();
    storage.setItem('futuro', JSON.stringify({ schemaVersion: 99, data: { songs: [] } }));
    expect(readEnvelope(storage, 'futuro', passthrough)).toBeNull();
    expect(listKeys(storage, 'chordifree:v1:corrupt:')).toHaveLength(1);
  });

  it('migrates version 0 data without an envelope', () => {
    const storage = createMemoryStorage();
    const summary = {
      id: 'a',
      title: 'Antigua',
      source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
      duration: 10,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    storage.setItem(KEYS.library, JSON.stringify({ songs: [summary] }));
    const library = new Library(storage);
    expect(library.list()).toEqual([summary]);
  });

  it('turns the quota error into StorageQuotaError', () => {
    const storage = new FlakyStorage('clave');
    expect(() => writeEnvelope(storage, 'clave', { a: 1 })).toThrow(StorageQuotaError);
  });
});

describe('preferences', () => {
  it('uses the defaults when there is no data', () => {
    expect(loadPreferences(createMemoryStorage())).toEqual(DEFAULT_PREFERENCES);
  });

  it('persists and restores notation, accidentals and transposition', () => {
    const storage = createMemoryStorage();
    savePreferences(storage, {
      ...DEFAULT_PREFERENCES,
      notation: 'spanish',
      accidentalPreference: 'flat',
      transpose: 3,
    });
    expect(loadPreferences(storage)).toEqual({
      ...DEFAULT_PREFERENCES,
      notation: 'spanish',
      accidentalPreference: 'flat',
      transpose: 3,
    });
  });

  it('persists and restores simplification, reduction, instrument, view and theme', () => {
    const storage = createMemoryStorage();
    savePreferences(storage, {
      ...DEFAULT_PREFERENCES,
      simplifyChords: true,
      reduceChords: true,
      reduceChordsMax: true,
      instrument: 'piano',
      gridView: 'list',
      theme: 'dark',
    });
    const loaded = loadPreferences(storage);
    expect(loaded.simplifyChords).toBe(true);
    expect(loaded.reduceChords).toBe(true);
    expect(loaded.reduceChordsMax).toBe(true);
    expect(loaded.instrument).toBe('piano');
    expect(loaded.gridView).toBe('list');
    expect(loaded.theme).toBe('dark');
    expect(loaded.notation).toBe('english');
    expect(loaded.transpose).toBe(0);
  });

  it('disables reduction by default in old preferences', () => {
    const storage = createMemoryStorage();
    writeEnvelope(storage, KEYS.preferences, {
      notation: 'spanish',
      accidentalPreference: 'sharp',
      transpose: 4,
      simplifyChords: true,
    });
    const loaded = loadPreferences(storage);
    expect(loaded.reduceChords).toBe(false);
    expect(loaded.reduceChordsMax).toBe(false);
    expect(loaded.simplifyChords).toBe(true);
  });

  it('persists and restores the Lyrics view', () => {
    const storage = createMemoryStorage();
    savePreferences(storage, { ...DEFAULT_PREFERENCES, gridView: 'lyrics' });
    expect(loadPreferences(storage).gridView).toBe('lyrics');
  });

  it('tolerates old preferences without the new fields', () => {
    const storage = createMemoryStorage();
    writeEnvelope(storage, KEYS.preferences, {
      notation: 'spanish',
      accidentalPreference: 'sharp',
      transpose: 4,
    });
    expect(loadPreferences(storage)).toEqual({
      ...DEFAULT_PREFERENCES,
      notation: 'spanish',
      accidentalPreference: 'sharp',
      transpose: 4,
    });
  });

  it('tolerates partial and corrupt preferences', () => {
    const partial = createMemoryStorage();
    writeEnvelope(partial, KEYS.preferences, { instrument: 'ukelele' });
    expect(loadPreferences(partial)).toEqual({
      ...DEFAULT_PREFERENCES,
      instrument: 'ukelele',
    });

    const corrupt = createMemoryStorage();
    corrupt.setItem(KEYS.preferences, '{"schemaVersion":1,"data":{"instrument":"lira"}}');
    expect(loadPreferences(corrupt)).toEqual(DEFAULT_PREFERENCES);
    expect(listKeys(corrupt, 'chordifree:v1:corrupt:')).toHaveLength(1);
  });

  it('migrates keys from the previous brand without overwriting the new ones', () => {
    const storage = createMemoryStorage();
    storage.setItem(`${LEGACY_PREFIX}:preferences`, '{"schemaVersion":1,"data":{}}');
    storage.setItem(`${LEGACY_PREFIX}:song:abc`, '{"schemaVersion":1,"data":{}}');
    storage.setItem(KEYS.song('abc'), '{"schemaVersion":1,"data":{"nuevo":true}}');

    migrateLegacyKeys(storage);

    expect(storage.getItem(`${LEGACY_PREFIX}:preferences`)).toBeNull();
    expect(storage.getItem(`${LEGACY_PREFIX}:song:abc`)).toBeNull();
    expect(storage.getItem(KEYS.preferences)).toBe('{"schemaVersion":1,"data":{}}');
    expect(storage.getItem(KEYS.song('abc'))).toContain('nuevo');
  });

  it('clamps out-of-range transposition', () => {
    const storage = createMemoryStorage();
    savePreferences(storage, {
      ...DEFAULT_PREFERENCES,
      transpose: 40,
    });
    expect(loadPreferences(storage).transpose).toBe(11);
  });
});

describe('Library', () => {
  it('saves, lists by last modified, opens and deletes', () => {
    const storage = createMemoryStorage();
    const library = new Library(storage);
    library.save(song('a', 'Primera'));
    library.save(song('b', 'Segunda'));

    const listed = library.list();
    expect(listed.map((item) => item.id)).toEqual(['b', 'a']);

    expect(library.get('a')?.title).toBe('Primera');
    expect(library.get('desconocida')).toBeNull();

    library.remove('b');
    expect(library.list().map((item) => item.id)).toEqual(['a']);
    expect(library.get('b')).toBeNull();
  });

  it('saves, retrieves and deletes lyrics along with the song', () => {
    const storage = createMemoryStorage();
    const library = new Library(storage);
    library.save({ ...song('a', 'Primera'), lyrics: 'Primera línea\nSegunda línea' });

    expect(library.get('a')?.lyrics).toBe('Primera línea\nSegunda línea');

    library.save({ ...song('a', 'Primera'), lyrics: undefined });
    expect(library.get('a')?.lyrics).toBeUndefined();

    library.remove('a');
    expect(library.get('a')).toBeNull();
  });

  it('loads old songs without lyrics', () => {
    const storage = createMemoryStorage();
    const library = new Library(storage);
    library.save(song('a', 'Sin letra'));
    expect(library.get('a')?.lyrics).toBeUndefined();
  });

  it('updates updatedAt on save and reorders', async () => {
    const storage = createMemoryStorage();
    const library = new Library(storage);
    library.save(song('a', 'Primera'));
    await new Promise((resolve) => setTimeout(resolve, 5));
    library.save(song('b', 'Segunda'));
    expect(library.list()[0]?.id).toBe('b');

    await new Promise((resolve) => setTimeout(resolve, 5));
    library.save({ ...song('a', 'Primera'), title: 'Primera editada' });
    expect(library.list()[0]?.title).toBe('Primera editada');
  });

  it('retries after purging the cache when quota fails', () => {
    const storage = new FlakyStorage(':song:');
    const library = new Library(storage);
    expect(() => library.save(song())).not.toThrow();
    expect(library.get('song-1')?.title).toBe('Demo');
  });

  it('propagates StorageQuotaError if quota is still full', () => {
    const storage = createMemoryStorage();
    storage.setItem = () => {
      throw quotaError();
    };
    const library = new Library(storage);
    expect(() => library.save(song())).toThrow(StorageQuotaError);
  });
});

describe('AnalysisCache', () => {
  it('saves and retrieves by source and version', () => {
    const storage = createMemoryStorage();
    const cache = new AnalysisCache(storage, () => 1000);
    cache.set('yt:dQw4w9WgXcQ', 'essentia-1.0', result());

    expect(cache.get('yt:dQw4w9WgXcQ', 'essentia-1.0')?.duration).toBe(8);
    expect(cache.get('yt:dQw4w9WgXcQ', 'essentia-2.0')).toBeNull();
    expect(cache.get('yt:otro', 'essentia-1.0')).toBeNull();
  });

  it('purges the least recently used entries first', () => {
    const storage = createMemoryStorage();
    let now = 1000;
    const cache = new AnalysisCache(storage, () => now);

    cache.set('yt:a', 'v1', result());
    now = 2000;
    cache.set('yt:b', 'v1', result());
    now = 3000;
    cache.set('yt:c', 'v1', result());

    expect(cache.purge(1)).toBe(1);
    expect(cache.get('yt:a', 'v1')).toBeNull();
    expect(cache.get('yt:b', 'v1')).not.toBeNull();
    expect(cache.get('yt:c', 'v1')).not.toBeNull();
  });

  it('counts only cache keys when purging', () => {
    const storage = createMemoryStorage();
    storage.setItem('otra:clave', 'x');
    expect(purgeAnalysisCache(storage, 5)).toBe(0);
  });
});

describe('quarantine', () => {
  it('starts with an empty library if the data is unreadable', () => {
    const storage = createMemoryStorage();
    storage.setItem(KEYS.library, 'basura');
    const library = new Library(storage);
    expect(library.list()).toEqual([]);
    expect(listKeys(storage, 'chordifree:v1:corrupt:')).toHaveLength(1);
  });

  it('does not propagate errors when reading a broken store', () => {
    const storage = createMemoryStorage();
    storage.getItem = () => {
      throw new Error('bloqueado');
    };
    const library = new Library(storage);
    expect(library.list()).toEqual([]);
    expect(library.get('x')).toBeNull();
  });
});

describe('integration with localStorage', () => {
  it('persists a song across instances', () => {
    const storage = window.localStorage;
    const first = new Library(storage);
    first.save(song('persistente', 'Persistente'));

    const second = new Library(storage);
    expect(second.get('persistente')?.title).toBe('Persistente');
    expect(second.list()).toHaveLength(1);
  });
});
