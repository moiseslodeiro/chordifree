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
    throw new BackupError('El archivo no es un JSON válido.');
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new BackupError('El archivo no tiene el formato de una copia de Chordifree.');
  }

  const candidate = data as Record<string, unknown>;
  if (candidate.format !== BACKUP_FORMAT) {
    throw new BackupError('El archivo no es una copia de seguridad de Chordifree.');
  }
  if (candidate.version !== BACKUP_VERSION) {
    throw new BackupError(
      `La copia usa una versión no compatible (${String(candidate.version)}).`,
    );
  }
  if (!Array.isArray(candidate.songs)) {
    throw new BackupError('La copia no contiene una lista de canciones.');
  }

  const songs: Song[] = [];
  for (const [index, value] of candidate.songs.entries()) {
    if (!isSong(value)) {
      throw new BackupError(`La canción ${index + 1} de la copia no tiene un formato válido.`);
    }
    songs.push(value);
  }
  return songs;
}

export function backupFilename(now: Date = new Date()): string {
  return `chordifree-biblioteca-${now.toISOString().slice(0, 10)}.json`;
}

/** Descarga la copia como JSON en el navegador. */
export function downloadBackup(songs: Song[], now: Date = new Date()): void {
  const blob = new Blob([serializeBackup(songs, now)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = backupFilename(now);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
