import { mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TemporaryAudioCache, sweepAudioCache } from '../src/services/audio-cache';

const VIDEO = 'dQw4w9WgXcQ';

async function makeRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'chordifree-cache-'));
}

function makeCache(
  root: string,
  overrides: Partial<ConstructorParameters<typeof TemporaryAudioCache>[0]> = {},
) {
  let downloads = 0;
  const cache = new TemporaryAudioCache({
    directory: join(root, 'audio-cache'),
    workspaceRoot: root,
    ttlMs: 60_000,
    tools: {
      downloadYoutube: async (videoId, directory) => {
        downloads += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        const path = join(directory, `${videoId}.m4a`);
        await writeFile(path, `audio-${videoId}`);
        return path;
      },
    },
    maxEntries: 12,
    ...overrides,
  });
  return { cache, downloads: () => downloads };
}

describe('TemporaryAudioCache', () => {
  it('downloads the audio once and reuses it', async () => {
    const root = await makeRoot();
    const { cache, downloads } = makeCache(root);

    const first = await cache.prepare(VIDEO);
    expect(first.contentType).toBe('audio/mp4');
    expect(await readFile(first.path, 'utf8')).toBe(`audio-${VIDEO}`);

    const second = await cache.prepare(VIDEO);
    expect(second.path).toBe(first.path);
    expect(downloads()).toBe(1);
  });

  it('shares a download between concurrent requests', async () => {
    const root = await makeRoot();
    const { cache, downloads } = makeCache(root);

    const [first, second] = await Promise.all([cache.prepare(VIDEO), cache.prepare(VIDEO)]);
    expect(first.path).toBe(second.path);
    expect(downloads()).toBe(1);
  });

  it('downloads again after the entry expires', async () => {
    const root = await makeRoot();
    let now = Date.now();
    const { cache, downloads } = makeCache(root, {
      ttlMs: 1000,
      now: () => now,
    });

    const first = await cache.prepare(VIDEO);
    now += 5000;
    expect(await cache.get(VIDEO)).toBeNull();
    now = Date.now();

    const second = await cache.prepare(VIDEO);
    expect(second.path).toBe(first.path);
    expect(downloads()).toBe(2);
  });

  it('moves a downloaded file into the cache with its content type', async () => {
    const root = await makeRoot();
    const { cache } = makeCache(root);
    const source = join(root, 'downloaded.webm');
    await writeFile(source, 'temporary');

    const entry = await cache.store(VIDEO, source);
    expect(entry.contentType).toBe('audio/webm');
    expect(await readFile(entry.path, 'utf8')).toBe('temporary');
    await expect(stat(source)).rejects.toThrow();
  });

  it('keeps only the newest entries', async () => {
    const root = await makeRoot();
    const { cache } = makeCache(root, { maxEntries: 1 });

    await cache.prepare(VIDEO);
    await cache.prepare('abcdefghijk');
    const entries = await readdir(join(root, 'audio-cache'));
    expect(entries).toHaveLength(1);
  });

  it('sweeps expired files', async () => {
    const root = await makeRoot();
    const { cache } = makeCache(root);
    const entry = await cache.prepare(VIDEO);
    const removed = await sweepAudioCache(join(root, 'audio-cache'), 1000, () => Date.now() + 5000);
    expect(removed).toBe(1);
    await expect(stat(entry.path)).rejects.toThrow();
  });

  it('reports the disk usage and clears every file', async () => {
    const root = await makeRoot();
    const { cache } = makeCache(root, { ttlMs: 120_000 });
    await cache.prepare(VIDEO);
    await cache.prepare('abcdefghijk');

    const stats = await cache.stats();
    expect(stats).toEqual({ entries: 2, bytes: 34, ttlMinutes: 2 });

    expect(await cache.clear()).toBe(2);
    expect(await cache.stats()).toEqual({ entries: 0, bytes: 0, ttlMinutes: 2 });
  });

  it('rejects invalid video identifiers', async () => {
    const root = await makeRoot();
    const { cache } = makeCache(root);
    await expect(cache.prepare('../escape')).rejects.toThrow('video ID');
  });
});
