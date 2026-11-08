import { describe, expect, it } from 'vitest';
import { parseChord } from '@chordifree/chords';
import { createMemoryStorage } from '../src/storage/keys';
import { Library } from '../src/storage/library';
import type { Song } from '../src/types';

function song(id: string, videoId: string, title: string, updatedAt = '2026-01-01T00:00:00.000Z'): Song {
  return {
    id,
    title,
    source: { type: 'youtube', videoId },
    duration: 8,
    segments: [{ start: 0, end: 8, chord: parseChord('C') }],
    detectedSegments: [{ start: 0, end: 8, chord: parseChord('C') }],
    analyzerVersion: 'essentia-1.2',
    transpose: 0,
    notation: 'english',
    accidentalPreference: 'auto',
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('exportación e importación de la biblioteca', () => {
  it('exporta las canciones completas en el orden de la biblioteca', () => {
    const library = new Library(createMemoryStorage());
    library.save(song('a', 'video-a', 'Primera', '2026-01-01T00:00:00.000Z'));
    library.save(song('b', 'video-b', 'Segunda', '2026-01-02T00:00:00.000Z'));

    const exported = library.exportSongs();
    expect(exported.map((item) => item.title)).toEqual(['Segunda', 'Primera']);
    expect(exported[0]?.segments).toHaveLength(1);
  });

  it('conserva la letra al exportar e importar', () => {
    const source = new Library(createMemoryStorage());
    source.save({ ...song('a', 'video-a', 'Con letra'), lyrics: 'Línea uno\nLínea dos' });
    const exported = source.exportSongs();

    const target = new Library(createMemoryStorage());
    target.importSongs(exported);

    expect(target.list()[0]?.title).toBe('Con letra');
    expect(target.exportSongs()[0]?.lyrics).toBe('Línea uno\nLínea dos');
  });

  it('añade canciones nuevas y actualiza las que comparten origen', () => {
    const library = new Library(createMemoryStorage());
    library.save(song('local', 'video-a', 'Versión antigua'));

    const result = library.importSongs([
      song('backup', 'video-a', 'Versión restaurada'),
      song('new', 'video-b', 'Canción nueva'),
    ]);

    expect(result).toEqual({ added: 1, updated: 1 });
    expect(library.list()).toHaveLength(2);
    expect(library.get('local')?.title).toBe('Versión restaurada');
    expect(library.list().some((item) => item.title === 'Canción nueva')).toBe(true);
  });

  it('resuelve colisiones de id entre canciones de distinto origen', () => {
    const library = new Library(createMemoryStorage());
    library.save(song('same-id', 'video-a', 'Original'));

    const result = library.importSongs([song('same-id', 'video-b', 'Importada')]);

    expect(result).toEqual({ added: 1, updated: 0 });
    expect(library.list()).toHaveLength(2);
    expect(library.get('same-id')?.title).toBe('Original');
    expect(library.list().some((item) => item.title === 'Importada')).toBe(true);
  });

  it('deduplica por origen dentro de la misma copia', () => {
    const library = new Library(createMemoryStorage());

    const result = library.importSongs([
      song('uno', 'video-a', 'Primera versión'),
      song('dos', 'video-a', 'Última versión'),
    ]);

    expect(result).toEqual({ added: 1, updated: 0 });
    expect(library.list()).toHaveLength(1);
    expect(library.list()[0]?.title).toBe('Última versión');
  });
});
