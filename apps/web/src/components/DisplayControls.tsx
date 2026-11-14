import { supportsCapo, type Instrument } from '../types';
import { IconCapo, IconGuitar, IconSliders, Tool } from './Toolbar';
import { useT } from '../i18n';

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

const INSTRUMENTS: Array<{
  value: Instrument;
  label: 'instrument.guitar' | 'instrument.piano' | 'instrument.ukelele';
}> = [
  { value: 'guitar', label: 'instrument.guitar' },
  { value: 'piano', label: 'instrument.piano' },
  { value: 'ukelele', label: 'instrument.ukelele' },
];

export function DisplayControls({
  simplifyChords,
  reduceChords,
  reduceChordsMax,
  instrument,
  capo,
  onChange,
}: DisplayControlsProps) {
  const t = useT();
  const instrumentLabel = t(
    INSTRUMENTS.find((item) => item.value === instrument)?.label ?? 'instrument.guitar',
  );
  /** The capo only makes sense on string instruments. */
  const capoAvailable = supportsCapo(instrument);

  return (
    <section className="contents" aria-label={t('display.aria')}>
      <Tool label={t('display.presentation')} icon={<IconSliders />} className="sm:min-w-[13.5rem]">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            aria-pressed={simplifyChords}
            aria-label={t('display.simplifyAria')}
            title={t('display.simplifyTitle')}
            className="tool-chip"
            onClick={() => onChange({ simplifyChords: !simplifyChords })}
          >
            {t('display.simplify')}
          </button>
          <select
            className="tool-select w-24"
            value={reduceChords ? (reduceChordsMax ? 'max' : 'normal') : 'none'}
            onChange={(event) => {
              const value = event.target.value;
              onChange({
                reduceChords: value !== 'none',
                reduceChordsMax: value === 'max',
              });
            }}
            aria-label={t('display.reduction')}
          >
            <option value="none">{t('display.reductionNone')}</option>
            <option value="normal">{t('display.reductionNormal')}</option>
            <option value="max">{t('display.reductionMax')}</option>
          </select>
        </div>
      </Tool>

      <div className="tool">
        <span className="tool-head">
          <span className="tool-icon" aria-hidden="true">
            <IconGuitar />
          </span>
          <label htmlFor="instrument-select" className="tool-label">
            {t('display.instrument')}
          </label>
        </span>
        <div className="tool-value">
          <select
            id="instrument-select"
            className="tool-select"
            value={instrument}
            onChange={(event) => onChange({ instrument: event.target.value as Instrument })}
          >
            {INSTRUMENTS.map((item) => (
              <option key={item.value} value={item.value}>
                {t(item.label)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {capoAvailable ? (
        <div className="tool">
          <span className="tool-head">
            <span className="tool-icon" aria-hidden="true">
              <IconCapo />
            </span>
            <label htmlFor="capo-select" className="tool-label">
              Capo
            </label>
          </span>
          <div className="tool-value">
            <select
              id="capo-select"
              className="tool-select"
              value={capo}
              onChange={(event) => onChange({ capo: Number(event.target.value) })}
            >
              {Array.from({ length: 8 }, (_, fret) => (
                <option key={fret} value={fret}>
                  {fret === 0 ? t('display.noCapo') : t('display.fret', { fret })}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {`${t('display.summary', {
          simplify: simplifyChords ? t('display.on') : t('display.off'),
          reduce: reduceChords
            ? reduceChordsMax
              ? t('display.maximum')
              : t('display.on')
            : t('display.off'),
          instrument: instrumentLabel,
        })}${
          capoAvailable
            ? ` ${t('display.capoSummary', {
                value: capo === 0 ? t('display.noCapo') : t('display.fretLower', { fret: capo }),
              })}`
            : ''
        }`}
      </p>
    </section>
  );
}
