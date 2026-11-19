import { useT } from '../i18n';
import type { StemJobView, StemsStatus } from '../lib/api';
import { stemLabel } from '../lib/stem-labels';

interface StemsPanelProps {
  status: StemsStatus | null;
  job: StemJobView | null;
  busy: boolean;
  error: string | null;
  midiBusy: boolean;
  mixActive: boolean;
  mixBusy: boolean;
  gains: Record<string, number>;
  onSeparate: () => void;
  onCancel: () => void;
  onToggleMix: (active: boolean) => void;
  onGainChange: (stem: string, value: number) => void;
  onDownloadStem: (stem: string) => void;
  onDownloadMidi: () => void;
  onRetry: () => void;
}

function percent(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

/**
 * Practice-panel card for the optional local stems plugin. When the stems are
 * ready it becomes a small mixer: every stem has its own volume and the player
 * switches between the original and the synchronized mix.
 */
export function StemsPanel({
  status,
  job,
  busy,
  error,
  midiBusy,
  mixActive,
  mixBusy,
  gains,
  onSeparate,
  onCancel,
  onToggleMix,
  onGainChange,
  onDownloadStem,
  onDownloadMidi,
  onRetry,
}: StemsPanelProps) {
  const t = useT();
  if (!status?.available) return null;

  const ready = job?.status === 'done';
  const working = job?.status === 'queued' || job?.status === 'processing' || busy;
  const midiStems = job?.midi ?? [];

  return (
    <section
      className="rounded-xl border border-line bg-panel p-3 shadow-sm"
      aria-label={t('stems.title')}
      data-testid="stems-panel"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow">{t('stems.eyebrow')}</p>
          <h2 className="mt-1 text-sm font-semibold text-ink">{t('stems.title')}</h2>
        </div>
        {status.name ? (
          <span className="badge">
            {status.name} {status.version}
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-ink3">{t('stems.description')}</p>

      {error || job?.status === 'error' || job?.status === 'cancelled' ? (
        <div className="mt-3 space-y-2">
          <p className="note note-warning text-xs leading-relaxed" role="alert">
            {t('stems.failed', {
              message: error ?? job?.error?.message ?? t('stems.cancelled'),
            })}
          </p>
          <button type="button" className="btn min-h-0 px-3 py-1.5 text-xs" onClick={onRetry}>
            {t('common.retry')}
          </button>
        </div>
      ) : working ? (
        <div className="mt-3 space-y-2">
          <p className="flex items-center gap-2 text-xs text-ink2" role="status">
            <span
              aria-hidden="true"
              className="inline-block size-2 animate-pulse rounded-full bg-accent"
            />
            {t('stems.separating')}
          </p>
          <button type="button" className="btn min-h-0 px-3 py-1.5 text-xs" onClick={onCancel}>
            {t('stems.cancel')}
          </button>
        </div>
      ) : ready && job ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('stems.mode')}>
            <button
              type="button"
              className="practice-toggle"
              aria-pressed={!mixActive}
              onClick={() => onToggleMix(false)}
            >
              {t('stems.original')}
            </button>
            <button
              type="button"
              className="practice-toggle"
              aria-pressed={mixActive}
              disabled={mixBusy}
              onClick={() => onToggleMix(true)}
            >
              {mixBusy ? t('stems.mixPreparing') : t('stems.mix')}
            </button>
          </div>

          {mixActive ? (
            <div className="space-y-2">
              <ul className="space-y-2">
                {job.stems.map((stem) => {
                  const value = percent(gains[stem] ?? 1);
                  return (
                    <li key={stem}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-ink">{stemLabel(stem, t)}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[0.62rem] tabular-nums text-ink3">
                            {value}%
                          </span>
                          <button
                            type="button"
                            className="tool-chip"
                            aria-label={t('stems.download', { stem: stemLabel(stem, t) })}
                            onClick={() => onDownloadStem(stem)}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={value}
                        className="range mt-1 w-full"
                        aria-label={t('stems.volume', { stem: stemLabel(stem, t) })}
                        onChange={(event) => onGainChange(stem, Number(event.target.value) / 100)}
                      />
                    </li>
                  );
                })}
              </ul>
              <p className="text-[0.65rem] leading-relaxed text-ink3">{t('stems.mixHint')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[0.65rem] leading-relaxed text-ink3">{t('stems.chooseMix')}</p>
              <ul className="flex flex-wrap gap-1.5">
                {job.stems.map((stem) => (
                  <li key={stem}>
                    <button
                      type="button"
                      className="tool-chip"
                      aria-label={t('stems.download', { stem: stemLabel(stem, t) })}
                      onClick={() => onDownloadStem(stem)}
                    >
                      {stemLabel(stem, t)} ↓
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {midiStems.length > 0 ? (
            <button
              type="button"
              className="btn min-h-0 w-full justify-center px-3 py-1.5 text-xs"
              onClick={onDownloadMidi}
              disabled={midiBusy}
              title={t('stems.midiHint', {
                stems: midiStems.map((stem) => stemLabel(stem, t)).join(', '),
              })}
            >
              {midiBusy ? t('stems.midiPreparing') : t('stems.midiFromStems')}
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          className="btn mt-3 min-h-0 px-3 py-1.5 text-xs"
          onClick={onSeparate}
          disabled={busy}
        >
          {t('stems.separate')}
        </button>
      )}
    </section>
  );
}
