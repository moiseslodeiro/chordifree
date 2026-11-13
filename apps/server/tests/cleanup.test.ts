import { mkdir, mkdtemp, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sweepTempDirectory } from '../src/services/cleanup';

describe('sweepTempDirectory', () => {
  it('removes only old work directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'chordifree-sweep-'));
    const oldDir = join(root, 'chordifree-old');
    const newDir = join(root, 'chordifree-new');
    const otherDir = join(root, 'otro');
    await mkdir(oldDir);
    await mkdir(newDir);
    await mkdir(otherDir);

    const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await utimes(oldDir, oldDate, oldDate);

    const removed = await sweepTempDirectory(root, 60 * 60 * 1000);
    expect(removed).toBe(1);
    await expect(stat(oldDir)).rejects.toThrow();
    await expect(stat(newDir)).resolves.toBeDefined();
    await expect(stat(otherDir)).resolves.toBeDefined();
  });

  it('tolerates nonexistent directories', async () => {
    await expect(sweepTempDirectory('/ruta/que/no/existe')).resolves.toBe(0);
  });
});
