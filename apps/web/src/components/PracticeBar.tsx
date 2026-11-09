import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatTime } from '@chordifree/chords';
import { tempoFromBeats } from '../grid/beats';
import type { PlayerAdapter } from '../player/types';
import { MAX_BPM, MIN_BPM, PLAYBACK_RATES } from '../storage/practice';
import type { PlaybackClock } from '../sync/clock';
import { useT } from '../i18n';
import { barRangeAt, firstBeatAtOrAfter } from '../practice/range';

interface PracticeBarProps {
  adapter: PlayerAdapter;
  clock: PlaybackClock;
  beats: number[];
  beatsPerBar: number;
  duration: number;
  loopA: number | null;
  loopB: number | null;
  loopEnabled: boolean;
  onLoopAChange: (value: number | null) => void;
  onLoopBChange: (value: number | null) => void;
  onLoopEnabledChange: (value: boolean) => void;
  markMode: 'a' | 'b' | null;
  onMarkModeChange: (value: 'a' | 'b' | null) => void;
  rate: number;
  onRateChange: (value: number) => void;
  manualBpm: number;
  onManualBpmChange: (value: number) => void;
}

const SPEEDS = PLAYBACK_RATES.map((value) => ({
  value,
  label: `${String(value).replace('.', ',')}×`,
}));

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
  loopEnabled,
  onLoopAChange,
  onLoopBChange,
  onLoopEnabledChange,
  markMode,
  onMarkModeChange,
  rate,
  onRateChange,
  manualBpm,
  onManualBpmChange,
}: PracticeBarProps) {
  const t = useT();
  const [metronome, setMetronome] = useState(false);
  const [countingIn, setCountingIn] = useState(false);
  const [bpmDraft, setBpmDraft] = useState(String(manualBpm));

  const audioRef = useRef<AudioContext | null>(null);
  const countInTimer = useRef<number | null>(null);
  const lastLoopSeek = useRef(0);

  useEffect(() => {
    setBpmDraft(String(manualBpm));
  }, [manualBpm]);

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
    adapter.setPlaybackRate?.(rate);
  }, [adapter, rate]);

  useEffect(() => {
    if (loopEnabled && (loopA === null || loopB === null || loopB <= loopA)) {
      onLoopEnabledChange(false);
    }
  }, [loopA, loopB, loopEnabled, onLoopEnabledChange]);

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

  const metronomeBeats = useMemo(() => {
    if (beats.length > 0) return beats;
    const interval = 60 / Math.max(MIN_BPM, Math.min(MAX_BPM, manualBpm));
    const count = Math.max(1, Math.ceil(Math.max(0, duration) / interval));
    return Array.from({ length: count }, (_, index) => index * interval);
  }, [beats, manualBpm, duration]);

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
      if (nextIndex < 0) nextIndex = firstBeatAtOrAfter(metronomeBeats, now);

      const horizon = now + 0.2 * currentRate;
      while (nextIndex >= 0 && nextIndex < metronomeBeats.length) {
        const beatTime = metronomeBeats[nextIndex]!;
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
  }, [metronome, adapter, metronomeBeats, beatsPerBar, ensureAudio]);

  useEffect(() => {
    return () => {
      if (countInTimer.current !== null) window.clearTimeout(countInTimer.current);
      void audioRef.current?.close();
      audioRef.current = null;
    };
  }, []);

  const repeatBar = () => {
    const range = barRangeAt(adapter.getCurrentTime(), beats, beatsPerBar, duration);
    onLoopAChange(range.start);
    onLoopBChange(range.end);
    onLoopEnabledChange(true);
    onMarkModeChange(null);
    adapter.seekTo(range.start);
    clock.tickOnce();
  };

  const toggleLoop = () => {
    if (loopEnabled) {
      onLoopEnabledChange(false);
      return;
    }
    if (loopA === null || loopB === null) return;
    const time = adapter.getCurrentTime();
    if (time < loopA || time >= loopB) {
      adapter.seekTo(loopA);
      clock.tickOnce();
    }
    onLoopEnabledChange(true);
  };

  const clearLoop = () => {
    onLoopEnabledChange(false);
    onLoopAChange(null);
    onLoopBChange(null);
    onMarkModeChange(null);
  };

  const commitManualBpm = () => {
    const parsed = Number(bpmDraft);
    const next = Number.isFinite(parsed)
      ? Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(parsed)))
      : manualBpm;
    setBpmDraft(String(next));
    onManualBpmChange(next);
  };

  const startCountIn = () => {
    if (countingIn) return;
    adapter.pause();
    if (loopEnabled && loopA !== null) {
      adapter.seekTo(loopA);
      clock.tickOnce();
    }
    const context = ensureAudio();
    const bpm = tempoFromBeats(beats) ?? manualBpm;
    const interval = 60 / Math.max(MIN_BPM, bpm);
    const countBeats = Math.max(1, Math.floor(beatsPerBar) || 4);
    if (context) {
      for (let index = 0; index < countBeats; index += 1) {
        playClick(context, context.currentTime + index * interval, index === 0);
      }
    }
    setCountingIn(true);
    countInTimer.current = window.setTimeout(() => {
      setCountingIn(false);
      countInTimer.current = null;
      adapter.play();
    }, interval * countBeats * 1000);
  };

  const hasRange = loopA !== null && loopB !== null && loopB > loopA;
  const rangeLabel =
    markMode === 'a'
      ? t('practice.chooseA')
      : markMode === 'b'
        ? t('practice.chooseB')
        : hasRange
          ? `${formatTime(loopA)} – ${formatTime(loopB)}`
          : t('practice.noRange');

  const toggleMarkMode = (mode: 'a' | 'b') => {
    onMarkModeChange(markMode === mode ? null : mode);
  };

  const aClassName = `tool-chip${
    markMode === 'a' ? ' tool-chip-a' : loopA !== null ? ' tool-chip-set tool-chip-set-a' : ''
  }`;
  const bClassName = `tool-chip${
    markMode === 'b' ? ' tool-chip-b' : loopB !== null ? ' tool-chip-set tool-chip-set-b' : ''
  }`;

  return (
    <section
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-panel px-4 py-3 shadow-sm"
      aria-label={t('practice.aria')}
    >
      <span className="eyebrow"> {t('practice.eyebrow')} </span>

      <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t('practice.loopGroup')}>
        <button
          type="button"
          className={aClassName}
          aria-pressed={markMode === 'a'}
          data-set={loopA !== null ? 'true' : undefined}
          aria-label={t('practice.markA')}
          title={t('practice.markATitle')}
          onClick={() => toggleMarkMode('a')}
        >
          A
        </button>
        <button
          type="button"
          className={bClassName}
          aria-pressed={markMode === 'b'}
          data-set={loopB !== null ? 'true' : undefined}
          aria-label={t('practice.markB')}
          title={t('practice.markBTitle')}
          onClick={() => toggleMarkMode('b')}
        >
          B
        </button>
        <button
          type="button"
          className={loopEnabled ? 'tool-chip-active' : 'tool-chip'}
          aria-pressed={loopEnabled}
          disabled={!hasRange}
          title={t('practice.loopTitle')}
          onClick={toggleLoop}
        >
          {t('practice.loop')}
        </button>
        <button
          type="button"
          className="tool-chip"
          disabled={loopA === null && loopB === null}
          onClick={clearLoop}
        >
          {t('practice.clear')}
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
        {t('practice.repeatBar')}
      </button>

      <label className="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink3">
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

      {beats.length === 0 ? (
        <label className="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink3">
          {t('practice.bpm')}
          <input
            type="number"
            className="tool-select w-16 font-mono text-xs tabular-nums normal-case tracking-normal"
            min={MIN_BPM}
            max={MAX_BPM}
            step={1}
            value={bpmDraft}
            onChange={(event) => setBpmDraft(event.target.value)}
            onBlur={commitManualBpm}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            aria-label={t('practice.bpmLabel')}
          />
        </label>
      ) : null}

      <button
        type="button"
        className={metronome ? 'tool-chip-active' : 'tool-chip'}
        aria-pressed={metronome}
        disabled={duration <= 0}
        title={
          beats.length === 0
            ? t('practice.metronomeManual')
            : t('practice.metronomeOn')
        }
        onClick={() => setMetronome((value) => !value)}
      >
        {t('practice.metronome')}
      </button>

      <button
        type="button"
        className="btn min-h-0 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.1em]"
        onClick={startCountIn}
        disabled={countingIn}
      >
        {countingIn ? t('practice.counting') : t('practice.countIn')}
      </button>
    </section>
  );
}
