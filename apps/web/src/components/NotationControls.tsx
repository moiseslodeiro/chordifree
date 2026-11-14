import type { AccidentalPreference, Notation } from '@chordifree/chords';
import { IconAccidental, IconKey, IconNote, IconTranspose, Tool } from './Toolbar';
import { useT } from '../i18n';

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
  const t = useT();
  return (
    <section className="contents" aria-label={t('notation.aria')}>
      <Tool label={t('notation.notation')} icon={<IconNote />}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-pressed={notation === 'english'}
            className={notation === 'english' ? 'tool-chip-active' : 'tool-chip'}
            onClick={() => onChange({ notation: 'english' })}
          >
            {t('notation.english')}
          </button>
          <button
            type="button"
            aria-pressed={notation === 'spanish'}
            className={notation === 'spanish' ? 'tool-chip-active' : 'tool-chip'}
            onClick={() => onChange({ notation: 'spanish' })}
          >
            {t('notation.spanish')}
          </button>
        </div>
      </Tool>

      <div className="tool">
        <span className="tool-icon" aria-hidden="true">
          <IconAccidental />
        </span>
        <label htmlFor="accidental-preference" className="tool-label">
          {t('notation.accidentals')}
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
            <option value="auto">{t('notation.auto')}</option>
            <option value="sharp">{t('notation.sharp')} ♯</option>
            <option value="flat">{t('notation.flat')} ♭</option>
          </select>
        </div>
      </div>

      <Tool label={t('notation.transpose')} icon={<IconTranspose />}>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="tool-step"
            aria-label={t('notation.downSemitone')}
            onClick={() => onChange({ transpose: Math.max(-11, transpose - 1) })}
            disabled={transpose <= -11}
          >
            −
          </button>
          <button
            type="button"
            className="transpose-reset min-w-[2.75rem] px-1 font-mono text-sm tabular-nums text-ink transition hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`${t('notation.resetTranspose')} ${transpose > 0 ? `+${transpose}` : transpose}`}
            title={t('notation.resetTranspose')}
            onClick={() => onChange({ transpose: 0 })}
            disabled={transpose === 0}
          >
            {transpose > 0 ? `+${transpose}` : transpose}
          </button>
          <button
            type="button"
            className="tool-step"
            aria-label={t('notation.upSemitone')}
            onClick={() => onChange({ transpose: Math.min(11, transpose + 1) })}
            disabled={transpose >= 11}
          >
            +
          </button>
        </div>
      </Tool>

      <Tool label={t('notation.key')} icon={<IconKey />}>
        <span className="font-display text-base font-bold leading-none text-ink">{keyLabel ?? '—'}</span>
        <p className="sr-only">
          {keyLabel ? t('notation.estimatedKey', { key: keyLabel }) : t('notation.unknownKey')}
        </p>
      </Tool>
    </section>
  );
}
