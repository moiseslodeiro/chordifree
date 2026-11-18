import type { Firestore } from '@google-cloud/firestore';
import type { AuthUser } from '@chordifree/contracts';

export interface ProfileStore {
  get(uid: string): Promise<string | null>;
  set(uid: string, nickname: string): Promise<void>;
  clear(uid: string): Promise<void>;
}

/** Local mode and tests keep nicknames in memory. */
export class MemoryProfileStore implements ProfileStore {
  private readonly nicknames = new Map<string, string>();

  async get(uid: string): Promise<string | null> {
    return this.nicknames.get(uid) ?? null;
  }

  async set(uid: string, nickname: string): Promise<void> {
    this.nicknames.set(uid, nickname);
  }

  async clear(uid: string): Promise<void> {
    this.nicknames.delete(uid);
  }
}

export class FirestoreProfileStore implements ProfileStore {
  constructor(
    private readonly firestore: Firestore,
    private readonly collection = 'chordifree_profiles',
  ) {}

  async get(uid: string): Promise<string | null> {
    try {
      const snapshot = await this.firestore.collection(this.collection).doc(uid).get();
      const nickname = snapshot.get('nickname');
      return typeof nickname === 'string' && nickname.trim() ? nickname.trim() : null;
    } catch (error) {
      console.warn('[profiles] read failed', error instanceof Error ? error.message : error);
      return null;
    }
  }

  async set(uid: string, nickname: string): Promise<void> {
    await this.firestore
      .collection(this.collection)
      .doc(uid)
      .set({ nickname, updatedAt: new Date().toISOString() }, { merge: true });
  }

  async clear(uid: string): Promise<void> {
    await this.firestore
      .collection(this.collection)
      .doc(uid)
      .delete()
      .catch(() => undefined);
  }
}

/** Google name first, then the email local part. */
export function fallbackNickname(user: AuthUser): string {
  const name = user.name?.trim();
  if (name) return name.slice(0, 32);
  const local = user.email.split('@')[0]?.trim();
  return (local || 'Musician').slice(0, 32);
}

export async function resolveNickname(store: ProfileStore, user: AuthUser): Promise<string> {
  return (await store.get(user.uid)) ?? fallbackNickname(user);
}
