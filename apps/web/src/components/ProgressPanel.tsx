import { useT } from '../i18n';
import type { RunnerState } from '../lib/useAnalysis';

const PHASE_LABEL: Record<RunnerState['phase'], 'progress.idle' | 'progress.starting' | 'progress.polling' | 'progress.done' | 'progress.error'> = {
  idle: 'progress.idle',
  starting: 'progress.starting',
  polling: 'progress.polling',
  done: 'progress.done',
  error: 'progress.error',
};

interface ProgressPanelProps {
  state: RunnerState;
  onCancel: () => void;
}

export function ProgressPanel({ state, onCancel }: ProgressPanelProps) {
  const t = useT();
  if (state.phase === 'idle') return null;
  const progress = state.view?.progress ?? 0;
  const status = state.view?.status;

  return (
    <div className="border border-line bg-panel px-4 py-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold leading-tight text-ink">{t(PHASE_LABEL[state.phase])}</p>
          <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink3">
            {status ? t('progress.serverStatus', { status }) : t('progress.contacting')}
          </p>
        </div>
        {state.phase === 'starting' || state.phase === 'polling' ? (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t('progress.cancel')}
          </button>
        ) : null}
      </div>
      <div
        className="mt-3 h-[3px] overflow-hidden bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-label={t('progress.aria')}
      >
        <div
          className="h-full origin-left bg-accent transition-transform duration-300"
          style={{ transform: `scaleX(${Math.max(4, Math.min(100, progress)) / 100})` }}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink3">
        {t('progress.help')}
      </p>
    </div>
  );
}
