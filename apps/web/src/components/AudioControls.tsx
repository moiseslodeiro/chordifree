import { useEffect, type ReactNode } from 'react';
import { useT } from '../i18n';
import type { PlayerAdapter } from '../player/types';
import { MAX_PITCH, MIN_PITCH, PLAYBACK_RATES } from '../storage/practice';

interface AudioControlsProps {
  adapter: PlayerAdapter | null;
  rate: number;
  onRateChange: (value: number) => void;
  pitch: number;
  onPitchChange: (value: number) => void;
  pitchAvailable: boolean;
  karaoke: boolean;
  onKaraokeChange: (value: boolean) => void;
  karaokeAvailable: boolean;
  /** The stems block (or any other audio extra) when available. */
  children?: ReactNode;
}

const SPEEDS = PLAYBACK_RATES.map((value) => ({
  value,
  label: `${String(value).replace('.', ',')}×`,
}));

const PITCHES = Array.from({ length: MAX_PITCH - MIN_PITCH + 1 }, (_, index) => MIN_PITCH + index);

/**
 * "What you hear" controls, kept apart from the practice tools: playback
 * speed, audio pitch, karaoke and the optional stems plugin.
 */
export function AudioControls({
  adapter,
  rate,
  onRateChange,
  pitch,
  onPitchChange,
  pitchAvailable,
  karaoke,
  onKaraokeChange,
  karaokeAvailable,
  children,
}: AudioControlsProps) {
  const t = useT();

  useEffect(() => {
    adapter?.setPlaybackRate?.(rate);
  }, [adapter, rate]);

  return (
    <section
      className="rounded-xl border border-line bg-panel p-3 shadow-sm"
      aria-label={t('audio.title')}
      data-testid="audio-controls"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.16em] text-ink3">
          {t('audio.title')}
        </h2>
        <span className="eyebrow">{t('audio.eyebrow')}</span>
      </div>

      <div className="mt-3 space-y-2">
        <label className="flex items-center justify-between gap-2 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink3">
          {t('practice.rate')}
          <select
            className="tool-select font-mono text-xs normal-case tracking-normal"
            value={rate}
            onChange={(event) => onRateChange(Number(event.target.value))}
            aria-label={t('practice.rateLabel')}
          >
            {SPEEDS.map((speed) => (
              <option key={speed.value} value={speed.value}>
                {speed.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between gap-2 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink3">
          {t('practice.pitch')}
          <select
            className="tool-select font-mono text-xs tabular-nums normal-case tracking-normal"
            value={pitch}
            onChange={(event) => onPitchChange(Number(event.target.value))}
            aria-label={t('practice.pitchLabel')}
            disabled={!pitchAvailable}
            title={pitchAvailable ? t('practice.pitchTitle') : t('practice.pitchUnavailable')}
          >
            {PITCHES.map((value) => (
              <option key={value} value={value}>
                {value > 0 ? `+${value}` : value}
              </option>
            ))}
          </select>
        </label>

        {karaokeAvailable ? (
          <button
            type="button"
            className="practice-toggle"
            aria-pressed={karaoke}
            title={t('practice.karaokeHint')}
            onClick={() => onKaraokeChange(!karaoke)}
          >
            {t('practice.karaoke')}
          </button>
        ) : null}
      </div>

      {children ? <div className="mt-3 border-t border-line pt-3">{children}</div> : null}
    </section>
  );
}
