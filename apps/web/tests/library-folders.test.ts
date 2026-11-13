import { describe, expect, it } from 'vitest';
import { parseChord } from '@chordifree/chords';
import { createMemoryStorage } from '../src/storage/keys';
import { Library } from '../src/storage/library';
import type { Folder, Song } from '../src/types';

function song(id: string, title: string, folderId?: string): Song {
  return {
    id,
    title,
    ...(folderId ? { folderId } : {}),
    source: { type: 'youtube', videoId: `video-${id}` },
    duration: 8,
    segments: [{ start: 0, end: 8, chord: parseChord('C') }],
    detectedSegments: [{ start: 0, end: 8, chord: parseChord('C') }],
    analyzerVersion: 'essentia-test',
    transpose: 0,
    notation: 'english',
    accidentalPreference: 'auto',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function folder(id: string, name: string): Folder {
  return {
    id,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('library folders', () => {
  it('creates, renames and deletes folders', () => {
    const library = new Library(createMemoryStorage());
    const created = library.createFolder('  Favoritas  ');
    expect(created.name).toBe('Favoritas');
    expect(library.listFolders()).toEqual([created]);

    const renamed = library.renameFolder(created.id, 'Ensayos');
    expect(renamed?.name).toBe('Ensayos');
    expect(library.listFolders()[0]?.name).toBe('Ensayos');

    expect(library.deleteFolder(created.id)).toBe(true);
    expect(library.listFolders()).toEqual([]);
  });

  it('moves songs between folders and keeps the id', () => {
    const library = new Library(createMemoryStorage());
    const favorites = library.createFolder('Favoritas');
    library.save(song('a', 'Primera'));

    expect(library.moveSong('a', favorites.id)).toBe(true);
    expect(library.get('a')?.folderId).toBe(favorites.id);
    expect(library.list()[0]?.folderId).toBe(favorites.id);

    expect(library.moveSong('a', null)).toBe(true);
    expect(library.get('a')?.folderId).toBeUndefined();
    expect(library.list()[0]?.folderId).toBeUndefined();
  });

  it('deleting a folder moves its songs to no folder', () => {
    const library = new Library(createMemoryStorage());
    const folderA = library.createFolder('Favoritas');
    library.save(song('a', 'Primera', folderA.id));
    library.save(song('b', 'Segunda', folderA.id));

    expect(library.deleteFolder(folderA.id)).toBe(true);
    expect(library.listFolders()).toEqual([]);
    expect(library.get('a')?.folderId).toBeUndefined();
    expect(library.get('b')?.folderId).toBeUndefined();
    expect(library.list()).toHaveLength(2);
  });

  it('restores folders and their songs from a snapshot', () => {
    const target = new Library(createMemoryStorage());
    const folderA = folder('folder-a', 'Favoritas');

    const result = target.importSnapshot({
      songs: [song('a', 'Primera', folderA.id), song('b', 'Sin carpeta')],
      folders: [folderA],
    });

    expect(result).toEqual({ added: 2, updated: 0 });
    expect(target.listFolders()).toEqual([folderA]);
    expect(target.get('a')?.folderId).toBe(folderA.id);
    expect(target.get('b')?.folderId).toBeUndefined();
  });

  it('ignores folderId when the folder does not exist', () => {
    const library = new Library(createMemoryStorage());
    library.importSongs([song('a', 'Huérfana', 'missing-folder')]);
    expect(library.get('a')?.folderId).toBeUndefined();
  });
});
