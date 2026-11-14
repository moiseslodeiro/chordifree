import { describe, expect, it } from 'vitest';
import { parseChord } from '@chordifree/chords';
import {
  BackupError,
  backupFilename,
  createBackup,
  parseBackup,
  parseBackupSnapshot,
  serializeBackup,
} from '../src/storage/backup';
import type { Song } from '../src/types';

function song(id = 'song-1', videoId = 'dQw4w9WgXcQ', title = 'Demo'): Song {
  return {
    id,
    title,
    source: { type: 'youtube', videoId },
    duration: 8,
    segments: [
      { start: 0, end: 4, chord: parseChord('C') },
      { start: 4, end: 8, chord: parseChord('G') },
    ],
    detectedSegments: [
      { start: 0, end: 4, chord: parseChord('C') },
      { start: 4, end: 8, chord: parseChord('G') },
    ],
    analyzerVersion: 'essentia-1.2',
    transpose: 0,
    notation: 'english',
    accidentalPreference: 'auto',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const now = new Date('2026-11-08T10:00:00.000Z');

describe('backup', () => {
  it('creates the envelope with format, version, and date', () => {
    const backup = createBackup([song()], now);
    expect(backup.format).toBe('chordifree-backup');
    expect(backup.version).toBe(1);
    expect(backup.exportedAt).toBe(now.toISOString());
    expect(backup.songs).toHaveLength(1);
  });

  it('serializes and reads back complete songs', () => {
    const songs = [song('a', 'video-a', 'Primera'), song('b', 'video-b', 'Segunda')];
    const raw = serializeBackup(songs, now);
    expect(parseBackup(raw)).toEqual(songs);
  });

  it('preserves the lyrics of each song', () => {
    const withLyrics = {
      ...song('a', 'video-a', 'Con letra'),
      lyrics: 'Primera línea\nSegunda línea',
    };
    const [restored] = parseBackup(serializeBackup([withLyrics], now));
    expect(restored?.lyrics).toBe('Primera línea\nSegunda línea');
  });

  it('rejects a file that is not JSON', () => {
    expect(() => parseBackup('{')).toThrow(BackupError);
  });

  it('rejects an incompatible format or version', () => {
    expect(() =>
      parseBackup(JSON.stringify({ format: 'otra-cosa', version: 1, songs: [] })),
    ).toThrow('no es una copia de seguridad de Chordifree');

    expect(() =>
      parseBackup(JSON.stringify({ format: 'chordifree-backup', version: 99, songs: [] })),
    ).toThrow('versión no compatible');
  });

  it('rejects songs with an invalid format', () => {
    expect(() =>
      parseBackup(
        JSON.stringify({
          format: 'chordifree-backup',
          version: 1,
          songs: [{ id: 'roto' }],
        }),
      ),
    ).toThrow('La canción 1');
  });

  it('imports songs from an older backup that still contains folders', () => {
    const raw = JSON.stringify({
      format: 'chordifree-backup',
      version: 1,
      exportedAt: now.toISOString(),
      songs: [song('a', 'video-a', 'Con carpeta')],
      folders: [
        {
          id: 'folder-1',
          name: 'Favoritas',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
    });

    const restored = parseBackupSnapshot(raw);
    expect(restored.songs).toHaveLength(1);
    expect(restored).not.toHaveProperty('folders');
  });

  it('generates a filename with the date', () => {
    expect(backupFilename(now)).toBe('chordifree-biblioteca-2026-11-08.json');
  });
});
