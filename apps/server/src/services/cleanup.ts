import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Removes old working directories left behind after a failure.
 * Only touches entries with the prefix created by the service.
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
      // The directory may have disappeared between reading and deleting.
    }
  }
  return removed;
}
