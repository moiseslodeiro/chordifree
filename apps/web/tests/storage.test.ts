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

describe('envelope versionado', () => {
  it('escribe y lee datos válidos', () => {
    const storage = createMemoryStorage();
    writeEnvelope(storage, 'clave', { hola: 'mundo' });
    const raw = JSON.parse(storage.getItem('clave') ?? '{}') as { schemaVersion: number };
    expect(raw.schemaVersion).toBe(SCHEMA_VERSION);
    expect(readEnvelope(storage, 'clave', passthrough)).toEqual({ hola: 'mundo' });
  });

  it('devuelve null cuando no hay datos', () => {
    const storage = createMemoryStorage();
    expect(readEnvelope(storage, 'nada', passthrough)).toBeNull();
  });

  it('pone en cuarentena el JSON corrupto y no rompe la lectura', () => {
    const storage = createMemoryStorage();
    storage.setItem('roto', '{no es json');
    expect(readEnvelope(storage, 'roto', passthrough)).toBeNull();
    expect(storage.getItem('roto')).toBeNull();
    expect(listKeys(storage, 'chordifree:v1:corrupt:')).toHaveLength(1);
  });

  it('descarta versiones no compatibles con cuarentena', () => {
    const storage = createMemoryStorage();
    storage.setItem('futuro', JSON.stringify({ schemaVersion: 99, data: { songs: [] } }));
    expect(readEnvelope(storage, 'futuro', passthrough)).toBeNull();
    expect(listKeys(storage, 'chordifree:v1:corrupt:')).toHaveLength(1);
  });

  it('migra datos sin sobre de la versión 0', () => {
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

  it('convierte el error de cuota en StorageQuotaError', () => {
    const storage = new FlakyStorage('clave');
    expect(() => writeEnvelope(storage, 'clave', { a: 1 })).toThrow(StorageQuotaError);
  });
});

describe('preferencias', () => {
  it('usa los valores por defecto sin datos', () => {
    expect(loadPreferences(createMemoryStorage())).toEqual(DEFAULT_PREFERENCES);
  });

  it('persiste y restaura notación, alteraciones y trasposición', () => {
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

  it('persiste y restaura simplificación, reducción, instrumento, vista y tema', () => {
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

  it('desactiva la reducción por defecto en preferencias antiguas', () => {
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

  it('persiste y restaura la vista Letra', () => {
    const storage = createMemoryStorage();
    savePreferences(storage, { ...DEFAULT_PREFERENCES, gridView: 'lyrics' });
    expect(loadPreferences(storage).gridView).toBe('lyrics');
  });

  it('tolera preferencias antiguas sin los campos nuevos', () => {
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

  it('tolera preferencias parciales y corruptas', () => {
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

  it('migra las claves de la marca anterior sin pisar las nuevas', () => {
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

  it('recorta la trasposición fuera de rango', () => {
    const storage = createMemoryStorage();
    savePreferences(storage, {
      ...DEFAULT_PREFERENCES,
      transpose: 40,
    });
    expect(loadPreferences(storage).transpose).toBe(11);
  });
});

describe('Library', () => {
  it('guarda, lista por última modificación, abre y elimina', () => {
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

  it('guarda, recupera y elimina la letra junto con la canción', () => {
    const storage = createMemoryStorage();
    const library = new Library(storage);
    library.save({ ...song('a', 'Primera'), lyrics: 'Primera línea\nSegunda línea' });

    expect(library.get('a')?.lyrics).toBe('Primera línea\nSegunda línea');

    library.save({ ...song('a', 'Primera'), lyrics: undefined });
    expect(library.get('a')?.lyrics).toBeUndefined();

    library.remove('a');
    expect(library.get('a')).toBeNull();
  });

  it('carga canciones antiguas sin letra', () => {
    const storage = createMemoryStorage();
    const library = new Library(storage);
    library.save(song('a', 'Sin letra'));
    expect(library.get('a')?.lyrics).toBeUndefined();
  });

  it('actualiza updatedAt al guardar y reordena', async () => {
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

  it('reintenta tras purgar la caché cuando la cuota falla', () => {
    const storage = new FlakyStorage(':song:');
    const library = new Library(storage);
    expect(() => library.save(song())).not.toThrow();
    expect(library.get('song-1')?.title).toBe('Demo');
  });

  it('propaga StorageQuotaError si la cuota sigue llena', () => {
    const storage = createMemoryStorage();
    storage.setItem = () => {
      throw quotaError();
    };
    const library = new Library(storage);
    expect(() => library.save(song())).toThrow(StorageQuotaError);
  });
});

describe('AnalysisCache', () => {
  it('guarda y recupera por origen y versión', () => {
    const storage = createMemoryStorage();
    const cache = new AnalysisCache(storage, () => 1000);
    cache.set('yt:dQw4w9WgXcQ', 'essentia-1.0', result());

    expect(cache.get('yt:dQw4w9WgXcQ', 'essentia-1.0')?.duration).toBe(8);
    expect(cache.get('yt:dQw4w9WgXcQ', 'essentia-2.0')).toBeNull();
    expect(cache.get('yt:otro', 'essentia-1.0')).toBeNull();
  });

  it('purga primero las entradas menos usadas', () => {
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

  it('cuenta solo las claves de caché al purgar', () => {
    const storage = createMemoryStorage();
    storage.setItem('otra:clave', 'x');
    expect(purgeAnalysisCache(storage, 5)).toBe(0);
  });
});

describe('cuarentena', () => {
  it('arranca con biblioteca vacía si los datos son ilegibles', () => {
    const storage = createMemoryStorage();
    storage.setItem(KEYS.library, 'basura');
    const library = new Library(storage);
    expect(library.list()).toEqual([]);
    expect(listKeys(storage, 'chordifree:v1:corrupt:')).toHaveLength(1);
  });

  it('no propaga errores al leer un almacén roto', () => {
    const storage = createMemoryStorage();
    storage.getItem = () => {
      throw new Error('bloqueado');
    };
    const library = new Library(storage);
    expect(library.list()).toEqual([]);
    expect(library.get('x')).toBeNull();
  });
});

describe('integración con localStorage', () => {
  it('persiste una canción entre instancias', () => {
    const storage = window.localStorage;
    const first = new Library(storage);
    first.save(song('persistente', 'Persistente'));

    const second = new Library(storage);
    expect(second.get('persistente')?.title).toBe('Persistente');
    expect(second.list()).toHaveLength(1);
  });
});
