import { Timestamp, type Firestore } from '@google-cloud/firestore';
import { GoogleAuth } from 'google-auth-library';
import { ApiError } from '../errors';

const CHUNK_BYTES = 512 * 1024;
const CHUNKS_PER_WRITE = 8;
const MAX_INPUT_CHUNKS = 128;

export interface AnalysisInputStore {
  put(jobId: string, data: Buffer): Promise<number>;
  get(jobId: string, chunkCount: number): Promise<Buffer>;
  delete(jobId: string, chunkCount: number): Promise<void>;
}

export interface AnalysisJobDispatcher {
  dispatch(jobId: string): Promise<void>;
}

/** Stores uploads as bounded Firestore documents so a Job can read them after scale-to-zero. */
export class FirestoreAnalysisInputStore implements AnalysisInputStore {
  constructor(
    private readonly firestore: Firestore,
    private readonly collection = 'chordifree_analysis_inputs',
    private readonly ttlMs = 24 * 60 * 60 * 1000,
  ) {}

  async put(jobId: string, data: Buffer): Promise<number> {
    const count = Math.ceil(data.length / CHUNK_BYTES);
    if (count < 1 || count > MAX_INPUT_CHUNKS) {
      throw new ApiError('FILE_TOO_LARGE', 'The uploaded audio exceeds the supported size');
    }

    const expiresAt = Timestamp.fromMillis(Date.now() + this.ttlMs);
    try {
      for (let offset = 0; offset < count; offset += CHUNKS_PER_WRITE) {
        const batch = this.firestore.batch();
        const end = Math.min(count, offset + CHUNKS_PER_WRITE);
        for (let index = offset; index < end; index += 1) {
          const start = index * CHUNK_BYTES;
          const ref = this.chunkRef(jobId, index);
          batch.create(ref, { data: data.subarray(start, start + CHUNK_BYTES), expiresAt });
        }
        await batch.commit();
      }
    } catch (error) {
      await this.delete(jobId, count).catch(() => undefined);
      throw error;
    }
    return count;
  }

  async get(jobId: string, chunkCount: number): Promise<Buffer> {
    if (!Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > MAX_INPUT_CHUNKS) {
      throw new ApiError('ANALYSIS_FAILED', 'The uploaded audio is unavailable');
    }
    const refs = Array.from({ length: chunkCount }, (_, index) => this.chunkRef(jobId, index));
    const snapshots = (
      await Promise.all(
        Array.from({ length: Math.ceil(refs.length / 100) }, (_, batch) =>
          this.firestore.getAll(...refs.slice(batch * 100, (batch + 1) * 100)),
        ),
      )
    ).flat();
    if (snapshots.some((snapshot) => !snapshot.exists)) {
      throw new ApiError('ANALYSIS_FAILED', 'The uploaded audio is unavailable');
    }
    return Buffer.concat(snapshots.map((snapshot) => snapshot.get('data') as Buffer));
  }

  async delete(jobId: string, chunkCount: number): Promise<void> {
    if (!Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > MAX_INPUT_CHUNKS) return;
    const batch = this.firestore.batch();
    for (let index = 0; index < chunkCount; index += 1) {
      batch.delete(this.chunkRef(jobId, index));
    }
    await batch.commit();
  }

  private chunkRef(jobId: string, index: number) {
    return this.firestore
      .collection(this.collection)
      .doc(`${jobId}_${String(index).padStart(3, '0')}`);
  }
}

/** Starts a one-off Cloud Run Job execution with only the opaque job ID override. */
export class CloudRunAnalysisJobDispatcher implements AnalysisJobDispatcher {
  private readonly accessToken: () => Promise<string | null>;

  constructor(
    private readonly projectId: string,
    private readonly region: string,
    private readonly jobName: string,
    private readonly fetchImpl: typeof fetch = fetch,
    accessToken?: () => Promise<string | null>,
  ) {
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    this.accessToken =
      accessToken ??
      (async () => {
        const client = await auth.getClient();
        const result = await client.getAccessToken();
        return typeof result === 'string' ? result : (result.token ?? null);
      });
  }

  async dispatch(jobId: string): Promise<void> {
    const token = await this.accessToken();
    if (!token) throw new ApiError('ANALYSIS_FAILED', 'Could not authenticate the analysis job');

    const url =
      `https://run.googleapis.com/v2/projects/${encodeURIComponent(this.projectId)}` +
      `/locations/${encodeURIComponent(this.region)}/jobs/${encodeURIComponent(this.jobName)}:run`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          overrides: {
            containerOverrides: [
              {
                name: 'worker',
                env: [{ name: 'ANALYSIS_JOB_ID', value: jobId }],
              },
            ],
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ApiError('ANALYSIS_FAILED', 'Could not start the analysis job');
    }
    if (!response.ok) {
      throw new ApiError('ANALYSIS_FAILED', 'Could not start the analysis job');
    }
  }
}
