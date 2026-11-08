import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Elimina directorios de trabajo antiguos que hayan quedado tras un fallo.
 * Solo toca entradas con el prefijo que crea el servicio.
 */
export async function sweepTempDirectory(
  directory: string,
  maxAgeMs = 60 * 60 * 1000,
  now: () => number = Date.now,
): Promise<number> {
  let removed = 0;
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('chordifree-')) continue;
    const path = join(directory, entry.name);
    try {
      const info = await stat(path);
      if (now() - info.mtimeMs > maxAgeMs) {
        await rm(path, { recursive: true, force: true });
        removed += 1;
      }
    } catch {
      // El directorio pudo desaparecer entre la lectura y el borrado.
    }
  }
  return removed;
}
