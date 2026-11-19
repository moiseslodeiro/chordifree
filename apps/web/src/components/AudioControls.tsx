import { useEffect, type ReactNode } from 'react';
import { useT } from '../i18n';
import type { PlayerAdapter } from '../player/types';
import { MAX_PITCH, MIN_PITCH, PLAYBACK_RATES } from '../storage/practice';
import { CollapsibleCard } from './CollapsibleCard';

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

function KaraokeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
      <path d="M18 4h4M18 8h3" />
    </svg>
  );
}

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
    <CollapsibleCard
      title={t('audio.title')}
      meta={t('audio.eyebrow')}
      defaultOpen
      testId="audio-controls"
    >
      <div className="space-y-3 p-4">
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
            className="btn btn-primary w-full justify-center gap-2"
            aria-pressed={karaoke}
            title={t('practice.karaokeHint')}
            onClick={() => onKaraokeChange(!karaoke)}
          >
            <KaraokeIcon />
            {t('practice.karaoke')}
            {karaoke ? (
              <span
                className="size-1.5 rounded-full bg-white"
                aria-hidden="true"
                data-testid="karaoke-active-dot"
              />
            ) : null}
          </button>
        ) : null}

        {children ? <div className="border-t border-line pt-3">{children}</div> : null}
      </div>
    </CollapsibleCard>
  );
}
