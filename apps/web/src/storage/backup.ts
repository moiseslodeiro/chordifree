import { t } from '../i18n';
import type { Song } from '../types';
import { isSong } from './library';

export const BACKUP_FORMAT = 'chordifree-backup';
export const BACKUP_VERSION = 1;

export interface LibraryBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  songs: Song[];
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export function createBackup(songs: Song[], now: Date = new Date()): LibraryBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    songs,
  };
}

export function serializeBackup(songs: Song[], now: Date = new Date()): string {
  return JSON.stringify(createBackup(songs, now), null, 2);
}

export function parseBackup(raw: string): Song[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new BackupError(t('backup.invalidJson'));
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new BackupError(t('backup.invalidFormat'));
  }

  const candidate = data as Record<string, unknown>;
  if (candidate.format !== BACKUP_FORMAT) {
    throw new BackupError(t('backup.invalidFormat'));
  }
  if (candidate.version !== BACKUP_VERSION) {
    throw new BackupError(
      t('backup.unsupportedVersion', { version: String(candidate.version) }),
    );
  }
  if (!Array.isArray(candidate.songs)) {
    throw new BackupError(t('backup.noSongs'));
  }

  const songs: Song[] = [];
  for (const [index, value] of candidate.songs.entries()) {
    if (!isSong(value)) {
      throw new BackupError(t('backup.invalidSong', { index: index + 1 }));
    }
    songs.push(value);
  }
  return songs;
}

export function backupFilename(now: Date = new Date()): string {
  return `chordifree-biblioteca-${now.toISOString().slice(0, 10)}.json`;
}

export function songFilename(song: Song): string {
  const base =
    song.title
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'chordifree-song';
  return `${base}.chordifree.json`;
}

function download(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Downloads the backup as JSON in the browser. */
export function downloadBackup(songs: Song[], now: Date = new Date()): void {
  download(backupFilename(now), serializeBackup(songs, now));
}

/** Downloads one song in the same format used by Import JSON. */
export function downloadSong(song: Song, now: Date = new Date()): void {
  download(songFilename(song), serializeBackup([song], now));
}
