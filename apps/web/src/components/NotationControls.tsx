import type { AccidentalPreference, Notation } from '@chordifree/chords';
import { IconAccidental, IconNote, IconTranspose, Tool } from './Toolbar';
import { useT } from '../i18n';

interface NotationControlsProps {
  notation: Notation;
  accidentalPreference: AccidentalPreference;
  transpose: number;
  hideAdvanced?: boolean;
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
  hideAdvanced = false,
  onChange,
}: NotationControlsProps) {
  const t = useT();
  return (
    <section className="contents" aria-label={t('notation.aria')}>
      <Tool label={t('notation.notation')} icon={<IconNote />} className="border-l-0">
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

      {hideAdvanced ? null : (
      <div className="tool">
        <span className="tool-head">
          <span className="tool-icon" aria-hidden="true">
            <IconAccidental />
          </span>
          <span className="tool-label">{t('notation.accidentals')}</span>
        </span>
        <div
          className="flex items-center gap-0.5"
          role="group"
          aria-label={t('notation.accidentals')}
        >
          <button
            type="button"
            className="tool-chip px-2 text-xs"
            aria-pressed={accidentalPreference === 'auto'}
            title={t('notation.auto')}
            onClick={() => onChange({ accidentalPreference: 'auto' })}
          >
            {t('notation.autoShort')}
          </button>
          <button
            type="button"
            className="tool-chip min-w-8 px-1.5 text-center text-lg leading-none"
            aria-pressed={accidentalPreference === 'sharp'}
            aria-label={t('notation.sharp')}
            title={t('notation.sharp')}
            onClick={() => onChange({ accidentalPreference: 'sharp' })}
          >
            ♯
          </button>
          <button
            type="button"
            className="tool-chip min-w-8 px-1.5 text-center text-lg leading-none"
            aria-pressed={accidentalPreference === 'flat'}
            aria-label={t('notation.flat')}
            title={t('notation.flat')}
            onClick={() => onChange({ accidentalPreference: 'flat' })}
          >
            ♭
          </button>
        </div>
      </div>
      )}

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

    </section>
  );
}
