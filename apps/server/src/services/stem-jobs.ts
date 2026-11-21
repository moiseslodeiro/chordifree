import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ApiError } from '../errors';
import type { TemporaryAudioCache } from './audio-cache';
import type { StemCache } from './stem-cache';
import type { StemEngine, StemNote } from './stems';

export type StemJobStatus = 'queued' | 'processing' | 'done' | 'cancelled' | 'error';

export interface StemJobView {
  id: string;
  videoId: string;
  title?: string;
  status: StemJobStatus;
  stems: string[];
  /** Stems that also have transcribed notes (bass, drums…). */
  midi?: string[];
  error?: { code: string; message: string };
  createdAt: string;
  updatedAt: string;
}

interface StoredJob {
  view: StemJobView;
  outputDir: string;
  files: Map<string, string>;
  notes: Map<string, StemNote[]>;
  controller: AbortController;
  cached: boolean;
}

const MAX_JOBS = 20;

/**
 * In-memory separation queue with a persistent cache. Jobs keep running when
 * the song view is closed; they can be cancelled from the API and completed
 * results are moved into StemCache so the next visit does not separate again.
 */
export class StemJobs {
  private readonly jobs = new Map<string, StoredJob>();
  /** Requests already looking up the plugin/cache for a video. */
  private readonly starting = new Map<string, Promise<StemJobView>>();

  constructor(
    private readonly engine: StemEngine,
    private readonly audioCache: TemporaryAudioCache,
    private readonly root: string,
    private readonly cache: StemCache,
    private readonly now: () => number = Date.now,
  ) {}

  async start(videoId: string, title?: string): Promise<StemJobView> {
    const running = [...this.jobs.values()].find(
      (job) =>
        job.view.videoId === videoId &&
        (job.view.status === 'queued' || job.view.status === 'processing'),
    );
    if (running) return running.view;

    // Two tabs (or a double click) can enter here before the first request
    // creates the job. Share the lookup/creation promise per video so the
    // CPU-heavy separation only starts once.
    const pending = this.starting.get(videoId);
    if (pending) return pending;
    const promise = this.create(videoId, title).finally(() => {
      this.starting.delete(videoId);
    });
    this.starting.set(videoId, promise);
    return promise;
  }

  private async create(videoId: string, title?: string): Promise<StemJobView> {
    const status = await this.engine.status();
    const plugin = `${status.name ?? 'unknown'}@${status.version ?? '0'}`;
    const cached = await this.cache.get(videoId, plugin);
    if (cached) {
      // Every visit to a cached song used to create a new in-memory job, which
      // filled the job list with duplicates. Reuse the existing cached job.
      const previous = [...this.jobs.values()].find(
        (job) => job.view.videoId === videoId && job.view.status === 'done' && job.cached,
      );
      if (previous) return previous.view;
      const files = new Map<string, string>();
      for (const stem of cached.stems) {
        const path = this.cache.file(cached, stem);
        if (path) files.set(stem, path);
      }
      const notes = new Map<string, StemNote[]>();
      for (const stem of cached.midi) {
        notes.set(stem, (await this.cache.readNotes(cached, stem)) as StemNote[]);
      }
      const id = randomUUID();
      const view: StemJobView = {
        id,
        videoId,
        ...((cached.title ?? title) ? { title: cached.title ?? title } : {}),
        status: 'done',
        stems: [...files.keys()],
        ...(notes.size > 0 ? { midi: [...notes.keys()] } : {}),
        createdAt: cached.createdAt,
        updatedAt: cached.createdAt,
      };
      this.jobs.set(id, {
        view,
        outputDir: '',
        files,
        notes,
        controller: new AbortController(),
        cached: true,
      });
      return view;
    }

    const audio = await this.audioCache.get(videoId);
    if (!audio) {
      throw new ApiError(
        'AUDIO_NOT_READY',
        'Play the song once so its temporary audio is available before separating it',
      );
    }

    const id = randomUUID();
    const timestamp = new Date(this.now()).toISOString();
    const view: StemJobView = {
      id,
      videoId,
      ...(title ? { title } : {}),
      status: 'queued',
      stems: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const outputDir = join(this.root, id);
    this.jobs.set(id, {
      view,
      outputDir,
      files: new Map(),
      notes: new Map(),
      controller: new AbortController(),
      cached: false,
    });
    void this.sweep();
    void this.run(id, audio.path, plugin);
    return view;
  }

  get(id: string): StemJobView | null {
    return this.jobs.get(id)?.view ?? null;
  }

  list(): StemJobView[] {
    return [...this.jobs.values()]
      .map((job) => job.view)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  cancel(id: string): StemJobView | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    if (
      job.view.status === 'done' ||
      job.view.status === 'error' ||
      job.view.status === 'cancelled'
    ) {
      return job.view;
    }
    job.controller.abort();
    job.view = {
      ...job.view,
      status: 'cancelled',
      updatedAt: new Date(this.now()).toISOString(),
    };
    return job.view;
  }

  file(id: string, stem: string): string | null {
    const job = this.jobs.get(id);
    if (!job || job.view.status !== 'done') return null;
    return job.files.get(stem) ?? null;
  }

  notes(id: string, stem: string): StemNote[] | null {
    const job = this.jobs.get(id);
    if (!job || job.view.status !== 'done') return null;
    return job.notes.get(stem) ?? null;
  }

  private async run(id: string, inputPath: string, plugin: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;
    if (job.controller.signal.aborted) {
      await this.finishCancelled(job);
      return;
    }
    job.view = { ...job.view, status: 'processing', updatedAt: new Date(this.now()).toISOString() };
    try {
      const result = await this.engine.separate(inputPath, job.outputDir, job.controller.signal);
      job.files = result.stems;
      job.notes = result.notes;
      try {
        const entry = await this.cache.save({
          videoId: job.view.videoId,
          ...(job.view.title ? { title: job.view.title } : {}),
          plugin,
          sourceDir: job.outputDir,
          stems: [...result.stems.keys()],
          midi: [...result.notes.keys()],
        });
        job.cached = true;
        const files = new Map<string, string>();
        for (const stem of entry.stems) {
          const path = this.cache.file(entry, stem);
          if (path) files.set(stem, path);
        }
        job.files = files;
      } catch (error) {
        console.warn(
          '[stems] could not cache the separation',
          error instanceof Error ? error.message : error,
        );
      }
      job.view = {
        ...job.view,
        status: 'done',
        stems: [...job.files.keys()],
        ...(job.notes.size > 0 ? { midi: [...job.notes.keys()] } : {}),
        updatedAt: new Date(this.now()).toISOString(),
      };
    } catch (error) {
      if (
        job.controller.signal.aborted ||
        (error instanceof ApiError && error.code === 'STEMS_CANCELLED')
      ) {
        await this.finishCancelled(job);
        return;
      }
      const apiError =
        error instanceof ApiError ? error : new ApiError('STEMS_FAILED', 'The plugin failed');
      job.view = {
        ...job.view,
        status: 'error',
        error: { code: apiError.code, message: apiError.message },
        updatedAt: new Date(this.now()).toISOString(),
      };
      if (!job.cached) {
        await rm(job.outputDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  }

  private async finishCancelled(job: StoredJob): Promise<void> {
    job.view = {
      ...job.view,
      status: 'cancelled',
      updatedAt: new Date(this.now()).toISOString(),
    };
    if (!job.cached) {
      await rm(job.outputDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async sweep(): Promise<void> {
    if (this.jobs.size <= MAX_JOBS) return;
    const ordered = [...this.jobs.entries()].sort(([, a], [, b]) =>
      a.view.createdAt.localeCompare(b.view.createdAt),
    );
    for (const [id, job] of ordered.slice(0, this.jobs.size - MAX_JOBS)) {
      this.jobs.delete(id);
      if (!job.cached) {
        await rm(job.outputDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  }
}
