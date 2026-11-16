import { useCallback, useEffect, useRef, useState } from 'react';
import type { Setlist, Song } from '@chordifree/contracts';
import { useT } from '../i18n';
import { getCloudLibrary, saveCloudLibrary } from '../lib/api';
import type { SongSummary } from '../types';
import { mergeSnapshot } from './cloud';

export type CloudStatus = 'idle' | 'syncing' | 'saved' | 'error';

export interface CloudLibraryOptions {
  enabled: boolean;
  /** Summary list used only as a change signal for the debounced save. */
  songs: SongSummary[];
  setlists: Setlist[];
  getSongs: () => Song[];
  onMerge: (snapshot: { songs: Song[]; setlists: Setlist[] }) => void;
  onNotice: (message: string, tone: 'info' | 'warning' | 'success') => void;
}

export interface CloudLibraryState {
  status: CloudStatus;
  syncNow: () => void;
}

const DEBOUNCE_MS = 1200;

export function useCloudLibrary({
  enabled,
  songs,
  setlists,
  getSongs,
  onMerge,
  onNotice,
}: CloudLibraryOptions): CloudLibraryState {
  const t = useT();
  const [status, setStatus] = useState<CloudStatus>('idle');
  const ready = useRef(false);
  const errorNotified = useRef(false);
  const getSongsRef = useRef(getSongs);
  const onMergeRef = useRef(onMerge);
  const onNoticeRef = useRef(onNotice);
  const setlistsRef = useRef(setlists);

  getSongsRef.current = getSongs;
  onMergeRef.current = onMerge;
  onNoticeRef.current = onNotice;
  setlistsRef.current = setlists;

  useEffect(() => {
    if (!enabled) {
      ready.current = false;
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('syncing');
    void (async () => {
      try {
        const remote = await getCloudLibrary();
        if (cancelled) return;

        const local = { songs: getSongsRef.current(), setlists: setlistsRef.current };
        const merged = mergeSnapshot(local, remote);
        const hasData = merged.songs.length > 0 || merged.setlists.length > 0;
        if (hasData) {
          onMergeRef.current(merged);
          await saveCloudLibrary(merged);
          if (remote.songs.length > 0 || remote.setlists.length > 0) {
            onNoticeRef.current(t('cloud.loaded'), 'info');
          }
        }
        ready.current = true;
        setStatus('saved');
      } catch {
        if (!cancelled) {
          ready.current = false;
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, t]);

  useEffect(() => {
    if (!enabled || !ready.current) return;
    setStatus('syncing');
    const timer = window.setTimeout(() => {
      void saveCloudLibrary({ songs: getSongsRef.current(), setlists: setlistsRef.current })
        .then(() => {
          setStatus('saved');
          errorNotified.current = false;
        })
        .catch(() => {
          setStatus('error');
          if (!errorNotified.current) {
            errorNotified.current = true;
            onNoticeRef.current(t('cloud.error'), 'warning');
          }
        });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, songs, setlists, t]);

  const syncNow = useCallback(() => {
    if (!enabled) return;
    ready.current = true;
    setStatus('syncing');
    void saveCloudLibrary({ songs: getSongsRef.current(), setlists: setlistsRef.current })
      .then(() => {
        setStatus('saved');
        onNoticeRef.current(t('cloud.saved'), 'success');
      })
      .catch(() => {
        setStatus('error');
        onNoticeRef.current(t('cloud.error'), 'warning');
      });
  }, [enabled, t]);

  return { status, syncNow };
}
