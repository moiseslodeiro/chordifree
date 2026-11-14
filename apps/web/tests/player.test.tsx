import { act, render, renderHook } from '@testing-library/react';
import { memo } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseChord, type ChordSegment } from '@chordifree/chords';
import { FakePlayerAdapter } from '../src/player/fake';
import { AudioPlayerAdapter, pitchShiftLatency } from '../src/player/audio';
import { loadYouTubeApi, YouTubePlayerAdapter } from '../src/player/youtube';
import { PlaybackClock } from '../src/sync/clock';
import {
  useBeatIndex,
  useIsBeatActive,
  useIsRowActive,
  usePlaybackIndex,
} from '../src/sync/hooks';
import { videoIdFromUrl } from '../src/lib/youtube';

const audioMock = vi.hoisted(() => {
  type FakeNode = {
    pitchSemitones: { value: number };
    playbackRate: { value: number };
    connected: boolean;
    disconnected: boolean;
    stretchParameters: unknown;
    setStretchParameters(params: unknown): void;
    connect(): void;
    disconnect(): void;
  };
  type FakeSource = { connected: boolean; connect(): void };

  const contexts: FakeAudioContext[] = [];
  const nodes: FakeNode[] = [];
  const registers: Array<{ context: unknown; url: string | URL }> = [];

  class FakeSoundTouchNode {
    pitchSemitones = { value: 0 };
    playbackRate = { value: 1 };
    connected = false;
    disconnected = false;
    stretchParameters: unknown = null;

    constructor() {
      nodes.push(this);
    }

    static async register(context: unknown, url: string | URL): Promise<void> {
      registers.push({ context, url });
    }

    setStretchParameters(params: unknown): void {
      this.stretchParameters = params;
    }

    connect(): void {
      this.connected = true;
    }

    disconnect(): void {
      this.disconnected = true;
    }
  }

  class FakeAudioContext {
    sampleRate = 48000;
    baseLatency = 0;
    outputLatency = 0;
    state = 'running';
    destination = {};
    sources: FakeSource[] = [];
    closed = false;
    resume = async () => undefined;
    close = async () => {
      this.closed = true;
    };

    constructor() {
      contexts.push(this);
    }

    createMediaElementSource(): FakeSource {
      const source: FakeSource = {
        connected: false,
        connect: () => {
          source.connected = true;
        },
      };
      this.sources.push(source);
      return source;
    }
  }

  return { contexts, nodes, registers, FakeSoundTouchNode, FakeAudioContext };
});

vi.mock('@soundtouchjs/audio-worklet', () => ({
  SoundTouchNode: audioMock.FakeSoundTouchNode,
}));

vi.mock('@soundtouchjs/audio-worklet/processor?url', () => ({
  default: '/processor.js',
}));

afterEach(() => {
  vi.unstubAllGlobals();
  audioMock.contexts.length = 0;
  audioMock.nodes.length = 0;
  audioMock.registers.length = 0;
});

const segments: ChordSegment[] = [
  { start: 0, end: 4, chord: parseChord('C') },
  { start: 4, end: 8, chord: parseChord('G') },
  { start: 8, end: 12, chord: parseChord('Am') },
];

describe('FakePlayerAdapter', () => {
  it('advances with the clock only during playback', () => {
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

  it('allows seeking and notifies state changes', () => {
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

  it('scales time by the playback rate and clamps it to the valid range', () => {
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
  it('wraps an audio element and reflects play, pause and seek', () => {
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

  it('creates its own element when given a URL', () => {
    const adapter = new AudioPlayerAdapter('https://example.test/audio.mp3');
    expect(adapter.element).toBeInstanceOf(HTMLAudioElement);
    adapter.destroy();
  });
});

describe('AudioPlayerAdapter pitch shift', () => {
  it('routes the element through SoundTouch only when the pitch is not zero', async () => {
    vi.stubGlobal('AudioContext', audioMock.FakeAudioContext);
    const element = document.createElement('audio');
    const adapter = new AudioPlayerAdapter(element);

    adapter.play();
    await Promise.resolve();
    expect(audioMock.contexts).toHaveLength(0);
    expect(audioMock.nodes).toHaveLength(0);

    adapter.setPitch(3);
    await vi.waitFor(() => expect(audioMock.nodes).toHaveLength(1));

    const node = audioMock.nodes[0]!;
    expect(audioMock.registers).toEqual([{ context: audioMock.contexts[0], url: '/processor.js' }]);
    expect(node.pitchSemitones.value).toBe(3);
    expect(node.playbackRate.value).toBe(1);
    expect(node.stretchParameters).toEqual({ sequenceMs: 60, seekWindowMs: 20, overlapMs: 8 });
    expect(node.connected).toBe(true);
    expect(audioMock.contexts[0]!.sources[0]!.connected).toBe(true);
    expect(element.preservesPitch).toBe(false);

    adapter.setPitch(-2);
    expect(node.pitchSemitones.value).toBe(-2);

    adapter.setPitch(0);
    expect(node.pitchSemitones.value).toBe(0);
    expect(audioMock.nodes).toHaveLength(1);

    adapter.destroy();
    expect(node.disconnected).toBe(true);
    await vi.waitFor(() => expect(audioMock.contexts[0]!.closed).toBe(true));
  });

  it('keeps the pitch when the playback rate changes', async () => {
    vi.stubGlobal('AudioContext', audioMock.FakeAudioContext);
    const element = document.createElement('audio');
    const adapter = new AudioPlayerAdapter(element);
    adapter.setPitch(4);
    await vi.waitFor(() => expect(audioMock.nodes).toHaveLength(1));

    adapter.setPlaybackRate(1.5);
    expect(element.playbackRate).toBe(1.5);
    expect(audioMock.nodes[0]!.playbackRate.value).toBe(1.5);
    expect(element.preservesPitch).toBe(false);

    adapter.setPitch(4);
    expect(audioMock.nodes).toHaveLength(1);
    adapter.destroy();
  });

  it('subtracts the processing latency from the playback clock', async () => {
    vi.stubGlobal('AudioContext', audioMock.FakeAudioContext);
    const element = document.createElement('audio');
    const adapter = new AudioPlayerAdapter(element);
    adapter.setPitch(-12);
    await vi.waitFor(() => expect(audioMock.nodes).toHaveLength(1));

    adapter.setPlaybackRate(1.5);
    adapter.seekTo(2);
    adapter.play();

    const latency = pitchShiftLatency(1.5);
    expect(adapter.getCurrentTime()).toBeCloseTo(2 - latency, 6);

    adapter.pause();
    expect(adapter.getCurrentTime()).toBe(2);
    adapter.destroy();
  });

  it('estimates the latency from the shift window and the playback rate', () => {
    expect(pitchShiftLatency(1)).toBeCloseTo(0.08, 6);
    expect(pitchShiftLatency(0.5)).toBeCloseTo(0.04, 6);
    expect(pitchShiftLatency(1.5)).toBeCloseTo(0.12, 6);
    expect(pitchShiftLatency(2)).toBeCloseTo(0.16, 6);
    expect(pitchShiftLatency(Number.NaN)).toBeCloseTo(0.08, 6);
  });
});

describe('YouTubePlayerAdapter', () => {
  it('creates the player and delegates play, pause and seek', async () => {
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
  it('publishes the active index and only notifies when it changes', () => {
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

  it('integrates useSyncExternalStore to read the index', () => {
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

  it('only the affected rows change state as playback advances', () => {
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

    // Row 0 stops being active and row 1 becomes active; row 2 does not change.
    expect(renders[0]).toBeGreaterThan(before[0]);
    expect(renders[2]).toBe(before[2]);
    expect(renders[1]).toBeGreaterThan(before[1]);
    clock.destroy();
  });

  it('publishes the beat index and only notifies when an index changes', () => {
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

  it('resolves beat search boundaries', () => {
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

  it('integrates useBeatIndex and useIsBeatActive', () => {
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

  it('only the affected beat cells change state as playback advances', () => {
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
  it('extracts the ID from supported formats', () => {
    expect(videoIdFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(videoIdFromUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(videoIdFromUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('rejects invalid hosts, schemes and IDs', () => {
    expect(videoIdFromUrl('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(videoIdFromUrl('ftp://youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(videoIdFromUrl('https://youtu.be/abc')).toBeNull();
    expect(videoIdFromUrl('no es una url')).toBeNull();
  });
});
