import { describe, expect, it } from 'vitest';
import type { Firestore } from '@google-cloud/firestore';
import {
  CloudRunAnalysisJobDispatcher,
  FirestoreAnalysisInputStore,
} from '../src/services/cloud-run-analysis';

interface FakeReference {
  path: string;
}

class FakeFirestore {
  readonly documents = new Map<string, Record<string, unknown>>();

  collection(name: string) {
    return {
      doc: (id: string) => ({ path: `${name}/${id}` }),
    };
  }

  batch() {
    const operations: Array<() => void> = [];
    const batch = {
      create: (ref: FakeReference, data: Record<string, unknown>) => {
        operations.push(() => {
          if (this.documents.has(ref.path)) throw new Error('document already exists');
          this.documents.set(ref.path, data);
        });
        return batch;
      },
      delete: (ref: FakeReference) => {
        operations.push(() => this.documents.delete(ref.path));
        return batch;
      },
      commit: async () => {
        operations.forEach((operation) => operation());
      },
    };
    return batch;
  }

  async getAll(...refs: FakeReference[]) {
    return refs.map((ref) => {
      const data = this.documents.get(ref.path);
      return {
        exists: data !== undefined,
        get: (field: string) => data?.[field],
      };
    });
  }
}

describe('FirestoreAnalysisInputStore', () => {
  it('round-trips chunked upload data and removes it afterwards', async () => {
    const firestore = new FakeFirestore();
    const store = new FirestoreAnalysisInputStore(firestore as unknown as Firestore);
    const payload = Buffer.alloc(1024 * 1024 + 37, 42);

    const chunks = await store.put('job-id', payload);
    expect(chunks).toBe(3);
    await expect(store.get('job-id', chunks)).resolves.toEqual(payload);

    await store.delete('job-id', chunks);
    await expect(store.get('job-id', chunks)).rejects.toMatchObject({
      code: 'ANALYSIS_FAILED',
    });
  });
});

describe('CloudRunAnalysisJobDispatcher', () => {
  it('starts a Job with only the analysis ID override', async () => {
    let requestedUrl = '';
    let requestInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      requestedUrl = String(input);
      requestInit = init;
      return new Response('{"name":"operation"}', { status: 200 });
    };
    const dispatcher = new CloudRunAnalysisJobDispatcher(
      'demo-project',
      'europe-west1',
      'chordifree-analysis',
      fetchImpl,
      async () => 'access-token',
    );

    await dispatcher.dispatch('123e4567-e89b-12d3-a456-426614174000');

    expect(requestedUrl).toBe(
      'https://run.googleapis.com/v2/projects/demo-project/locations/europe-west1/jobs/chordifree-analysis:run',
    );
    expect(requestInit?.headers).toMatchObject({ Authorization: 'Bearer access-token' });
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      overrides: {
        containerOverrides: [
          {
            name: 'worker',
            env: [{ name: 'ANALYSIS_JOB_ID', value: '123e4567-e89b-12d3-a456-426614174000' }],
          },
        ],
      },
    });
  });
});
