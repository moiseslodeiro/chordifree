import { createHash } from 'node:crypto';
import { Timestamp, type Firestore } from '@google-cloud/firestore';
import type { AnalysisResult } from '../types';

const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface AnalysisCacheStore {
  get(videoId: string, analyzerVersion: string): Promise<AnalysisResult | null>;
  set(videoId: string, analyzerVersion: string, result: AnalysisResult): Promise<void>;
  has(videoId: string, analyzerVersion: string): Promise<boolean>;
}

function cacheId(videoId: string, analyzerVersion: string): string {
  return createHash('sha256').update(`${videoId}|${analyzerVersion}`).digest('hex');
}

/** Keeps analysis results across Cloud Run restarts and scale-to-zero. */
export class FirestoreAnalysisCache implements AnalysisCacheStore {
  constructor(
    private readonly firestore: Firestore,
    private readonly collection = 'chordifree_analysis',
    private readonly now: () => number = Date.now,
  ) {}

  async get(videoId: string, analyzerVersion: string): Promise<AnalysisResult | null> {
    try {
      const snapshot = await this.firestore
        .collection(this.collection)
        .doc(cacheId(videoId, analyzerVersion))
        .get();
      if (!snapshot.exists) return null;
      const data = snapshot.data() as
        | {
            videoId?: string;
            analyzerVersion?: string;
            result?: AnalysisResult;
            expiresAt?: Timestamp;
            updatedAt?: string;
          }
        | undefined;
      if (!data?.result) return null;
      if (data.videoId !== videoId || data.analyzerVersion !== analyzerVersion) return null;
      if (data.expiresAt && data.expiresAt.toMillis() <= this.now()) return null;
      return data.result;
    } catch (error) {
      console.warn('[analysis-cache] read failed', error instanceof Error ? error.message : error);
      return null;
    }
  }

  async set(videoId: string, analyzerVersion: string, result: AnalysisResult): Promise<void> {
    try {
      await this.firestore
        .collection(this.collection)
        .doc(cacheId(videoId, analyzerVersion))
        .set({
          videoId,
          analyzerVersion,
          result,
          updatedAt: new Date(this.now()).toISOString(),
          expiresAt: Timestamp.fromMillis(this.now() + CACHE_TTL_MS),
        });
    } catch (error) {
      console.warn('[analysis-cache] write failed', error instanceof Error ? error.message : error);
    }
  }

  async has(videoId: string, analyzerVersion: string): Promise<boolean> {
    return (await this.get(videoId, analyzerVersion)) !== null;
  }
}

/** Local mode and tests use the same interface without requiring Firestore. */
export class MemoryAnalysisCache implements AnalysisCacheStore {
  private readonly entries = new Map<string, AnalysisResult>();

  async get(videoId: string, analyzerVersion: string): Promise<AnalysisResult | null> {
    return this.entries.get(cacheId(videoId, analyzerVersion)) ?? null;
  }

  async set(videoId: string, analyzerVersion: string, result: AnalysisResult): Promise<void> {
    this.entries.set(cacheId(videoId, analyzerVersion), result);
  }

  async has(videoId: string, analyzerVersion: string): Promise<boolean> {
    return this.entries.has(cacheId(videoId, analyzerVersion));
  }
}
