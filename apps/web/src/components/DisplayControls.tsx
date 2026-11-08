import { supportsCapo, type Instrument } from '../types';
import { IconCapo, IconGuitar, IconSliders, Tool } from './Toolbar';

interface DisplayControlsProps {
  simplifyChords: boolean;
  reduceChords: boolean;
  reduceChordsMax: boolean;
  instrument: Instrument;
  capo: number;
  onChange: (patch: {
    simplifyChords?: boolean;
    reduceChords?: boolean;
    reduceChordsMax?: boolean;
    instrument?: Instrument;
    capo?: number;
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
  capo,
  onChange,
}: DisplayControlsProps) {
  const instrumentLabel =
    INSTRUMENTS.find((item) => item.value === instrument)?.label ?? 'Guitarra';
  const maxActive = reduceChords && reduceChordsMax;
  /** La cejilla solo tiene sentido en instrumentos de cuerda. */
  const capoAvailable = supportsCapo(instrument);

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

      {capoAvailable ? (
        <div className="tool">
          <span className="tool-icon" aria-hidden="true">
            <IconCapo />
          </span>
          <label htmlFor="capo-select" className="tool-label">
            Capo
          </label>
          <div className="tool-value">
            <select
              id="capo-select"
              className="tool-select"
              value={capo}
              onChange={(event) => onChange({ capo: Number(event.target.value) })}
            >
              {Array.from({ length: 8 }, (_, fret) => (
                <option key={fret} value={fret}>
                  {fret === 0 ? 'Sin capo' : `Traste ${fret}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {`Simplificación ${simplifyChords ? 'activada' : 'desactivada'}. Reducción ${
          reduceChords ? (reduceChordsMax ? 'máxima' : 'activada') : 'desactivada'
        }. Instrumento: ${instrumentLabel}.${
          capoAvailable ? ` Capo: ${capo === 0 ? 'sin capo' : `traste ${capo}`}.` : ''
        }`}
      </p>
    </section>
  );
}
