import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export interface StemCacheEntry {
  key: string;
  videoId: string;
  title?: string;
  plugin: string;
  stems: string[];
  midi: string[];
  /** stem -> file name inside the entry directory. */
  files: Record<string, string>;
  /** stem -> notes file name inside the entry directory. */
  notes: Record<string, string>;
  createdAt: string;
  bytes: number;
}

interface CacheIndex {
  entries: StemCacheEntry[];
}

/**
 * Persistent, local-only cache of separated stems. It survives server restarts
 * and is only written when a plugin is configured, so hosted instances never
 * accumulate audio.
 */
export class StemCache {
  private entries = new Map<string, StemCacheEntry>();
  private loaded = false;

  constructor(
    private readonly root: string,
    private readonly maxEntries = 20,
    private readonly maxBytes = 2 * 1024 * 1024 * 1024,
  ) {}

  async list(): Promise<StemCacheEntry[]> {
    await this.load();
    return [...this.entries.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(videoId: string, plugin?: string): Promise<StemCacheEntry | null> {
    const entries = await this.list();
    const match = entries.find(
      (entry) => entry.videoId === videoId && (!plugin || entry.plugin === plugin),
    );
    return match ?? null;
  }

  file(entry: StemCacheEntry, stem: string): string | null {
    const name = entry.files[stem];
    return name ? join(this.root, entry.key, name) : null;
  }

  notesFile(entry: StemCacheEntry, stem: string): string | null {
    const name = entry.notes[stem];
    return name ? join(this.root, entry.key, name) : null;
  }

  async readNotes(entry: StemCacheEntry, stem: string): Promise<unknown[]> {
    const path = this.notesFile(entry, stem);
    if (!path) return [];
    try {
      const parsed = JSON.parse(await readFile(path, 'utf8')) as { notes?: unknown[] };
      return Array.isArray(parsed.notes) ? parsed.notes : [];
    } catch {
      return [];
    }
  }

  async save(input: {
    videoId: string;
    title?: string;
    plugin: string;
    sourceDir: string;
    stems: string[];
    midi: string[];
  }): Promise<StemCacheEntry> {
    await this.load();
    const key = createHash('sha256')
      .update(`${input.videoId}|${input.plugin}`)
      .digest('hex')
      .slice(0, 16);
    const dir = join(this.root, key);
    await mkdir(this.root, { recursive: true });
    await rm(dir, { recursive: true, force: true });
    await rename(resolve(input.sourceDir), dir);

    const names = await readdir(dir);
    const files: Record<string, string> = {};
    for (const stem of input.stems) {
      const name = names.find(
        (candidate) => candidate.startsWith(`${stem}.`) && !candidate.endsWith('.notes.json'),
      );
      if (name) files[stem] = name;
    }
    const notes: Record<string, string> = {};
    for (const stem of input.midi) {
      const name = `${stem}.notes.json`;
      if (names.includes(name)) notes[stem] = name;
    }
    let bytes = 0;
    for (const name of names) {
      const info = await stat(join(dir, name)).catch(() => null);
      if (info) bytes += info.size;
    }

    const entry: StemCacheEntry = {
      key,
      videoId: input.videoId,
      ...(input.title ? { title: input.title } : {}),
      plugin: input.plugin,
      stems: input.stems.filter((stem) => files[stem]),
      midi: input.midi.filter((stem) => notes[stem]),
      files,
      notes,
      createdAt: new Date().toISOString(),
      bytes,
    };
    this.entries.set(key, entry);
    await this.persist();
    await this.evict();
    return entry;
  }

  async remove(videoId: string): Promise<number> {
    await this.load();
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (entry.videoId !== videoId) continue;
      this.entries.delete(key);
      await rm(join(this.root, key), { recursive: true, force: true }).catch(() => undefined);
      removed += 1;
    }
    if (removed > 0) await this.persist();
    return removed;
  }

  async clear(): Promise<number> {
    await this.load();
    const removed = this.entries.size;
    this.entries.clear();
    await rm(this.root, { recursive: true, force: true }).catch(() => undefined);
    return removed;
  }

  async bytes(): Promise<number> {
    const entries = await this.list();
    return entries.reduce((total, entry) => total + entry.bytes, 0);
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await readFile(join(this.root, 'index.json'), 'utf8');
      const index = JSON.parse(raw) as CacheIndex;
      if (Array.isArray(index.entries)) {
        for (const entry of index.entries) {
          const exists = await access(join(this.root, entry.key)).then(
            () => true,
            () => false,
          );
          if (exists) this.entries.set(entry.key, entry);
        }
      }
    } catch {
      // No index yet.
    }
  }

  private async persist(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const index: CacheIndex = { entries: [...this.entries.values()] };
    await writeFile(join(this.root, 'index.json'), JSON.stringify(index));
  }

  private async evict(): Promise<void> {
    const ordered = [...this.entries.values()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    let total = ordered.reduce((sum, entry) => sum + entry.bytes, 0);
    while (
      ordered.length > 0 &&
      (ordered.length > this.maxEntries || total > this.maxBytes) &&
      ordered.length > 1
    ) {
      const oldest = ordered.shift()!;
      this.entries.delete(oldest.key);
      total -= oldest.bytes;
      await rm(join(this.root, oldest.key), { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
    await this.persist();
  }
}
