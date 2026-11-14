import type { AccidentalPreference } from '@chordifree/chords';
import { supportsCapo, type Instrument } from '../types';
import { useT } from '../i18n';

interface MoreSettingsProps {
  accidentalPreference: AccidentalPreference;
  instrument: Instrument;
  capo: number;
  onChange: (patch: {
    accidentalPreference?: AccidentalPreference;
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

/** Secondary chord options that do not fit in the mobile toolbar. */
export function MoreSettings({
  accidentalPreference,
  instrument,
  capo,
  onChange,
}: MoreSettingsProps) {
  const t = useT();
  return (
    <details className="rounded-xl border border-line bg-panel px-4 py-3 shadow-sm">
      <summary className="cursor-pointer font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink3">
        {t('toolbar.moreSettings')}
      </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="tool-label block">{t('notation.accidentals')}</span>
          <select
            id="more-accidental"
            className="field mt-1 w-full"
            value={accidentalPreference}
            onChange={(event) =>
              onChange({ accidentalPreference: event.target.value as AccidentalPreference })
            }
          >
            <option value="auto">{t('notation.auto')}</option>
            <option value="sharp">{t('notation.sharp')} ♯</option>
            <option value="flat">{t('notation.flat')} ♭</option>
          </select>
        </label>

        <label className="block">
          <span className="tool-label block">{t('display.instrument')}</span>
          <select
            id="more-instrument"
            className="field mt-1 w-full"
            value={instrument}
            onChange={(event) => onChange({ instrument: event.target.value as Instrument })}
          >
            {INSTRUMENTS.map((item) => (
              <option key={item.value} value={item.value}>
                {t(item.label)}
              </option>
            ))}
          </select>
        </label>

        {supportsCapo(instrument) ? (
          <label className="block">
            <span className="tool-label block">{t('display.capo')}</span>
            <select
              id="more-capo"
              className="field mt-1 w-full"
              value={capo}
              onChange={(event) => onChange({ capo: Number(event.target.value) })}
            >
              {Array.from({ length: 8 }, (_, fret) => (
                <option key={fret} value={fret}>
                  {fret === 0 ? t('display.noCapo') : t('display.fret', { fret })}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </details>
  );
}
