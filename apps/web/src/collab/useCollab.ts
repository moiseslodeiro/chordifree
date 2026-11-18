import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import {
  ApiClientError,
  createCollabShare,
  getCollabRevision,
  getCollabShare,
  saveCollabRevision,
} from '../lib/api';
import type { AppNotice, CollabRevision, CollabShare, Song } from '../types';

interface UseCollabOptions {
  enabled: boolean;
  song: Song | null;
  onNotice: (notice: AppNotice) => void;
  onOpenSong: (song: Song) => void;
}

export interface CollabController {
  share: CollabShare | null;
  loading: boolean;
  refresh: (id?: string) => Promise<CollabShare | null>;
  openFromLink: (id: string) => Promise<void>;
  createShare: (song: Song) => Promise<CollabShare | null>;
  publish: (song: Song) => Promise<CollabRevision | null>;
  loadRevision: (revisionId: string) => Promise<CollabRevision | null>;
}

/**
 * Keeps the revision history of the open song. Every successful save publishes
 * a new revision based on the last version this client saw, so a stale write is
 * rejected instead of silently overwriting someone else's work.
 */
export function useCollab({
  enabled,
  song,
  onNotice,
  onOpenSong,
}: UseCollabOptions): CollabController {
  const t = useT();
  const [share, setShare] = useState<CollabShare | null>(null);
  const [loading, setLoading] = useState(false);
  const shareRef = useRef<CollabShare | null>(null);
  const baseRef = useRef<string | null>(null);

  const adopt = useCallback((next: CollabShare) => {
    shareRef.current = next;
    baseRef.current = next.currentRevisionId;
    setShare(next);
  }, []);

  const reset = useCallback(() => {
    shareRef.current = null;
    baseRef.current = null;
    setShare(null);
  }, []);

  const refresh = useCallback(
    async (id?: string) => {
      const target = id ?? shareRef.current?.id;
      if (!target || !enabled) return null;
      try {
        const next = await getCollabShare(target);
        if (shareRef.current?.id === target) adopt(next);
        return next;
      } catch {
        return null;
      }
    },
    [adopt, enabled],
  );

  const collabId = song?.collabId ?? null;
  useEffect(() => {
    if (!enabled || !collabId) {
      reset();
      return;
    }
    if (shareRef.current?.id === collabId) return;
    let cancelled = false;
    setLoading(true);
    getCollabShare(collabId)
      .then((next) => {
        if (!cancelled) adopt(next);
      })
      .catch(() => {
        if (!cancelled) {
          onNotice({ message: t('collab.loadFailed'), tone: 'warning' });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adopt, collabId, enabled, onNotice, reset, t]);

  const openFromLink = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const next = await getCollabShare(id);
        const revision = await getCollabRevision(id, next.currentRevisionId);
        adopt(next);
        onOpenSong({ ...revision.song, collabId: id, updatedAt: new Date().toISOString() });
      } catch {
        onNotice({ message: t('collab.loadFailed'), tone: 'warning' });
      } finally {
        setLoading(false);
      }
    },
    [adopt, onNotice, onOpenSong, t],
  );

  const createShare = useCallback(
    async (target: Song) => {
      if (!enabled) return null;
      if (shareRef.current && shareRef.current.id === target.collabId) {
        return shareRef.current;
      }
      try {
        if (target.collabId) {
          const existing = await getCollabShare(target.collabId);
          adopt(existing);
          return existing;
        }
        const created = await createCollabShare(target);
        adopt(created);
        return created;
      } catch {
        onNotice({ message: t('collab.createFailed'), tone: 'warning' });
        return null;
      }
    },
    [adopt, enabled, onNotice, t],
  );

  const publish = useCallback(
    async (target: Song) => {
      const current = shareRef.current;
      if (!enabled || !target.collabId || !current || current.id !== target.collabId) return null;
      if (!baseRef.current) return null;
      try {
        const revision = await saveCollabRevision(target.collabId, baseRef.current, target);
        baseRef.current = revision.id;
        const next: CollabShare = {
          ...current,
          currentRevisionId: revision.id,
          updatedAt: revision.createdAt,
          revisions: [
            {
              id: revision.id,
              authorUid: revision.authorUid,
              authorNickname: revision.authorNickname,
              createdAt: revision.createdAt,
            },
            ...current.revisions,
          ].slice(0, 100),
        };
        shareRef.current = next;
        setShare(next);
        return revision;
      } catch (error) {
        if (error instanceof ApiClientError && error.code === 'CONFLICT') {
          onNotice({ message: t('collab.conflict'), tone: 'warning' });
          await refresh(target.collabId);
        } else {
          onNotice({ message: t('collab.saveFailed'), tone: 'warning' });
        }
        return null;
      }
    },
    [enabled, onNotice, refresh, t],
  );

  const loadRevision = useCallback(async (revisionId: string) => {
    const current = shareRef.current;
    if (!current) return null;
    try {
      return await getCollabRevision(current.id, revisionId);
    } catch {
      return null;
    }
  }, []);

  return {
    share,
    loading,
    refresh,
    openFromLink,
    createShare,
    publish,
    loadRevision,
  };
}
