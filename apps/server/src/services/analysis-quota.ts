import { Timestamp, type Firestore } from '@google-cloud/firestore';

/** Per-user daily budget for hosted analyses. Local mode never uses it. */
export interface AnalysisQuota {
  consume(uid: string): Promise<boolean>;
}

export function utcDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** In-memory quota for tests and single-process deployments. */
export class MemoryAnalysisQuota implements AnalysisQuota {
  private readonly counts = new Map<string, { day: string; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async consume(uid: string): Promise<boolean> {
    if (this.limit <= 0) return true;
    const day = utcDayKey(this.now());
    const entry = this.counts.get(uid);
    if (!entry || entry.day !== day) {
      this.counts.set(uid, { day, count: 1 });
      return true;
    }
    if (entry.count >= this.limit) return false;
    entry.count += 1;
    return true;
  }
}

/** Firestore quota doc per user, reset by UTC day. It survives scale-to-zero. */
export class FirestoreAnalysisQuota implements AnalysisQuota {
  constructor(
    private readonly firestore: Firestore,
    private readonly limit: number,
    private readonly collection = 'chordifree_analysis_quota',
    private readonly ttlMs = 48 * 60 * 60 * 1000,
  ) {}

  async consume(uid: string): Promise<boolean> {
    if (this.limit <= 0) return true;
    const ref = this.firestore.collection(this.collection).doc(uid);
    const day = utcDayKey();
    const expiresAt = Timestamp.fromMillis(Date.now() + this.ttlMs);

    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const stored = snapshot.exists ? snapshot.data() : null;
      const count = stored?.day === day ? Number(stored.count ?? 0) : 0;
      if (count >= this.limit) return false;
      transaction.set(ref, { day, count: count + 1, expiresAt }, { merge: true });
      return true;
    });
  }
}
