import { randomUUID } from 'node:crypto';
import { Timestamp, type Firestore } from '@google-cloud/firestore';
import type { AnalysisResult, AnalysisSource } from '../types';

export type JobStatus = 'queued' | 'processing' | 'done' | 'error';

export interface JobError {
  code: string;
  message: string;
}

export interface JobRequester {
  uid: string;
  email: string;
  nickname: string;
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
  requestedBy?: JobRequester;
  /** Number of temporary Firestore chunks for an uploaded source. */
  inputChunkCount?: number;
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

export interface AnalysisJobStore {
  create(source: AnalysisSource, requestedBy?: JobRequester): Promise<Job>;
  get(id: string): Promise<Job | undefined>;
  update(id: string, patch: Partial<Omit<Job, 'id' | 'createdAt'>>): Promise<Job | undefined>;
  findByVideo(videoId: string, analyzerVersion: string): Promise<Job | undefined>;
  indexVideo(videoId: string, jobId: string, analyzerVersion: string): Promise<void>;
  toView(job: Job): JobView;
  remove(id: string): Promise<boolean>;
  sweep(): Promise<number>;
}

interface VideoIndexEntry {
  jobId: string;
  expiresAt: number;
  analyzerVersion: string;
}

export class JobStore implements AnalysisJobStore {
  private readonly jobs = new Map<string, Job>();
  private readonly videoIndex = new Map<string, VideoIndexEntry>();

  constructor(
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  async create(source: AnalysisSource, requestedBy?: JobRequester): Promise<Job> {
    const timestamp = this.now();
    const job: Job = {
      id: randomUUID(),
      status: 'queued',
      progress: 0,
      source,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(requestedBy ? { requestedBy } : {}),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async get(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async update(
    id: string,
    patch: Partial<Omit<Job, 'id' | 'createdAt'>>,
  ): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    Object.assign(job, patch, { updatedAt: this.now() });
    return job;
  }

  async findByVideo(videoId: string, analyzerVersion: string): Promise<Job | undefined> {
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

  async indexVideo(videoId: string, jobId: string, analyzerVersion: string): Promise<void> {
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

  async remove(id: string): Promise<boolean> {
    const removed = this.jobs.delete(id);
    if (removed) {
      for (const [videoId, entry] of this.videoIndex) {
        if (entry.jobId === id) this.videoIndex.delete(videoId);
      }
    }
    return removed;
  }

  async sweep(): Promise<number> {
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

/** Firestore-backed state survives Cloud Run scaling to zero and job workers. */
export class FirestoreAnalysisJobStore implements AnalysisJobStore {
  constructor(
    private readonly firestore: Firestore,
    private readonly collection = 'chordifree_analysis_jobs',
    private readonly ttlMs = DEFAULT_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  async create(source: AnalysisSource, requestedBy?: JobRequester): Promise<Job> {
    const timestamp = this.now();
    const job: Job = {
      id: randomUUID(),
      status: 'queued',
      progress: 0,
      source,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(requestedBy ? { requestedBy } : {}),
    };
    await this.ref(job.id).create(this.toDocument(job));
    return job;
  }

  async get(id: string): Promise<Job | undefined> {
    const snapshot = await this.ref(id).get();
    return snapshot.exists ? (snapshot.data() as Job) : undefined;
  }

  async update(
    id: string,
    patch: Partial<Omit<Job, 'id' | 'createdAt'>>,
  ): Promise<Job | undefined> {
    const ref = this.ref(id);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return undefined;
      const current = snapshot.data() as Job;
      const updated: Job = { ...current, ...patch, updatedAt: this.now() };
      transaction.set(ref, this.toDocument(updated));
      return updated;
    });
  }

  async findByVideo(videoId: string, analyzerVersion: string): Promise<Job | undefined> {
    const snapshot = await this.firestore
      .collection(this.collection)
      .where('videoId', '==', videoId)
      .limit(20)
      .get();
    const jobs = snapshot.docs
      .map((doc) => doc.data() as Job)
      .filter((job) => job.status === 'done' && job.result?.analyzerVersion === analyzerVersion)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return jobs[0];
  }

  async indexVideo(_videoId: string, _jobId: string, _analyzerVersion: string): Promise<void> {
    // Firestore jobs are discoverable by their indexed videoId field.
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

  async remove(id: string): Promise<boolean> {
    const ref = this.ref(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return false;
    await ref.delete();
    return true;
  }

  async sweep(): Promise<number> {
    // Firestore TTL deletes expired records asynchronously.
    return 0;
  }

  private ref(id: string) {
    return this.firestore.collection(this.collection).doc(id);
  }

  private toDocument(job: Job): Record<string, unknown> {
    return {
      ...job,
      ...(job.source.type === 'youtube' ? { videoId: job.source.videoId } : {}),
      expiresAt: Timestamp.fromMillis(job.updatedAt + this.ttlMs),
    };
  }
}
