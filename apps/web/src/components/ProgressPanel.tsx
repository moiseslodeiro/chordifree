import type { RunnerState } from '../lib/useAnalysis';

const PHASE_LABEL: Record<RunnerState['phase'], string> = {
  idle: 'Preparado',
  starting: 'Creando el análisis…',
  polling: 'Analizando el audio…',
  done: 'Análisis completado',
  error: 'El análisis falló',
};

interface ProgressPanelProps {
  state: RunnerState;
  onCancel: () => void;
}

export function ProgressPanel({ state, onCancel }: ProgressPanelProps) {
  if (state.phase === 'idle') return null;
  const progress = state.view?.progress ?? 0;
  const status = state.view?.status;

  return (
    <div className="border border-line bg-panel px-4 py-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold leading-tight text-ink">{PHASE_LABEL[state.phase]}</p>
          <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink3">
            {status ? `Estado del servidor: ${status}` : 'Contactando con el servidor'}
          </p>
        </div>
        {state.phase === 'starting' || state.phase === 'polling' ? (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
      </div>
      <div
        className="mt-3 h-[3px] overflow-hidden bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-label="Progreso del análisis"
      >
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink3">
        El audio se descarga, se convierte y se analiza con Essentia. Puede tardar unos segundos.
      </p>
    </div>
  );
}
