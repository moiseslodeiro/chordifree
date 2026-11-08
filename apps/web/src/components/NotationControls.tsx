import type { AccidentalPreference, Notation } from '@chordifree/chords';
import { IconAccidental, IconKey, IconNote, IconTranspose, Tool } from './Toolbar';

interface NotationControlsProps {
  notation: Notation;
  accidentalPreference: AccidentalPreference;
  transpose: number;
  keyLabel: string | null;
  onChange: (patch: {
    notation?: Notation;
    accidentalPreference?: AccidentalPreference;
    transpose?: number;
  }) => void;
}

export function NotationControls({
  notation,
  accidentalPreference,
  transpose,
  keyLabel,
  onChange,
}: NotationControlsProps) {
  return (
    <section className="contents" aria-label="Notación y trasposición">
      <Tool label="Notación" icon={<IconNote />}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-pressed={notation === 'english'}
            className={notation === 'english' ? 'tool-chip-active' : 'tool-chip'}
            onClick={() => onChange({ notation: 'english' })}
          >
            Inglesa
          </button>
          <button
            type="button"
            aria-pressed={notation === 'spanish'}
            className={notation === 'spanish' ? 'tool-chip-active' : 'tool-chip'}
            onClick={() => onChange({ notation: 'spanish' })}
          >
            Española
          </button>
        </div>
      </Tool>

      <div className="tool">
        <span className="tool-icon" aria-hidden="true">
          <IconAccidental />
        </span>
        <label htmlFor="accidental-preference" className="tool-label">
          Alteraciones
        </label>
        <div className="tool-value">
          <select
            id="accidental-preference"
            className="tool-select"
            value={accidentalPreference}
            onChange={(event) =>
              onChange({ accidentalPreference: event.target.value as AccidentalPreference })
            }
          >
            <option value="auto">Automático</option>
            <option value="sharp">Sostenidos ♯</option>
            <option value="flat">Bemoles ♭</option>
          </select>
        </div>
      </div>

      <Tool label="Transporte" icon={<IconTranspose />}>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="tool-step"
            aria-label="Bajar un semitono"
            onClick={() => onChange({ transpose: Math.max(-11, transpose - 1) })}
            disabled={transpose <= -11}
          >
            −
          </button>
          <button
            type="button"
            className="min-w-[2.75rem] px-1 font-mono text-sm tabular-nums text-ink transition hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Restablecer"
            title="Restablecer trasposición"
            onClick={() => onChange({ transpose: 0 })}
            disabled={transpose === 0}
          >
            {transpose > 0 ? `+${transpose}` : transpose}
          </button>
          <button
            type="button"
            className="tool-step"
            aria-label="Subir un semitono"
            onClick={() => onChange({ transpose: Math.min(11, transpose + 1) })}
            disabled={transpose >= 11}
          >
            +
          </button>
        </div>
      </Tool>

      <Tool label="Tonalidad" icon={<IconKey />}>
        <span className="font-display text-base font-bold leading-none text-ink">{keyLabel ?? '—'}</span>
        <p className="sr-only">
          {keyLabel ? `Tonalidad estimada: ${keyLabel}` : 'Tonalidad no determinada'}
        </p>
      </Tool>
    </section>
  );
}
