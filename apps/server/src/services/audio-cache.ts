import { copyFile, mkdir, mkdtemp, readdir, rename, rm, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { ApiError } from '../errors';
import { isVideoId } from '../youtube';
import type { MediaTools } from './media';

const MAX_ENTRIES = 12;

const CONTENT_TYPES: Record<string, string> = {
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.webm': 'audio/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
};

export interface CachedAudio {
  path: string;
  contentType: string;
  expiresAt: number;
}

export interface TemporaryAudioCacheOptions {
  /** Directory where the media files are kept. */
  directory: string;
  /** Directory used for the temporary download workspace. */
  workspaceRoot: string;
  ttlMs: number;
  tools: Pick<MediaTools, 'downloadYoutube'>;
  now?: () => number;
  maxEntries?: number;
}

/**
 * Keeps the audio of analyzed YouTube videos for a short time so the player
 * can transpose it without downloading the video again. Files are served by
 * the API and removed after the TTL or when the cache grows too much.
 */
export class TemporaryAudioCache {
  private readonly inflight = new Map<string, Promise<CachedAudio>>();
  private readonly now: () => number;
  private readonly maxEntries: number;

  constructor(private readonly options: TemporaryAudioCacheOptions) {
    this.now = options.now ?? Date.now;
    this.maxEntries = options.maxEntries ?? MAX_ENTRIES;
  }

  get directory(): string {
    return this.options.directory;
  }

  /** Returns the cached audio or downloads it on demand. */
  async prepare(videoId: string): Promise<CachedAudio> {
    assertVideoId(videoId);
    const cached = await this.get(videoId);
    if (cached) return cached;

    const pending = this.inflight.get(videoId);
    if (pending) return pending;

    const task = this.downloadAndStore(videoId).finally(() => this.inflight.delete(videoId));
    this.inflight.set(videoId, task);
    return task;
  }

  /** Moves or copies a downloaded file into the cache. */
  async store(videoId: string, source: string): Promise<CachedAudio> {
    assertVideoId(videoId);
    await mkdir(this.options.directory, { recursive: true });
    const extension = extname(source).toLowerCase() || '.m4a';
    const target = join(this.options.directory, `${videoId}${extension}`);
    await this.removeOtherFiles(videoId, target);
    if (target !== source) {
      try {
        await rename(source, target);
      } catch {
        await copyFile(source, target);
        await rm(source, { force: true });
      }
    }
    await this.enforceLimit();
    const info = await stat(target);
    return {
      path: target,
      contentType: CONTENT_TYPES[extension] ?? 'application/octet-stream',
      expiresAt: info.mtimeMs + this.options.ttlMs,
    };
  }

  /** Returns a non-expired entry, removing stale files on the way. */
  async get(videoId: string): Promise<CachedAudio | null> {
    assertVideoId(videoId);
    const path = await this.find(videoId);
    if (!path) return null;
    try {
      const info = await stat(path);
      if (this.now() - info.mtimeMs > this.options.ttlMs) {
        await rm(path, { force: true });
        return null;
      }
      return {
        path,
        contentType: CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
        expiresAt: info.mtimeMs + this.options.ttlMs,
      };
    } catch {
      return null;
    }
  }

  /** Removes expired files and trims the cache to its maximum size. */
  async sweep(): Promise<number> {
    return sweepAudioCache(
      this.options.directory,
      this.options.ttlMs,
      this.now,
      this.maxEntries,
    );
  }

  private async downloadAndStore(videoId: string): Promise<CachedAudio> {
    await mkdir(this.options.workspaceRoot, { recursive: true });
    const workspace = await mkdtemp(join(this.options.workspaceRoot, 'chordifree-audio-'));
    try {
      const downloaded = await this.options.tools.downloadYoutube(videoId, workspace);
      return await this.store(videoId, downloaded);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }

  private async find(videoId: string): Promise<string | null> {
    try {
      const entries = await readdir(this.options.directory);
      const match = entries.find((entry) => entry.startsWith(`${videoId}.`));
      return match ? join(this.options.directory, match) : null;
    } catch {
      return null;
    }
  }

  private async removeOtherFiles(videoId: string, keep: string): Promise<void> {
    try {
      const entries = await readdir(this.options.directory);
      await Promise.all(
        entries
          .filter((entry) => entry.startsWith(`${videoId}.`) && join(this.options.directory, entry) !== keep)
          .map((entry) => rm(join(this.options.directory, entry), { force: true })),
      );
    } catch {
      // Nothing to remove.
    }
  }

  private async enforceLimit(): Promise<void> {
    await this.sweep();
  }
}

export function audioCacheDirectory(tempDir: string): string {
  return join(tempDir, 'audio-cache');
}

/** Removes expired audio files and trims the cache to `maxEntries`. */
export async function sweepAudioCache(
  directory: string,
  ttlMs: number,
  now: () => number = Date.now,
  maxEntries = MAX_ENTRIES,
): Promise<number> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return 0;
  }

  let removed = 0;
  const files: Array<{ path: string; mtimeMs: number }> = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const videoId = entry.name.split('.')[0] ?? '';
    if (!isVideoId(videoId)) continue;
    const path = join(directory, entry.name);
    try {
      const info = await stat(path);
      if (now() - info.mtimeMs > ttlMs) {
        await rm(path, { force: true });
        removed += 1;
      } else {
        files.push({ path, mtimeMs: info.mtimeMs });
      }
    } catch {
      // The file may have disappeared between reading and deleting.
    }
  }

  files.sort((a, b) => a.mtimeMs - b.mtimeMs);
  for (const file of files.slice(0, Math.max(0, files.length - maxEntries))) {
    await rm(file.path, { force: true });
    removed += 1;
  }
  return removed;
}

function assertVideoId(videoId: string): void {
  if (!isVideoId(videoId)) {
    throw new ApiError('INVALID_REQUEST', 'The video ID format is invalid');
  }
}
