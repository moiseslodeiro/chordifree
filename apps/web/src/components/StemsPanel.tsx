import { useT } from '../i18n';
import type { MessageKey } from '../i18n/messages';
import type { StemJobView, StemsStatus } from '../lib/api';

interface StemsPanelProps {
  status: StemsStatus | null;
  job: StemJobView | null;
  busy: boolean;
  error: string | null;
  selected: string | null;
  loadingStem: string | null;
  midiBusy: boolean;
  onSeparate: () => void;
  onSelect: (stem: string | null) => void;
  onDownload: (stem: string) => void;
  onDownloadMidi: () => void;
  onRetry: () => void;
}

const STEM_LABELS: Record<string, MessageKey> = {
  vocals: 'stems.vocals',
  no_vocals: 'stems.instrumental',
  instrumental: 'stems.instrumental',
  drums: 'stems.drums',
  bass: 'stems.bass',
  other: 'stems.other',
};

function stemLabel(stem: string, t: (key: MessageKey) => string): string {
  const key = STEM_LABELS[stem];
  return key ? t(key) : stem;
}

/**
 * Practice-panel card for the optional local stems plugin. It only renders
 * when the server reports the plugin as available, so hosted instances never
 * show a dead control.
 */
export function StemsPanel({
  status,
  job,
  busy,
  error,
  selected,
  loadingStem,
  midiBusy,
  onSeparate,
  onSelect,
  onDownload,
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

      {error || job?.status === 'error' ? (
        <div className="mt-3 space-y-2">
          <p className="note note-warning text-xs leading-relaxed" role="alert">
            {t('stems.failed', { message: error ?? job?.error?.message ?? '' })}
          </p>
          <button type="button" className="btn min-h-0 px-3 py-1.5 text-xs" onClick={onRetry}>
            {t('common.retry')}
          </button>
        </div>
      ) : working ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink2" role="status">
          <span
            aria-hidden="true"
            className="inline-block size-2 animate-pulse rounded-full bg-accent"
          />
          {t('stems.separating')}
        </p>
      ) : ready && job ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('stems.title')}>
            <button
              type="button"
              className="practice-toggle"
              aria-pressed={selected === null}
              onClick={() => onSelect(null)}
            >
              {t('stems.original')}
            </button>
            {job.stems.map((stem) => (
              <button
                key={stem}
                type="button"
                className="practice-toggle"
                aria-pressed={selected === stem}
                disabled={loadingStem !== null}
                onClick={() => onSelect(stem)}
              >
                {loadingStem === stem ? t('stems.loading') : stemLabel(stem, t)}
              </button>
            ))}
          </div>
          {selected ? (
            <button type="button" className="tool-chip" onClick={() => onDownload(selected)}>
              {t('stems.download', { stem: stemLabel(selected, t) })}
            </button>
          ) : null}
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
