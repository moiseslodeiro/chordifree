import { randomBytes, randomUUID } from 'node:crypto';
import type { Firestore } from '@google-cloud/firestore';
import type {
  CollabRevision,
  CollabRevisionSummary,
  CollabShare,
  Song,
} from '@chordifree/contracts';
import { ApiError } from '../errors';

/** Newer revisions are discarded so a long collaboration stays small. */
export const MAX_REVISIONS = 100;

export interface CollabAuthor {
  uid: string;
  nickname: string;
}

export interface CollabStore {
  create(author: CollabAuthor, song: Song): Promise<CollabShare>;
  get(id: string): Promise<CollabShare>;
  getRevision(id: string, revisionId: string): Promise<CollabRevision>;
  append(
    id: string,
    author: CollabAuthor,
    baseRevisionId: string,
    song: Song,
  ): Promise<CollabRevision>;
  deleteOwnedBy(uid: string): Promise<void>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function summary(revision: CollabRevision): CollabRevisionSummary {
  return {
    id: revision.id,
    authorUid: revision.authorUid,
    authorNickname: revision.authorNickname,
    createdAt: revision.createdAt,
  };
}

function newShareId(): string {
  return randomBytes(16).toString('hex');
}

function sortNewestFirst(revisions: CollabRevision[]): CollabRevision[] {
  return [...revisions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export class MemoryCollabStore implements CollabStore {
  private readonly shares = new Map<
    string,
    { share: Omit<CollabShare, 'revisions'>; revisions: Map<string, CollabRevision> }
  >();

  async create(author: CollabAuthor, song: Song): Promise<CollabShare> {
    const id = newShareId();
    const now = new Date().toISOString();
    const revision: CollabRevision = {
      id: randomUUID(),
      authorUid: author.uid,
      authorNickname: author.nickname,
      createdAt: now,
      song: clone(song),
    };
    const share = {
      id,
      songId: song.id,
      ownerUid: author.uid,
      ownerNickname: author.nickname,
      currentRevisionId: revision.id,
      createdAt: now,
      updatedAt: now,
    };
    this.shares.set(id, { share, revisions: new Map([[revision.id, revision]]) });
    return this.view(id);
  }

  async get(id: string): Promise<CollabShare> {
    return this.view(id);
  }

  async getRevision(id: string, revisionId: string): Promise<CollabRevision> {
    const entry = this.shares.get(id);
    const revision = entry?.revisions.get(revisionId);
    if (!revision) throw new ApiError('NOT_FOUND', 'The shared version does not exist');
    return clone(revision);
  }

  async append(
    id: string,
    author: CollabAuthor,
    baseRevisionId: string,
    song: Song,
  ): Promise<CollabRevision> {
    const entry = this.shares.get(id);
    if (!entry) throw new ApiError('NOT_FOUND', 'The shared song does not exist');
    if (entry.share.currentRevisionId !== baseRevisionId) {
      throw new ApiError('CONFLICT', 'Someone saved a newer version of this song');
    }
    const revision: CollabRevision = {
      id: randomUUID(),
      authorUid: author.uid,
      authorNickname: author.nickname,
      createdAt: new Date().toISOString(),
      song: clone(song),
    };
    entry.revisions.set(revision.id, revision);
    entry.share = {
      ...entry.share,
      currentRevisionId: revision.id,
      updatedAt: revision.createdAt,
    };
    const ordered = sortNewestFirst([...entry.revisions.values()]);
    for (const removed of ordered.slice(MAX_REVISIONS)) entry.revisions.delete(removed.id);
    return clone(revision);
  }

  async deleteOwnedBy(uid: string): Promise<void> {
    for (const [id, entry] of this.shares) {
      if (entry.share.ownerUid === uid) this.shares.delete(id);
    }
  }

  private view(id: string): CollabShare {
    const entry = this.shares.get(id);
    if (!entry) throw new ApiError('NOT_FOUND', 'The shared song does not exist');
    const revisions = sortNewestFirst([...entry.revisions.values()]);
    return clone({ ...entry.share, revisions: revisions.map(summary) });
  }
}

export class FirestoreCollabStore implements CollabStore {
  constructor(
    private readonly firestore: Firestore,
    private readonly collection = 'chordifree_shared',
  ) {}

  async create(author: CollabAuthor, song: Song): Promise<CollabShare> {
    const id = newShareId();
    const now = new Date().toISOString();
    const revisionId = randomUUID();
    const shareRef = this.firestore.collection(this.collection).doc(id);
    const share: Omit<CollabShare, 'revisions'> = {
      id,
      songId: song.id,
      ownerUid: author.uid,
      ownerNickname: author.nickname,
      currentRevisionId: revisionId,
      createdAt: now,
      updatedAt: now,
    };
    const batch = this.firestore.batch();
    batch.set(shareRef, share);
    batch.set(shareRef.collection('revisions').doc(revisionId), {
      authorUid: author.uid,
      authorNickname: author.nickname,
      createdAt: now,
      song,
    });
    await batch.commit();
    return {
      ...share,
      revisions: [
        {
          id: revisionId,
          authorUid: author.uid,
          authorNickname: author.nickname,
          createdAt: now,
        },
      ],
    };
  }

  async get(id: string): Promise<CollabShare> {
    const shareRef = this.firestore.collection(this.collection).doc(id);
    const [snapshot, revisions] = await Promise.all([
      shareRef.get(),
      shareRef.collection('revisions').orderBy('createdAt', 'desc').limit(MAX_REVISIONS).get(),
    ]);
    if (!snapshot.exists) throw new ApiError('NOT_FOUND', 'The shared song does not exist');
    const data = snapshot.data() as Omit<CollabShare, 'revisions'>;
    return {
      ...data,
      revisions: revisions.docs.map((doc) => {
        const value = doc.data();
        return {
          id: doc.id,
          authorUid: String(value.authorUid ?? ''),
          authorNickname: String(value.authorNickname ?? ''),
          createdAt: String(value.createdAt ?? ''),
        };
      }),
    };
  }

  async getRevision(id: string, revisionId: string): Promise<CollabRevision> {
    const snapshot = await this.firestore
      .collection(this.collection)
      .doc(id)
      .collection('revisions')
      .doc(revisionId)
      .get();
    if (!snapshot.exists) throw new ApiError('NOT_FOUND', 'The shared version does not exist');
    const value = snapshot.data() as Omit<CollabRevision, 'id'>;
    return { id: snapshot.id, ...value };
  }

  async append(
    id: string,
    author: CollabAuthor,
    baseRevisionId: string,
    song: Song,
  ): Promise<CollabRevision> {
    const shareRef = this.firestore.collection(this.collection).doc(id);
    const revisionId = randomUUID();
    const createdAt = new Date().toISOString();
    const revision: CollabRevision = {
      id: revisionId,
      authorUid: author.uid,
      authorNickname: author.nickname,
      createdAt,
      song,
    };

    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(shareRef);
      if (!snapshot.exists) throw new ApiError('NOT_FOUND', 'The shared song does not exist');
      const currentRevisionId = String(snapshot.get('currentRevisionId') ?? '');
      if (currentRevisionId !== baseRevisionId) {
        throw new ApiError('CONFLICT', 'Someone saved a newer version of this song');
      }
      transaction.set(shareRef.collection('revisions').doc(revisionId), {
        authorUid: revision.authorUid,
        authorNickname: revision.authorNickname,
        createdAt: revision.createdAt,
        song: revision.song,
      });
      transaction.update(shareRef, { currentRevisionId: revisionId, updatedAt: createdAt });
    });

    await this.trim(shareRef).catch(() => undefined);
    return revision;
  }

  async deleteOwnedBy(uid: string): Promise<void> {
    const shares = await this.firestore
      .collection(this.collection)
      .where('ownerUid', '==', uid)
      .get();
    for (const share of shares.docs) {
      const revisions = await share.ref.collection('revisions').get();
      for (let index = 0; index < revisions.docs.length; index += 400) {
        const batch = this.firestore.batch();
        for (const revision of revisions.docs.slice(index, index + 400)) {
          batch.delete(revision.ref);
        }
        await batch.commit();
      }
      await share.ref.delete();
    }
  }

  private async trim(shareRef: FirebaseFirestore.DocumentReference): Promise<void> {
    const old = await shareRef
      .collection('revisions')
      .orderBy('createdAt', 'desc')
      .offset(MAX_REVISIONS)
      .get();
    if (old.empty) return;
    const batch = this.firestore.batch();
    for (const doc of old.docs) batch.delete(doc.ref);
    await batch.commit();
  }
}
