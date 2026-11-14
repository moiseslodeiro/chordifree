import { supportsCapo, type Instrument } from '../types';
import { IconCapo, IconGuitar, IconSliders, Tool } from './Toolbar';
import { useT } from '../i18n';

interface DisplayControlsProps {
  simplifyChords: boolean;
  reduceChords: boolean;
  reduceChordsMax: boolean;
  instrument: Instrument;
  capo: number;
  hideAdvanced?: boolean;
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
  hideAdvanced = false,
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
      <Tool label={t('display.presentation')} icon={<IconSliders />} className="sm:min-w-[21rem]">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)] sm:items-start">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-ink2">
            <input
              type="checkbox"
              className="size-3.5 accent-accent"
              checked={simplifyChords}
              onChange={(event) => onChange({ simplifyChords: event.target.checked })}
            />
            {t('display.simplify')}
          </label>
          <label className="flex flex-col gap-1">
            <span className="tool-label">{t('display.reduction')}</span>
            <select
              className="tool-select w-full"
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
          </label>
        </div>
      </Tool>

      {hideAdvanced ? null : (
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
      )}

      {hideAdvanced || !capoAvailable ? null : (
        <div className="tool">
          <span className="tool-head">
            <span className="tool-icon" aria-hidden="true">
              <IconCapo />
            </span>
            <label htmlFor="capo-select" className="tool-label">
              {t('display.capo')}
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
      )}

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
