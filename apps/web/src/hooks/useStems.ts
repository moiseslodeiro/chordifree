import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelStemJob,
  getStemCache,
  getStemsJob,
  getStemsStatus,
  startStems,
  type StemJobView,
  type StemsStatus,
} from '../lib/api';

const POLL_MS = 2500;
const MAX_POLL_MS = 60 * 60 * 1000;

export interface StemsController {
  status: StemsStatus | null;
  job: StemJobView | null;
  busy: boolean;
  error: string | null;
  separate: () => Promise<void>;
  cancel: () => Promise<void>;
}

/**
 * Status of the optional plugin, the job of the current video and its
 * persistent cache. Jobs keep running on the server when the song changes;
 * this hook only reattaches to them (or to the cache) when you come back.
 */
export function useStems(videoId: string | null, title?: string): StemsController {
  const [status, setStatus] = useState<StemsStatus | null>(null);
  const [job, setJob] = useState<StemJobView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef(videoId);
  const titleRef = useRef(title);
  videoRef.current = videoId;
  titleRef.current = title;

  useEffect(() => {
    let cancelled = false;
    getStemsStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => {
        if (!cancelled) setStatus({ available: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setJob(null);
    setError(null);
    setBusy(false);
    if (!videoId) return;
    let cancelled = false;
    void (async () => {
      const cached = await getStemCache(videoId).catch(() => null);
      if (!cached || cancelled) return;
      const cachedJob = await startStems(videoId, titleRef.current).catch(() => null);
      if (!cancelled && cachedJob) {
        setJob(cachedJob);
        if (cachedJob.status === 'error') setError(cachedJob.error?.message ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const separate = useCallback(async () => {
    if (!videoId || busy) return;
    setBusy(true);
    setError(null);
    try {
      let current = await startStems(videoId, titleRef.current);
      if (videoRef.current !== videoId) return;
      setJob(current);
      const startedAt = Date.now();
      while (current.status === 'queued' || current.status === 'processing') {
        if (Date.now() - startedAt > MAX_POLL_MS) {
          throw new Error('timeout');
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        current = await getStemsJob(current.id);
        if (videoRef.current !== videoId) return;
        setJob(current);
      }
      if (current.status === 'error') {
        setError(current.error?.message ?? 'The stems plugin failed');
      }
    } catch (caught) {
      if (videoRef.current === videoId) {
        setError(caught instanceof Error ? caught.message : 'The stems plugin failed');
      }
    } finally {
      if (videoRef.current === videoId) setBusy(false);
    }
  }, [busy, videoId]);

  const cancel = useCallback(async () => {
    if (!job || (job.status !== 'queued' && job.status !== 'processing')) return;
    try {
      const next = await cancelStemJob(job.id);
      if (videoRef.current === videoId) {
        setJob(next);
        setBusy(false);
      }
    } catch {
      if (videoRef.current === videoId) setError('The separation could not be cancelled');
    }
  }, [job, videoId]);

  return { status, job, busy, error, separate, cancel };
}
