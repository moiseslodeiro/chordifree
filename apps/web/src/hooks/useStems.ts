import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getStemsJob,
  getStemsStatus,
  startStems,
  type StemJobView,
  type StemsStatus,
} from '../lib/api';

const POLL_MS = 2500;
const MAX_POLL_MS = 20 * 60 * 1000;

export interface StemsController {
  status: StemsStatus | null;
  job: StemJobView | null;
  busy: boolean;
  error: string | null;
  separate: () => Promise<void>;
}

/** Status of the optional local plugin and the separation job of one video. */
export function useStems(videoId: string | null): StemsController {
  const [status, setStatus] = useState<StemsStatus | null>(null);
  const [job, setJob] = useState<StemJobView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef(videoId);
  videoRef.current = videoId;

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
  }, [videoId]);

  const separate = useCallback(async () => {
    if (!videoId || busy) return;
    setBusy(true);
    setError(null);
    try {
      let current = await startStems(videoId);
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

  return { status, job, busy, error, separate };
}
