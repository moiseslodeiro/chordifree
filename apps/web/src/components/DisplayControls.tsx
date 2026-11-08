import type { Instrument } from '../types';
import { IconGuitar, IconSliders, Tool } from './Toolbar';

interface DisplayControlsProps {
  simplifyChords: boolean;
  reduceChords: boolean;
  reduceChordsMax: boolean;
  instrument: Instrument;
  onChange: (patch: {
    simplifyChords?: boolean;
    reduceChords?: boolean;
    reduceChordsMax?: boolean;
    instrument?: Instrument;
  }) => void;
}

const INSTRUMENTS: Array<{ value: Instrument; label: string }> = [
  { value: 'guitar', label: 'Guitarra' },
  { value: 'piano', label: 'Piano' },
  { value: 'ukelele', label: 'Ukelele' },
];

export function DisplayControls({
  simplifyChords,
  reduceChords,
  reduceChordsMax,
  instrument,
  onChange,
}: DisplayControlsProps) {
  const instrumentLabel =
    INSTRUMENTS.find((item) => item.value === instrument)?.label ?? 'Guitarra';
  const maxActive = reduceChords && reduceChordsMax;

  return (
    <section className="contents" aria-label="Presentación de acordes">
      <Tool label="Presentación" icon={<IconSliders />}>
        <div className="flex flex-wrap items-center gap-0.5">
          <button
            type="button"
            aria-pressed={simplifyChords}
            aria-label="Simplificar acordes"
            title="Simplificar acordes (quita tensiones y extensiones)"
            className="tool-chip"
            onClick={() => onChange({ simplifyChords: !simplifyChords })}
          >
            Simplificar
          </button>
          <button
            type="button"
            aria-pressed={reduceChords}
            aria-label="Reducir acordes"
            title="Reducir acordes (agrupa los acordes de paso)"
            className="tool-chip"
            onClick={() =>
              onChange(
                reduceChords
                  ? { reduceChords: false, reduceChordsMax: false }
                  : { reduceChords: true },
              )
            }
          >
            Reducir
          </button>
          <button
            type="button"
            aria-pressed={maxActive}
            aria-label="Reducir al máximo"
            title="Reducir al máximo (deja un acorde por compás)"
            disabled={!reduceChords}
            className="tool-chip disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onChange({ reduceChords: true, reduceChordsMax: !reduceChordsMax })}
          >
            Máxima
          </button>
        </div>
      </Tool>

      <div className="tool">
        <span className="tool-icon" aria-hidden="true">
          <IconGuitar />
        </span>
        <label htmlFor="instrument-select" className="tool-label">
          Instrumento
        </label>
        <div className="tool-value">
          <select
            id="instrument-select"
            className="tool-select"
            value={instrument}
            onChange={(event) => onChange({ instrument: event.target.value as Instrument })}
          >
            {INSTRUMENTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {`Simplificación ${simplifyChords ? 'activada' : 'desactivada'}. Reducción ${
          reduceChords ? (reduceChordsMax ? 'máxima' : 'activada') : 'desactivada'
        }. Instrumento: ${instrumentLabel}.`}
      </p>
    </section>
  );
}
