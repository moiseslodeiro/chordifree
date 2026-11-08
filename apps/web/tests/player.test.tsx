import { act, render, renderHook } from '@testing-library/react';
import { memo } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { parseChord, type ChordSegment } from '@chordifree/chords';
import { FakePlayerAdapter } from '../src/player/fake';
import { AudioPlayerAdapter } from '../src/player/audio';
import { loadYouTubeApi, YouTubePlayerAdapter } from '../src/player/youtube';
import { PlaybackClock } from '../src/sync/clock';
import {
  useBeatIndex,
  useIsBeatActive,
  useIsRowActive,
  usePlaybackIndex,
} from '../src/sync/hooks';
import { videoIdFromUrl } from '../src/lib/youtube';

const segments: ChordSegment[] = [
  { start: 0, end: 4, chord: parseChord('C') },
  { start: 4, end: 8, chord: parseChord('G') },
  { start: 8, end: 12, chord: parseChord('Am') },
];

describe('FakePlayerAdapter', () => {
  it('avanza con el reloj solo al reproducir', () => {
    vi.useFakeTimers();
    try {
      const adapter = new FakePlayerAdapter(0, true);
      expect(adapter.getCurrentTime()).toBe(0);
      adapter.play();
      vi.advanceTimersByTime(1500);
      expect(adapter.getCurrentTime()).toBeCloseTo(1.5, 1);
      adapter.pause();
      vi.advanceTimersByTime(1000);
      expect(adapter.getCurrentTime()).toBeCloseTo(1.5, 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('permite buscar y notifica cambios de estado', () => {
    const adapter = new FakePlayerAdapter(0, false);
    const listener = vi.fn();
    const unsubscribe = adapter.onStateChange(listener);

    adapter.seekTo(30);
    expect(adapter.getCurrentTime()).toBe(30);
    adapter.play();
    expect(adapter.isPlaying()).toBe(true);
    expect(listener).toHaveBeenLastCalledWith(true);
    adapter.pause();
    expect(listener).toHaveBeenLastCalledWith(false);

    unsubscribe();
    adapter.play();
    expect(listener).toHaveBeenCalledTimes(2);
    adapter.destroy();
  });

  it('escala el tiempo según la velocidad y la limita al rango válido', () => {
    vi.useFakeTimers();
    try {
      const adapter = new FakePlayerAdapter(0, true);
      adapter.setPlaybackRate(0.5);
      expect(adapter.getPlaybackRate()).toBe(0.5);

      adapter.play();
      vi.advanceTimersByTime(2000);
      expect(adapter.getCurrentTime()).toBeCloseTo(1, 1);

      adapter.setPlaybackRate(5);
      expect(adapter.getPlaybackRate()).toBe(2);

      adapter.setPlaybackRate(Number.NaN);
      expect(adapter.getPlaybackRate()).toBe(1);
      adapter.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('AudioPlayerAdapter', () => {
  it('envuelve un elemento de audio y refleja play, pause y seek', () => {
    const element = document.createElement('audio');
    const adapter = new AudioPlayerAdapter(element);
    expect(adapter.element).toBe(element);

    adapter.seekTo(12.5);
    expect(element.currentTime).toBe(12.5);

    adapter.play();
    expect(adapter.isPlaying()).toBe(true);
    adapter.pause();
    expect(adapter.isPlaying()).toBe(false);

    adapter.setPlaybackRate(0.75);
    expect(adapter.getPlaybackRate()).toBe(0.75);
    expect(element.playbackRate).toBe(0.75);
    expect(element.preservesPitch).toBe(true);

    adapter.setPlaybackRate(10);
    expect(adapter.getPlaybackRate()).toBe(2);
    adapter.setPlaybackRate(Number.NaN);
    expect(adapter.getPlaybackRate()).toBe(1);

    adapter.destroy();
  });

  it('crea su propio elemento cuando recibe una URL', () => {
    const adapter = new AudioPlayerAdapter('https://example.test/audio.mp3');
    expect(adapter.element).toBeInstanceOf(HTMLAudioElement);
    adapter.destroy();
  });
});

describe('YouTubePlayerAdapter', () => {
  it('crea el reproductor y delega play, pause y seek', async () => {
    const calls: string[] = [];
    const handlers: { stateChange?: (event: { data: number }) => void } = {};

    class PlayerMock {
      constructor(_id: string, options: Record<string, any>) {
        handlers.stateChange = options.events.onStateChange;
      }
      getCurrentTime() {
        return 42;
      }
      seekTo(seconds: number) {
        calls.push(`seek:${seconds}`);
      }
      playVideo() {
        calls.push('play');
      }
      pauseVideo() {
        calls.push('pause');
      }
      getPlayerState() {
        return 1;
      }
      getPlaybackRate() {
        return 1;
      }
      setPlaybackRate(rate: number) {
        calls.push(`rate:${rate}`);
      }
      destroy() {
        calls.push('destroy');
      }
    }

    window.YT = {
      Player: PlayerMock as never,
      PlayerState: { PLAYING: 1, ENDED: 0 },
    };

    await loadYouTubeApi();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const onError = vi.fn();
    const adapter = new YouTubePlayerAdapter(container, 'dQw4w9WgXcQ', onError);

    await act(async () => {
      await Promise.resolve();
    });

    adapter.seekTo(12);
    adapter.play();
    adapter.pause();
    expect(calls).toEqual(['seek:12', 'play', 'pause']);
    expect(adapter.getCurrentTime()).toBe(42);

    adapter.setPlaybackRate(0.5);
    adapter.setPlaybackRate(9);
    expect(calls).toContain('rate:0.5');
    expect(calls).toContain('rate:2');
    expect(adapter.getPlaybackRate()).toBe(1);

    const listener = vi.fn();
    adapter.onStateChange(listener);
    handlers.stateChange?.({ data: 1 });
    expect(adapter.isPlaying()).toBe(true);
    expect(listener).toHaveBeenCalledWith(true);

    adapter.destroy();
    expect(calls).toContain('destroy');
    container.remove();
    delete window.YT;
  });
});

describe('PlaybackClock', () => {
  it('publica el índice activo y solo notifica cuando cambia', () => {
    const adapter = new FakePlayerAdapter(0, false);
    const clock = new PlaybackClock(adapter);
    clock.setSegments(segments);

    expect(clock.getIndex()).toBe(0);

    const listener = vi.fn();
    const unsubscribe = clock.subscribe(listener);

    act(() => {
      adapter.seekTo(4);
      clock.tickOnce();
    });
    expect(clock.getIndex()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);

    act(() => {
      adapter.seekTo(4.5);
      clock.tickOnce();
    });
    expect(listener).toHaveBeenCalledTimes(1);

    act(() => {
      adapter.seekTo(20);
      clock.tickOnce();
    });
    expect(clock.getIndex()).toBe(-1);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    clock.destroy();
  });

  it('integra useSyncExternalStore para leer el índice', () => {
    const adapter = new FakePlayerAdapter(0, false);
    const clock = new PlaybackClock(adapter);
    clock.setSegments(segments);

    const { result } = renderHook(() => usePlaybackIndex(clock));
    expect(result.current).toBe(0);

    act(() => {
      adapter.seekTo(9);
      clock.tickOnce();
    });
    expect(result.current).toBe(2);
    clock.destroy();
  });

  it('solo las filas afectadas cambian de estado al avanzar', () => {
    const adapter = new FakePlayerAdapter(0, false);
    const clock = new PlaybackClock(adapter);
    clock.setSegments(segments);
    const renders: Record<number, number> = { 0: 0, 1: 0, 2: 0 };

    const Row = memo(function Row({ index }: { index: number }) {
      renders[index] += 1;
      const active = useIsRowActive(clock, index);
      return <span data-testid={`row-${index}`}>{active ? 'activo' : 'inactivo'}</span>;
    });

    function Grid({ tick }: { tick: number }) {
      void tick;
      return (
        <>
          <Row index={0} />
          <Row index={1} />
          <Row index={2} />
        </>
      );
    }

    const { rerender } = render(<Grid tick={0} />);

    const before = { ...renders };
    act(() => {
      adapter.seekTo(4);
      clock.tickOnce();
    });
    rerender(<Grid tick={1} />);

    // La fila 0 deja de estar activa y la 1 pasa a estarlo; la 2 no cambia.
    expect(renders[0]).toBeGreaterThan(before[0]);
    expect(renders[2]).toBe(before[2]);
    expect(renders[1]).toBeGreaterThan(before[1]);
    clock.destroy();
  });

  it('publica el índice de pulso y solo notifica cuando cambia algún índice', () => {
    const adapter = new FakePlayerAdapter(0, false);
    const clock = new PlaybackClock(adapter);
    clock.setSegments(segments);
    clock.setBeats([0, 2, 4, 6]);
    expect(clock.getBeatIndex()).toBe(0);

    const listener = vi.fn();
    clock.subscribe(listener);

    act(() => {
      adapter.seekTo(1);
      clock.tickOnce();
    });
    expect(clock.getBeatIndex()).toBe(0);
    expect(listener).not.toHaveBeenCalled();

    act(() => {
      adapter.seekTo(2.5);
      clock.tickOnce();
    });
    expect(clock.getBeatIndex()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);

    act(() => {
      adapter.seekTo(4.5);
      clock.tickOnce();
    });
    expect(clock.getBeatIndex()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(2);

    act(() => {
      adapter.seekTo(20);
      clock.tickOnce();
    });
    expect(clock.getBeatIndex()).toBe(3);
    expect(listener).toHaveBeenCalledTimes(3);
    clock.destroy();
  });

  it('resuelve los bordes de búsqueda de pulsos', () => {
    const adapter = new FakePlayerAdapter(0, false);
    const clock = new PlaybackClock(adapter);
    clock.setSegments(segments);
    clock.setBeats([1, 3, 5]);

    expect(clock.getBeatIndex()).toBe(-1);
    act(() => {
      adapter.seekTo(1);
      clock.tickOnce();
    });
    expect(clock.getBeatIndex()).toBe(0);
    act(() => {
      adapter.seekTo(2.999);
      clock.tickOnce();
    });
    expect(clock.getBeatIndex()).toBe(0);
    act(() => {
      adapter.seekTo(3);
      clock.tickOnce();
    });
    expect(clock.getBeatIndex()).toBe(1);
    act(() => {
      adapter.seekTo(99);
      clock.tickOnce();
    });
    expect(clock.getBeatIndex()).toBe(2);
    clock.destroy();
  });

  it('integra useBeatIndex y useIsBeatActive', () => {
    const adapter = new FakePlayerAdapter(0, false);
    const clock = new PlaybackClock(adapter);
    clock.setSegments(segments);
    clock.setBeats([0, 2, 4]);
    const { result } = renderHook(() => useBeatIndex(clock));
    expect(result.current).toBe(0);

    act(() => {
      adapter.seekTo(2);
      clock.tickOnce();
    });
    expect(result.current).toBe(1);
    clock.destroy();
  });

  it('solo las celdas de pulso afectadas cambian de estado al avanzar', () => {
    const adapter = new FakePlayerAdapter(0, false);
    const clock = new PlaybackClock(adapter);
    clock.setSegments(segments);
    clock.setBeats([0, 2, 4]);
    const renders: Record<number, number> = { 0: 0, 1: 0, 2: 0 };

    const Cell = memo(function Cell({ index }: { index: number }) {
      renders[index] += 1;
      const active = useIsBeatActive(clock, index);
      return <span data-testid={`beat-${index}`}>{active ? 'activo' : 'inactivo'}</span>;
    });

    function Grid({ tick }: { tick: number }) {
      void tick;
      return (
        <>
          <Cell index={0} />
          <Cell index={1} />
          <Cell index={2} />
        </>
      );
    }

    const { rerender } = render(<Grid tick={0} />);
    const before = { ...renders };
    act(() => {
      adapter.seekTo(2);
      clock.tickOnce();
    });
    rerender(<Grid tick={1} />);

    expect(renders[0]).toBeGreaterThan(before[0]);
    expect(renders[1]).toBeGreaterThan(before[1]);
    expect(renders[2]).toBe(before[2]);
    clock.destroy();
  });
});

describe('videoIdFromUrl', () => {
  it('extrae el identificador de los formatos admitidos', () => {
    expect(videoIdFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(videoIdFromUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(videoIdFromUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('rechaza hosts, esquemas e identificadores inválidos', () => {
    expect(videoIdFromUrl('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(videoIdFromUrl('ftp://youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(videoIdFromUrl('https://youtu.be/abc')).toBeNull();
    expect(videoIdFromUrl('no es una url')).toBeNull();
  });
});
