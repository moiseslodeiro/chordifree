import { formatChord, type Accidental, type Chord, type Notation } from '@chordifree/chords';
import { useT } from '../i18n';
import type { MicStatus } from '../practice/useMicPractice';

interface MicPracticeProps {
  enabled: boolean;
  status: MicStatus;
  target: Chord | null;
  detected: Chord | null;
  hit: boolean;
  hitCount: number;
  totalChords: number;
  notation: Notation;
  accidental: Accidental;
  onToggle: () => void;
  onReset: () => void;
}

const STATUS_KEYS = {
  idle: 'mic.statusIdle',
  requesting: 'mic.statusRequesting',
  listening: 'mic.statusListening',
  denied: 'mic.statusDenied',
  unsupported: 'mic.statusUnsupported',
  error: 'mic.statusError',
} as const;

export function MicPractice({
  enabled,
  status,
  target,
  detected,
  hit,
  hitCount,
  totalChords,
  notation,
  accidental,
  onToggle,
  onReset,
}: MicPracticeProps) {
  const t = useT();
  const targetLabel = target ? formatChord(target, notation, accidental) : null;
  const detectedLabel = detected ? formatChord(detected, notation, accidental) : null;
  const statusLabel = t(STATUS_KEYS[status]);

  return (
    <section className="border-t border-line pt-4" aria-label={t('mic.aria')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{t('mic.eyebrow')}</p>
          <h2 className="mt-1 font-display text-base font-bold leading-tight text-ink">
            {t('mic.title')}
          </h2>
          <p className="mt-1 max-w-[58ch] text-xs leading-relaxed text-ink3">
            {t('mic.description')}
          </p>
        </div>
        <button
          type="button"
          className={enabled ? 'btn' : 'btn btn-primary'}
          aria-pressed={enabled}
          onClick={onToggle}
        >
          {enabled ? t('mic.stop') : t('mic.start')}
        </button>
      </div>

      {enabled ? (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <span className="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink3">
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  status === 'listening'
                    ? 'bg-positive'
                    : status === 'requesting'
                      ? 'animate-pulse bg-accent'
                      : 'bg-ink3'
                }`}
              />
              <span aria-live="polite">{statusLabel}</span>
            </span>

            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="eyebrow">{t('mic.target')}</span>
              {targetLabel ? (
                <span
                  className={`display text-2xl font-bold leading-none ${
                    hit ? 'text-positive' : 'text-ink'
                  }`}
                >
                  {targetLabel}
                </span>
              ) : (
                <span className="text-sm text-ink3">{t('mic.waiting')}</span>
              )}
            </span>

            {detectedLabel ? (
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink3">
                {t('mic.detected', { chord: detectedLabel })}
              </span>
            ) : null}

            <span className="ml-auto flex flex-wrap items-center gap-2">
              {hit ? (
                <span className="badge border-positive/60 text-positive" role="status">
                  ✓ {t('mic.correct')}
                </span>
              ) : null}
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink3">
                {t('mic.progress', { done: hitCount, total: totalChords })}
              </span>
              {hitCount > 0 ? (
                <button type="button" className="btn min-h-0 px-3 py-1.5 text-xs" onClick={onReset}>
                  {t('mic.reset')}
                </button>
              ) : null}
            </span>
          </div>

          {status === 'denied' || status === 'unsupported' || status === 'error' ? (
            <p className="note note-warning mt-3 text-xs leading-relaxed" role="alert">
              {t(
                status === 'denied'
                  ? 'mic.deniedHelp'
                  : status === 'unsupported'
                    ? 'mic.unsupportedHelp'
                    : 'mic.errorHelp',
              )}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
