import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelStemJob,
  cancelStemsInstall,
  clearStemCache,
  getStemsSetup,
  getStemsStatus,
  installStems,
  listStemCache,
  listStemJobs,
  prepareStemAudio,
  removeStemCache,
  startStems,
  uninstallStems,
  type StemCacheEntry,
  type StemJobView,
  type StemSetupStatus,
  type StemsStatus,
} from '../lib/api';
import { useT } from '../i18n';
import type { MessageKey } from '../i18n/messages';
import { StemMixerAdapter } from '../player/stem-mixer';
import { stemLabel } from '../lib/stem-labels';
import { StemsSetup } from './StemsSetup';
import { useConfirm } from './ConfirmDialog';

interface StemsLibraryProps {
  onBack: () => void;
}

const STATUS_KEYS: Record<StemJobView['status'], MessageKey> = {
  queued: 'stems.statusQueued',
  processing: 'stems.statusProcessing',
  done: 'stems.statusDone',
  cancelled: 'stems.statusCancelled',
  error: 'stems.statusError',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Local management page for separated stems: running jobs, the persistent
 * cache and its cleanup. It is only reachable from the header when the plugin
 * is available, and it never talks to a cloud instance.
 */
export function StemsLibrary({ onBack }: StemsLibraryProps) {
  const t = useT();
  const confirm = useConfirm();
  const [status, setStatus] = useState<StemsStatus | null>(null);
  const [jobs, setJobs] = useState<StemJobView[]>([]);
  const [entries, setEntries] = useState<StemCacheEntry[]>([]);
  const [setup, setSetup] = useState<StemSetupStatus | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [playing, setPlaying] = useState<{ key: string; mode: 'mix' | string } | null>(null);
  const [loadingPlayback, setLoadingPlayback] = useState<string | null>(null);
  const mixRef = useRef<StemMixerAdapter | null>(null);
  const singleRef = useRef<HTMLAudioElement | null>(null);
  const urlsRef = useRef<string[]>([]);

  const stopAudio = useCallback(() => {
    mixRef.current?.destroy();
    mixRef.current = null;
    const single = singleRef.current;
    if (single) {
      single.pause();
      single.removeAttribute('src');
      single.load();
      singleRef.current = null;
    }
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current = [];
  }, []);

  const stopPlayback = useCallback(() => {
    stopAudio();
    setPlaying(null);
  }, [stopAudio]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const load = useCallback(async () => {
    try {
      const [nextStatus, nextJobs, nextEntries, nextSetup] = await Promise.all([
        getStemsStatus().catch(() => ({ available: false }) as StemsStatus),
        listStemJobs().catch(() => []),
        listStemCache().catch(() => []),
        getStemsSetup().catch(() => null),
      ]);
      setStatus(nextStatus);
      setJobs(nextJobs);
      setEntries(nextEntries);
      setSetup(nextSetup);
      setProblem(null);
    } catch {
      setProblem(t('stemsLibrary.error'));
    }
  }, [t]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [load]);

  const cancel = async (job: StemJobView) => {
    setBusy(true);
    try {
      await cancelStemJob(job.id);
      await load();
    } catch {
      setProblem(t('stemsLibrary.error'));
    } finally {
      setBusy(false);
    }
  };

  const installPlugin = async () => {
    setSetupBusy(true);
    setProblem(null);
    try {
      const job = await installStems();
      setSetup((current) => (current ? { ...current, job } : current));
      await load();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : t('stemsLibrary.error'));
    } finally {
      setSetupBusy(false);
    }
  };

  const cancelInstall = async () => {
    try {
      await cancelStemsInstall();
      await load();
    } catch {
      setProblem(t('stemsLibrary.error'));
    }
  };

  const uninstallPlugin = async () => {
    const accepted = await confirm({
      title: t('stemsSetup.uninstall'),
      description: t('stemsSetup.uninstallConfirm'),
      confirmLabel: t('stemsSetup.uninstall'),
      tone: 'danger',
    });
    if (!accepted) return;
    setSetupBusy(true);
    try {
      await uninstallStems();
      await load();
    } catch {
      setProblem(t('stemsLibrary.error'));
    } finally {
      setSetupBusy(false);
    }
  };

  const remove = async (entry: StemCacheEntry) => {
    if (playing?.key === entry.key) stopPlayback();
    setBusy(true);
    try {
      await removeStemCache(entry.videoId);
      await load();
    } catch {
      setProblem(t('stemsLibrary.error'));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    const accepted = await confirm({
      title: t('stemsLibrary.clear'),
      description: t('stemsLibrary.clearConfirm'),
      confirmLabel: t('stemsLibrary.clear'),
      tone: 'danger',
    });
    if (!accepted) return;
    stopPlayback();
    setBusy(true);
    try {
      await clearStemCache();
      await load();
    } catch {
      setProblem(t('stemsLibrary.error'));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Plays a cached separation without leaving the management page: either the
   * synchronized mix of every stem or a single stem. Only one playback runs at
   * a time, and the blob URLs are revoked when it stops.
   */
  const playEntry = async (entry: StemCacheEntry, mode: 'mix' | string) => {
    if (loadingPlayback) return;
    if (playing?.key === entry.key && playing.mode === mode) {
      stopPlayback();
      return;
    }
    stopPlayback();
    const token = `${entry.key}:${mode}`;
    setLoadingPlayback(token);
    try {
      const job = await startStems(entry.videoId, entry.title);
      const sources = await Promise.all(
        job.stems.map(async (stem) => ({
          name: stem,
          url: await prepareStemAudio(job.id, stem),
        })),
      );
      urlsRef.current = sources.map((source) => source.url);
      if (mode === 'mix') {
        const adapter = new StemMixerAdapter(sources);
        mixRef.current = adapter;
        adapter.onStateChange((isPlaying) => {
          if (!isPlaying && mixRef.current === adapter) setPlaying(null);
        });
        adapter.play();
      } else {
        const source = sources.find((candidate) => candidate.name === mode);
        if (!source) throw new Error('The stem is not in the cache');
        const audio = new Audio(source.url);
        audio.preservesPitch = true;
        audio.addEventListener('ended', () => setPlaying(null), { once: true });
        singleRef.current = audio;
        void audio.play().catch(() => setPlaying(null));
      }
      setPlaying({ key: entry.key, mode });
    } catch {
      stopPlayback();
      setProblem(t('stemsLibrary.error'));
    } finally {
      setLoadingPlayback(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-lg">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line p-6 sm:p-8">
        <div>
          <p className="eyebrow">{t('stemsLibrary.eyebrow')}</p>
          <h1 className="display mt-2 text-3xl">{t('stemsLibrary.title')}</h1>
          <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink2">
            {t('stemsLibrary.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={() => void load()} disabled={busy}>
            {t('stemsLibrary.refresh')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            {t('song.back')}
          </button>
        </div>
      </header>

      {problem ? (
        <p className="p-6 text-sm text-danger sm:p-8" role="alert">
          {problem}
        </p>
      ) : !status?.available && setup?.supported ? (
        <div className="p-6 sm:p-8">
          <StemsSetup
            setup={setup}
            busy={setupBusy}
            available={Boolean(status?.available)}
            onInstall={() => void installPlugin()}
            onCancel={() => void cancelInstall()}
            onRefresh={() => void load()}
            onUninstall={() => void uninstallPlugin()}
          />
        </div>
      ) : status && !status.available ? (
        <p className="p-6 text-sm text-ink2 sm:p-8">{t('stemsLibrary.unavailable')}</p>
      ) : (
        <div className="divide-y divide-line">
          {setup?.supported && setup.installed ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-xs text-ink3 sm:px-8">
              <span>{t('stemsSetup.installed')}</span>
              <button
                type="button"
                className="btn btn-danger min-h-0 px-3 py-1.5 text-xs"
                disabled={setupBusy}
                onClick={() => void uninstallPlugin()}
              >
                {t('stemsSetup.uninstall')}
              </button>
            </div>
          ) : null}
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink">{t('stemsLibrary.jobs')}</h2>
              <span className="badge">{jobs.length}</span>
            </div>
            {jobs.length === 0 ? (
              <p className="mt-3 text-sm text-ink3">{t('stemsLibrary.emptyJobs')}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {jobs.map((job) => (
                  <li
                    key={job.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-panel-2/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {job.title ?? job.videoId}
                      </p>
                      <p className="mt-0.5 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-ink3">
                        {t(STATUS_KEYS[job.status])} · {job.videoId}
                      </p>
                    </div>
                    {job.status === 'queued' || job.status === 'processing' ? (
                      <button
                        type="button"
                        className="btn min-h-0 px-3 py-1.5 text-xs"
                        disabled={busy}
                        onClick={() => void cancel(job)}
                      >
                        {t('stemsLibrary.cancel')}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">{t('stemsLibrary.cache')}</h2>
                <p className="mt-1 text-xs text-ink3">
                  {t('stemsLibrary.cacheSize', {
                    count: entries.length,
                    size: formatBytes(entries.reduce((sum, entry) => sum + entry.bytes, 0)),
                  })}
                </p>
                <p className="mt-1 text-xs text-ink3">{t('stemsLibrary.playHint')}</p>
              </div>
              <button
                type="button"
                className="btn btn-danger min-h-0 px-3 py-1.5 text-xs"
                disabled={busy || entries.length === 0}
                onClick={() => void clear()}
              >
                {t('stemsLibrary.clear')}
              </button>
            </div>

            {entries.length === 0 ? (
              <p className="mt-3 text-sm text-ink3">{t('stemsLibrary.emptyCache')}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {entries.map((entry) => (
                  <li
                    key={entry.key}
                    className="rounded-lg border border-line bg-panel-2/40 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {entry.title ?? entry.videoId}
                        </p>
                        <p className="mt-0.5 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-ink3">
                          {entry.videoId} · {entry.plugin} · {formatBytes(entry.bytes)}
                          {entry.midi.length > 0 ? ' · MIDI' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-danger min-h-0 px-3 py-1.5 text-xs"
                        disabled={busy}
                        onClick={() => void remove(entry)}
                      >
                        {t('stemsLibrary.remove')}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        className="tool-chip"
                        aria-label={t('stemsLibrary.playMix')}
                        aria-pressed={playing?.key === entry.key && playing.mode === 'mix'}
                        disabled={Boolean(loadingPlayback)}
                        onClick={() => void playEntry(entry, 'mix')}
                      >
                        {loadingPlayback === `${entry.key}:mix`
                          ? t('stemsLibrary.loading')
                          : `▶ ${t('stemsLibrary.playMix')}`}
                      </button>
                      {entry.stems.map((stem) => {
                        const label = stemLabel(stem, t);
                        return (
                          <button
                            key={stem}
                            type="button"
                            className="tool-chip"
                            aria-label={t('stemsLibrary.playStem', { stem: label })}
                            aria-pressed={playing?.key === entry.key && playing.mode === stem}
                            disabled={Boolean(loadingPlayback)}
                            onClick={() => void playEntry(entry, stem)}
                          >
                            {`▶ ${label}`}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
