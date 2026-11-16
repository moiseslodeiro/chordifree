import type { Firestore } from '@google-cloud/firestore';
import { ApiError } from '../errors';

export interface CloudLibraryData {
  songs: Array<Record<string, unknown>>;
  setlists: Array<Record<string, unknown>>;
}

export interface CloudLibraryStore {
  load(uid: string): Promise<CloudLibraryData>;
  replace(uid: string, data: CloudLibraryData): Promise<void>;
  clear(uid: string): Promise<{ songs: number; setlists: number }>;
}

export class MemoryCloudLibraryStore implements CloudLibraryStore {
  private readonly users = new Map<string, CloudLibraryData>();

  async load(uid: string): Promise<CloudLibraryData> {
    const data = this.users.get(uid);
    return data
      ? { songs: [...data.songs], setlists: [...data.setlists] }
      : { songs: [], setlists: [] };
  }

  async replace(uid: string, data: CloudLibraryData): Promise<void> {
    this.users.set(uid, {
      songs: [...data.songs],
      setlists: [...data.setlists],
    });
  }

  async clear(uid: string): Promise<{ songs: number; setlists: number }> {
    const data = this.users.get(uid);
    this.users.delete(uid);
    return { songs: data?.songs.length ?? 0, setlists: data?.setlists.length ?? 0 };
  }
}

export class FirestoreCloudLibraryStore implements CloudLibraryStore {
  constructor(
    private readonly firestore: Firestore,
    private readonly collection = 'chordifree_users',
  ) {}

  async load(uid: string): Promise<CloudLibraryData> {
    const root = this.firestore.collection(this.collection).doc(uid);
    const [songs, setlists] = await Promise.all([
      root.collection('songs').get(),
      root.collection('setlists').get(),
    ]);
    return {
      songs: songs.docs
        .map((doc) => doc.get('data') as Record<string, unknown> | undefined)
        .filter((value): value is Record<string, unknown> => Boolean(value)),
      setlists: setlists.docs
        .map((doc) => doc.get('data') as Record<string, unknown> | undefined)
        .filter((value): value is Record<string, unknown> => Boolean(value)),
    };
  }

  async replace(uid: string, data: CloudLibraryData): Promise<void> {
    const root = this.firestore.collection(this.collection).doc(uid);
    await this.replaceCollection(root.collection('songs'), data.songs);
    await this.replaceCollection(root.collection('setlists'), data.setlists);
  }

  async clear(uid: string): Promise<{ songs: number; setlists: number }> {
    const data = await this.load(uid);
    await this.replace(uid, { songs: [], setlists: [] });
    await this.firestore.collection(this.collection).doc(uid).delete().catch(() => undefined);
    return { songs: data.songs.length, setlists: data.setlists.length };
  }

  private async replaceCollection(
    collection: FirebaseFirestore.CollectionReference,
    values: Array<Record<string, unknown>>,
  ): Promise<void> {
    const next = new Map<string, Record<string, unknown>>();
    for (const value of values) {
      const id = String(value.id ?? '');
      if (!id || id.includes('/')) {
        throw new ApiError('INVALID_REQUEST', 'Cloud items need a valid id');
      }
      next.set(id, value);
    }

    const existing = await collection.get();
    const deletes = existing.docs.filter((doc) => !next.has(doc.id)).map((doc) => doc.ref);
    const writes = [...next.values()];

    // Firestore batches are limited to 500 writes.
    for (let index = 0; index < deletes.length; index += 400) {
      const batch = this.firestore.batch();
      for (const ref of deletes.slice(index, index + 400)) batch.delete(ref);
      await batch.commit();
    }
    for (let index = 0; index < writes.length; index += 400) {
      const batch = this.firestore.batch();
      for (const value of writes.slice(index, index + 400)) {
        const id = String(value.id);
        batch.set(collection.doc(id), {
          data: value,
          updatedAt:
            typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
        });
      }
      await batch.commit();
    }
  }
}
