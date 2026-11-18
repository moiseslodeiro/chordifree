import { randomUUID } from 'node:crypto';
import { Timestamp, type Firestore } from '@google-cloud/firestore';
import type { AnalysisLogEntry } from '@chordifree/contracts';

const LOG_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;

export type NewAnalysisLogEntry = Omit<AnalysisLogEntry, 'id' | 'createdAt'> & {
  createdAt?: string;
};

export interface AnalysisLogStore {
  record(entry: NewAnalysisLogEntry): Promise<void>;
  list(limit: number): Promise<AnalysisLogEntry[]>;
  /** Account deletion removes that user's activity entries. */
  removeByUid(uid: string): Promise<void>;
}

export class MemoryAnalysisLogStore implements AnalysisLogStore {
  private readonly entries: AnalysisLogEntry[] = [];

  async record(entry: NewAnalysisLogEntry): Promise<void> {
    this.entries.unshift({
      ...entry,
      id: randomUUID(),
      createdAt: entry.createdAt ?? new Date().toISOString(),
    });
    this.entries.splice(MAX_ENTRIES);
  }

  async list(limit: number): Promise<AnalysisLogEntry[]> {
    return this.entries.slice(0, clampLimit(limit));
  }

  async removeByUid(uid: string): Promise<void> {
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      if (this.entries[index]?.uid === uid) this.entries.splice(index, 1);
    }
  }
}

export class FirestoreAnalysisLogStore implements AnalysisLogStore {
  constructor(
    private readonly firestore: Firestore,
    private readonly collection = 'chordifree_analysis_log',
    private readonly now: () => number = Date.now,
  ) {}

  async record(entry: NewAnalysisLogEntry): Promise<void> {
    try {
      const createdAt = entry.createdAt ?? new Date(this.now()).toISOString();
      await this.firestore
        .collection(this.collection)
        .doc(randomUUID())
        .set({
          ...entry,
          createdAt,
          expiresAt: Timestamp.fromMillis(this.now() + LOG_TTL_MS),
        });
    } catch (error) {
      // The analysis already finished; logging is best-effort.
      console.warn('[analysis-log] write failed', error instanceof Error ? error.message : error);
    }
  }

  async removeByUid(uid: string): Promise<void> {
    const entries = await this.firestore.collection(this.collection).where('uid', '==', uid).get();
    for (let index = 0; index < entries.docs.length; index += 400) {
      const batch = this.firestore.batch();
      for (const doc of entries.docs.slice(index, index + 400)) batch.delete(doc.ref);
      await batch.commit();
    }
  }

  async list(limit: number): Promise<AnalysisLogEntry[]> {
    const snapshot = await this.firestore
      .collection(this.collection)
      .orderBy('createdAt', 'desc')
      .limit(clampLimit(limit))
      .get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: String(data.uid ?? ''),
        email: String(data.email ?? ''),
        nickname: String(data.nickname ?? ''),
        kind: (data.kind ?? 'upload') as AnalysisLogEntry['kind'],
        ...(typeof data.videoId === 'string' ? { videoId: data.videoId } : {}),
        ...(typeof data.filename === 'string' ? { filename: data.filename } : {}),
        ...(typeof data.title === 'string' ? { title: data.title } : {}),
        duration: typeof data.duration === 'number' ? data.duration : 0,
        chords: typeof data.chords === 'number' ? data.chords : 0,
        analyzerVersion: String(data.analyzerVersion ?? ''),
        createdAt: String(data.createdAt ?? ''),
      };
    });
  }
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 100;
  return Math.max(1, Math.min(200, Math.trunc(limit)));
}
