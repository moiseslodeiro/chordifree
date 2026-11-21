import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelStemJob,
  getStemCache,
  getStemsJob,
  getStemsSetup,
  getStemsStatus,
  listStemJobs,
  startStems,
  type StemJobView,
  type StemSetupStatus,
  type StemsStatus,
} from '../lib/api';

const POLL_MS = 2500;

export interface StemsController {
  status: StemsStatus | null;
  setup: StemSetupStatus | null;
  job: StemJobView | null;
  busy: boolean;
  checking: boolean;
  error: string | null;
  separate: () => Promise<void>;
  cancel: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Status of the optional plugin, the job of the current video and its
 * persistent cache. Jobs keep running on the server when the song changes;
 * this hook only reattaches to them (or to the cache) when you come back.
 */
export function useStems(videoId: string | null, title?: string): StemsController {
  const [status, setStatus] = useState<StemsStatus | null>(null);
  const [setup, setSetup] = useState<StemSetupStatus | null>(null);
  const [job, setJob] = useState<StemJobView | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef(videoId);
  const titleRef = useRef(title);
  videoRef.current = videoId;
  titleRef.current = title;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getStemsStatus().catch(() => ({ available: false }) as StemsStatus),
      getStemsSetup().catch(() => null),
    ]).then(([nextStatus, nextSetup]) => {
      if (cancelled) return;
      setStatus(nextStatus);
      setSetup(nextSetup);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    const [nextStatus, nextSetup] = await Promise.all([
      getStemsStatus().catch(() => ({ available: false }) as StemsStatus),
      getStemsSetup().catch(() => null),
    ]);
    setStatus(nextStatus);
    setSetup(nextSetup);
    if (!nextStatus.available) {
      setJob(null);
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    setJob(null);
    setError(null);
    setBusy(false);
    setChecking(Boolean(videoId));
    if (!videoId) return;
    let cancelled = false;
    void (async () => {
      // Reattach to a job that kept running after the song was closed. The
      // server only keeps one job per video, so this is also the duplicate
      // guard when the user comes back or opens the song in another tab.
      const jobs = await listStemJobs().catch(() => []);
      if (cancelled) return;
      const running = jobs.find(
        (candidate) =>
          candidate.videoId === videoId &&
          (candidate.status === 'queued' || candidate.status === 'processing'),
      );
      if (running) {
        setJob(running);
        setChecking(false);
        return;
      }
      const cached = await getStemCache(videoId).catch(() => null);
      if (!cached || cancelled) {
        setChecking(false);
        return;
      }
      const cachedJob = await startStems(videoId, titleRef.current).catch(() => null);
      if (!cancelled) {
        if (cachedJob) {
          setJob(cachedJob);
          if (cachedJob.status === 'error') setError(cachedJob.error?.message ?? null);
        }
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // Poll every running job, whether it was started here, reattached after a
  // navigation or found from the cache. The timer stops as soon as the job
  // leaves queued/processing.
  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'processing')) return;
    const id = job.id;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void getStemsJob(id)
        .then((next) => {
          if (cancelled) return;
          setJob(next);
          if (next.status === 'error') {
            setError(next.error?.message ?? 'The stems plugin failed');
          }
        })
        .catch(() => {
          if (cancelled) return;
          setJob(null);
          setError('The separation job is no longer available');
        });
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [job?.id, job?.status]);

  const separate = useCallback(async () => {
    if (!videoId || busy || checking) return;
    setBusy(true);
    setError(null);
    try {
      const current = await startStems(videoId, titleRef.current);
      if (videoRef.current !== videoId) return;
      setJob(current);
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
  }, [busy, checking, videoId]);

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

  return { status, setup, job, busy, checking, error, separate, cancel, refresh };
}
