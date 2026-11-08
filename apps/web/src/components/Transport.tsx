import { useEffect, useState } from 'react';
import { formatTime } from '@chordifree/chords';
import type { PlayerAdapter } from '../player/types';
import type { PlaybackClock } from '../sync/clock';

interface TransportProps {
  adapter: PlayerAdapter;
  clock: PlaybackClock;
  duration: number;
}

export function Transport({ adapter, clock, duration }: TransportProps) {
  const [playing, setPlaying] = useState(adapter.isPlaying());
  const [time, setTime] = useState(adapter.getCurrentTime());

  useEffect(() => {
    setPlaying(adapter.isPlaying());
    setTime(adapter.getCurrentTime());
    return adapter.onStateChange(setPlaying);
  }, [adapter]);

  useEffect(() => {
    const timer = window.setInterval(() => setTime(adapter.getCurrentTime()), 200);
    return () => window.clearInterval(timer);
  }, [adapter]);

  const toggle = () => {
    if (adapter.isPlaying()) adapter.pause();
    else adapter.play();
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
        aria-label={playing ? 'Pausar' : 'Reproducir'}
      >
        {playing ? 'Pausar' : 'Reproducir'}
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
        aria-label="Posición de reproducción"
        aria-valuetext={`${formatTime(time)} de ${formatTime(duration)}`}
      />
      <span className="w-12 font-mono text-xs tabular-nums text-ink3" aria-hidden="true">
        {formatTime(duration)}
      </span>
    </div>
  );
}
