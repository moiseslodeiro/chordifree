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

type PresentationMode =
  | 'original'
  | 'simplified'
  | 'reduced'
  | 'simplified-reduced'
  | 'max'
  | 'simplified-max';

function modePatch(mode: PresentationMode): {
  simplifyChords: boolean;
  reduceChords: boolean;
  reduceChordsMax: boolean;
} {
  const simplified = mode === 'simplified' || mode === 'simplified-reduced' || mode === 'simplified-max';
  const reduced = mode !== 'original' && mode !== 'simplified';
  const maximum = mode === 'max' || mode === 'simplified-max';
  return { simplifyChords: simplified, reduceChords: reduced, reduceChordsMax: maximum };
}

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
  const presentationMode: PresentationMode = reduceChords
    ? reduceChordsMax
      ? simplifyChords
        ? 'simplified-max'
        : 'max'
      : simplifyChords
        ? 'simplified-reduced'
        : 'reduced'
    : simplifyChords
      ? 'simplified'
      : 'original';

  return (
    <section className="contents" aria-label={t('display.aria')}>
      <Tool label={t('display.presentation')} icon={<IconSliders />}>
        <select
          className="tool-select w-full max-w-56"
          value={presentationMode}
          onChange={(event) =>
            onChange(modePatch(event.target.value as PresentationMode))
          }
          aria-label={t('display.presentationModeAria')}
        >
          <option value="original">{t('display.modeOriginal')}</option>
          <option value="simplified">{t('display.modeSimplified')}</option>
          <option value="reduced">{t('display.modeReduced')}</option>
          <option value="simplified-reduced">{t('display.modeSimplifiedReduced')}</option>
          <option value="max">{t('display.modeMax')}</option>
          <option value="simplified-max">{t('display.modeSimplifiedMax')}</option>
        </select>
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
