import { useCallback, useEffect, useRef, useState } from 'react';
import { formatTime } from '@chordifree/chords';
import { tempoFromBeats } from '../grid/beats';
import type { PlayerAdapter } from '../player/types';
import type { PlaybackClock } from '../sync/clock';
import { barRangeAt, firstBeatAtOrAfter } from '../practice/range';

interface PracticeBarProps {
  adapter: PlayerAdapter;
  clock: PlaybackClock;
  beats: number[];
  beatsPerBar: number;
  duration: number;
  loopA: number | null;
  loopB: number | null;
  onLoopAChange: (value: number | null) => void;
  onLoopBChange: (value: number | null) => void;
}

const SPEEDS = [
  { value: 0.5, label: '0,5×' },
  { value: 0.75, label: '0,75×' },
  { value: 1, label: '1×' },
];

type AudioContextConstructor = typeof AudioContext;

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const candidate =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  return candidate ?? null;
}

function playClick(context: AudioContext, when: number, accent: boolean): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = accent ? 1568 : 1047;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(accent ? 0.18 : 0.11, when + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.055);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(when);
  oscillator.stop(when + 0.07);
}

export function PracticeBar({
  adapter,
  clock,
  beats,
  beatsPerBar,
  duration,
  loopA,
  loopB,
  onLoopAChange,
  onLoopBChange,
}: PracticeBarProps) {
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [rate, setRate] = useState(() => adapter.getPlaybackRate?.() ?? 1);
  const [metronome, setMetronome] = useState(false);
  const [countingIn, setCountingIn] = useState(false);

  const audioRef = useRef<AudioContext | null>(null);
  const countInTimer = useRef<number | null>(null);
  const lastLoopSeek = useRef(0);

  const ensureAudio = useCallback(() => {
    const current = audioRef.current;
    if (current) {
      void current.resume();
      return current;
    }
    const Constructor = audioContextConstructor();
    if (!Constructor) return null;
    const context = new Constructor();
    audioRef.current = context;
    void context.resume();
    return context;
  }, []);

  useEffect(() => {
    setRate(adapter.getPlaybackRate?.() ?? 1);
  }, [adapter]);

  useEffect(() => {
    adapter.setPlaybackRate?.(rate);
  }, [adapter, rate]);

  useEffect(() => {
    if (loopEnabled && (loopA === null || loopB === null || loopB <= loopA)) {
      setLoopEnabled(false);
    }
  }, [loopA, loopB, loopEnabled]);

  useEffect(() => {
    if (!loopEnabled || loopA === null || loopB === null || loopB <= loopA) return;
    const timer = window.setInterval(() => {
      if (!adapter.isPlaying()) return;
      const time = adapter.getCurrentTime();
      if (time < loopB - 0.05) return;
      const now = Date.now();
      if (now - lastLoopSeek.current < 300) return;
      lastLoopSeek.current = now;
      adapter.seekTo(loopA);
      clock.tickOnce();
    }, 80);
    return () => window.clearInterval(timer);
  }, [loopEnabled, loopA, loopB, adapter, clock]);

  useEffect(() => {
    if (!metronome) return;
    const context = ensureAudio();
    if (!context) return;

    let nextIndex = -1;
    let lastTime = 0;

    const schedule = () => {
      if (!adapter.isPlaying()) {
        nextIndex = -1;
        return;
      }
      const now = adapter.getCurrentTime();
      const currentRate = Math.max(0.25, adapter.getPlaybackRate?.() ?? 1);
      if (now < lastTime - 0.2 || now > lastTime + 1.5) nextIndex = -1;
      lastTime = now;
      if (nextIndex < 0) nextIndex = firstBeatAtOrAfter(beats, now);

      const horizon = now + 0.2 * currentRate;
      while (nextIndex >= 0 && nextIndex < beats.length) {
        const beatTime = beats[nextIndex]!;
        if (beatTime >= horizon) break;
        if (beatTime >= now - 0.04) {
          const when = context.currentTime + Math.max(0, (beatTime - now) / currentRate);
          playClick(context, when, nextIndex % beatsPerBar === 0);
        }
        nextIndex += 1;
      }
    };

    schedule();
    const timer = window.setInterval(schedule, 50);
    return () => window.clearInterval(timer);
  }, [metronome, adapter, beats, beatsPerBar, ensureAudio]);

  useEffect(() => {
    return () => {
      if (countInTimer.current !== null) window.clearTimeout(countInTimer.current);
      void audioRef.current?.close();
      audioRef.current = null;
    };
  }, []);

  const markA = () => {
    const range = barRangeAt(adapter.getCurrentTime(), beats, beatsPerBar, duration);
    onLoopAChange(range.start);
    if (loopB !== null && loopB <= range.start) onLoopBChange(null);
  };

  const markB = () => {
    const range = barRangeAt(adapter.getCurrentTime(), beats, beatsPerBar, duration);
    onLoopBChange(range.end);
    if (loopA === null || loopA >= range.end) onLoopAChange(range.start);
  };

  const repeatBar = () => {
    const range = barRangeAt(adapter.getCurrentTime(), beats, beatsPerBar, duration);
    onLoopAChange(range.start);
    onLoopBChange(range.end);
    setLoopEnabled(true);
    adapter.seekTo(range.start);
    clock.tickOnce();
  };

  const toggleLoop = () => {
    if (loopEnabled) {
      setLoopEnabled(false);
      return;
    }
    if (loopA === null || loopB === null) return;
    const time = adapter.getCurrentTime();
    if (time < loopA || time >= loopB) {
      adapter.seekTo(loopA);
      clock.tickOnce();
    }
    setLoopEnabled(true);
  };

  const clearLoop = () => {
    setLoopEnabled(false);
    onLoopAChange(null);
    onLoopBChange(null);
  };

  const startCountIn = () => {
    if (countingIn) return;
    adapter.pause();
    if (loopEnabled && loopA !== null) {
      adapter.seekTo(loopA);
      clock.tickOnce();
    }
    const context = ensureAudio();
    const bpm = tempoFromBeats(beats) ?? 90;
    const interval = 60 / Math.max(40, bpm);
    if (context) {
      for (let index = 0; index < 4; index += 1) {
        playClick(context, context.currentTime + index * interval, index === 0);
      }
    }
    setCountingIn(true);
    countInTimer.current = window.setTimeout(() => {
      setCountingIn(false);
      countInTimer.current = null;
      adapter.play();
    }, interval * 4 * 1000);
  };

  const hasRange = loopA !== null && loopB !== null && loopB > loopA;
  const rangeLabel = hasRange
    ? `${formatTime(loopA)} – ${formatTime(loopB)}`
    : 'Marca A y B';

  return (
    <section
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-panel px-4 py-3 shadow-sm"
      aria-label="Herramientas de práctica"
    >
      <span className="eyebrow">Práctica</span>

      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Bucle A-B">
        <button
          type="button"
          className={loopA !== null ? 'tool-chip tool-chip-a' : 'tool-chip'}
          aria-pressed={loopA !== null}
          aria-label="Marcar inicio A en el compás actual"
          title="Marcar el inicio del bucle en el compás actual"
          onClick={markA}
        >
          A
        </button>
        <button
          type="button"
          className={loopB !== null ? 'tool-chip tool-chip-b' : 'tool-chip'}
          aria-pressed={loopB !== null}
          aria-label="Marcar final B en el compás actual"
          title="Marcar el final del bucle al terminar el compás actual"
          onClick={markB}
        >
          B
        </button>
        <button
          type="button"
          className={loopEnabled ? 'tool-chip-active' : 'tool-chip'}
          aria-pressed={loopEnabled}
          disabled={!hasRange}
          title="Activar o desactivar la repetición A-B"
          onClick={toggleLoop}
        >
          Bucle
        </button>
        <button
          type="button"
          className="tool-chip"
          disabled={loopA === null && loopB === null}
          onClick={clearLoop}
        >
          Limpiar
        </button>
      </div>

      <span className="font-mono text-[0.62rem] uppercase tabular-nums tracking-[0.1em] text-ink3">
        {rangeLabel}
      </span>

      <button
        type="button"
        className="btn min-h-0 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.1em]"
        onClick={repeatBar}
      >
        Repetir compás
      </button>

      <label className="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink3">
        Velocidad
        <select
          className="tool-select font-mono text-xs normal-case tracking-normal"
          value={rate}
          onChange={(event) => setRate(Number(event.target.value))}
          aria-label="Velocidad de reproducción"
        >
          {SPEEDS.map((speed) => (
            <option key={speed.value} value={speed.value}>
              {speed.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className={metronome ? 'tool-chip-active' : 'tool-chip'}
        aria-pressed={metronome}
        disabled={beats.length === 0}
        title="Activar o desactivar el clic del metrónomo"
        onClick={() => setMetronome((value) => !value)}
      >
        Metrónomo
      </button>

      <button
        type="button"
        className="btn min-h-0 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.1em]"
        onClick={startCountIn}
        disabled={countingIn}
      >
        {countingIn ? 'Contando…' : 'Cuenta atrás'}
      </button>
    </section>
  );
}
