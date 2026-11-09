import { useEffect, useState } from 'react';
import { formatTime } from '@chordifree/chords';
import type { PlayerAdapter } from '../player/types';
import { useT } from '../i18n';
import type { PlaybackClock } from '../sync/clock';

interface TransportProps {
  adapter: PlayerAdapter;
  clock: PlaybackClock;
  duration: number;
  loopA?: number | null;
  loopB?: number | null;
  loopEnabled?: boolean;
}

export function Transport({
  adapter,
  clock,
  duration,
  loopA = null,
  loopB = null,
  loopEnabled = false,
}: TransportProps) {
  const t = useT();
  const [playing, setPlaying] = useState(adapter.isPlaying());
  const [time, setTime] = useState(adapter.getCurrentTime());
  const hasRange = loopA !== null && loopB !== null && loopB > loopA;

  useEffect(() => {
    setPlaying(adapter.isPlaying());
    setTime(adapter.getCurrentTime());
    return adapter.onStateChange(setPlaying);
  }, [adapter]);

  useEffect(() => {
    const timer = window.setInterval(() => setTime(adapter.getCurrentTime()), 200);
    return () => window.clearInterval(timer);
  }, [adapter]);

  /** With a marked range, Play starts at A if the cursor is outside. */
  useEffect(() => {
    if (!hasRange || loopEnabled) return;
    const timer = window.setInterval(() => {
      if (!adapter.isPlaying()) return;
      if (adapter.getCurrentTime() < loopB - 0.05) return;
      adapter.pause();
      adapter.seekTo(loopB);
      clock.tickOnce();
      setTime(loopB);
    }, 80);
    return () => window.clearInterval(timer);
  }, [adapter, clock, hasRange, loopA, loopB, loopEnabled]);

  const toggle = () => {
    if (adapter.isPlaying()) {
      adapter.pause();
      return;
    }
    if (hasRange) {
      const current = adapter.getCurrentTime();
      if (current < loopA - 0.05 || current >= loopB - 0.05) {
        adapter.seekTo(loopA);
        clock.tickOnce();
        setTime(loopA);
      }
    }
    adapter.play();
  };

  const seek = (value: number) => {
    adapter.seekTo(value);
    clock.tickOnce();
    setTime(value);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-panel px-4 py-3 shadow-sm">
      <button
        type="button"
        className="btn btn-primary min-h-0 w-28 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em]"
        onClick={toggle}
        aria-label={playing ? t('transport.pause') : t('transport.play')}
      >
        {playing ? t('transport.pause') : t('transport.play')}
      </button>
      <span
        className="w-12 text-right font-mono text-sm tabular-nums text-ink"
        aria-hidden="true"
      >
        {formatTime(time)}
      </span>
      <input
        type="range"
        min={0}
        max={Math.max(0, duration)}
        step={0.1}
        value={Math.min(time, duration)}
        onChange={(event) => seek(Number(event.target.value))}
        className="range"
        aria-label={t('transport.position')}
        aria-valuetext={`${formatTime(time)} de ${formatTime(duration)}`}
      />
      <span className="w-12 font-mono text-xs tabular-nums text-ink3" aria-hidden="true">
        {formatTime(duration)}
      </span>
    </div>
  );
}
