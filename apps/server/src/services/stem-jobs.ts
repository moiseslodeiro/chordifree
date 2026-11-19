import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ApiError } from '../errors';
import type { TemporaryAudioCache } from './audio-cache';
import type { StemEngine } from './stems';

export type StemJobStatus = 'queued' | 'processing' | 'done' | 'error';

export interface StemJobView {
  id: string;
  videoId: string;
  status: StemJobStatus;
  stems: string[];
  error?: { code: string; message: string };
  createdAt: string;
  updatedAt: string;
}

interface StoredJob {
  view: StemJobView;
  outputDir: string;
  files: Map<string, string>;
}

const MAX_JOBS = 20;

/**
 * In-memory separation queue. Each job reads the already cached YouTube audio,
 * runs the local plugin and keeps the resulting files until the job is evicted.
 */
export class StemJobs {
  private readonly jobs = new Map<string, StoredJob>();

  constructor(
    private readonly engine: StemEngine,
    private readonly audioCache: TemporaryAudioCache,
    private readonly root: string,
    private readonly now: () => number = Date.now,
  ) {}

  async start(videoId: string): Promise<StemJobView> {
    const running = [...this.jobs.values()].find(
      (job) =>
        job.view.videoId === videoId &&
        (job.view.status === 'queued' || job.view.status === 'processing'),
    );
    if (running) return running.view;

    const cached = await this.audioCache.get(videoId);
    if (!cached) {
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
      status: 'queued',
      stems: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const outputDir = join(this.root, id);
    this.jobs.set(id, { view, outputDir, files: new Map() });
    void this.sweep();
    void this.run(id, cached.path);
    return view;
  }

  get(id: string): StemJobView | null {
    return this.jobs.get(id)?.view ?? null;
  }

  file(id: string, stem: string): string | null {
    const job = this.jobs.get(id);
    if (!job || job.view.status !== 'done') return null;
    return job.files.get(stem) ?? null;
  }

  private async run(id: string, inputPath: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;
    job.view = { ...job.view, status: 'processing', updatedAt: new Date(this.now()).toISOString() };
    try {
      const result = await this.engine.separate(inputPath, job.outputDir);
      job.files = result.stems;
      job.view = {
        ...job.view,
        status: 'done',
        stems: [...result.stems.keys()],
        updatedAt: new Date(this.now()).toISOString(),
      };
    } catch (error) {
      const apiError =
        error instanceof ApiError ? error : new ApiError('STEMS_FAILED', 'The plugin failed');
      job.view = {
        ...job.view,
        status: 'error',
        error: { code: apiError.code, message: apiError.message },
        updatedAt: new Date(this.now()).toISOString(),
      };
    }
  }

  private async sweep(): Promise<void> {
    if (this.jobs.size <= MAX_JOBS) return;
    const ordered = [...this.jobs.entries()].sort(([, a], [, b]) =>
      a.view.createdAt.localeCompare(b.view.createdAt),
    );
    for (const [id, job] of ordered.slice(0, this.jobs.size - MAX_JOBS)) {
      this.jobs.delete(id);
      await rm(job.outputDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
