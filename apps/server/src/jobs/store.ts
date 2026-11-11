import { randomUUID } from 'node:crypto';
import type { AnalysisResult, AnalysisSource } from '../types';

export type JobStatus = 'queued' | 'processing' | 'done' | 'error';

export interface JobError {
  code: string;
  message: string;
}

export interface Job {
  id: string;
  status: JobStatus;
  progress: number;
  source: AnalysisSource;
  createdAt: number;
  updatedAt: number;
  result?: AnalysisResult;
  error?: JobError;
}

export interface JobView {
  id: string;
  status: JobStatus;
  progress: number;
  source: AnalysisSource;
  result?: AnalysisResult;
  error?: JobError;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface VideoIndexEntry {
  jobId: string;
  expiresAt: number;
  analyzerVersion: string;
}

export class JobStore {
  private readonly jobs = new Map<string, Job>();
  private readonly videoIndex = new Map<string, VideoIndexEntry>();

  constructor(
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  create(source: AnalysisSource): Job {
    const timestamp = this.now();
    const job: Job = {
      id: randomUUID(),
      status: 'queued',
      progress: 0,
      source,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  update(id: string, patch: Partial<Omit<Job, 'id' | 'createdAt'>>): Job | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    Object.assign(job, patch, { updatedAt: this.now() });
    return job;
  }

  findByVideo(videoId: string, analyzerVersion: string): Job | undefined {
    const entry = this.videoIndex.get(videoId);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.videoIndex.delete(videoId);
      return undefined;
    }
    const job = this.jobs.get(entry.jobId);
    if (!job || job.status !== 'done') return undefined;
    if (entry.analyzerVersion !== analyzerVersion) return undefined;
    if (job.result?.analyzerVersion !== analyzerVersion) return undefined;
    return job;
  }

  indexVideo(videoId: string, jobId: string, analyzerVersion: string): void {
    this.videoIndex.set(videoId, {
      jobId,
      expiresAt: this.now() + this.ttlMs,
      analyzerVersion,
    });
  }

  toView(job: Job): JobView {
    const view: JobView = {
      id: job.id,
      status: job.status,
      progress: job.progress,
      source: job.source,
    };
    if (job.result) view.result = job.result;
    if (job.error) view.error = job.error;
    return view;
  }

  remove(id: string): boolean {
    const removed = this.jobs.delete(id);
    if (removed) {
      for (const [videoId, entry] of this.videoIndex) {
        if (entry.jobId === id) this.videoIndex.delete(videoId);
      }
    }
    return removed;
  }

  sweep(): number {
    const now = this.now();
    let removed = 0;
    for (const [id, job] of this.jobs) {
      if (job.updatedAt + this.ttlMs <= now) {
        this.jobs.delete(id);
        removed += 1;
      }
    }
    for (const [videoId, entry] of this.videoIndex) {
      if (entry.expiresAt <= now) this.videoIndex.delete(videoId);
    }
    return removed;
  }

  clear(): void {
    this.jobs.clear();
    this.videoIndex.clear();
  }
}
