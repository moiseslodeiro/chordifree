import { afterEach, describe, expect, it, vi } from 'vitest';
import { StemMixerAdapter } from '../src/player/stem-mixer';

class FakeAudio {
  static instances: FakeAudio[] = [];
  src: string;
  preload = '';
  volume = 1;
  currentTime = 0;
  paused = true;
  ended = false;
  playbackRate = 1;
  preservesPitch = true;
  readyState = 4;
  private readonly listeners = new Map<string, Set<() => void>>();

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }

  addEventListener(event: string, listener: () => void): void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
  }

  removeEventListener(event: string, listener: () => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  play(): Promise<void> {
    this.paused = false;
    this.emit('play');
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
    this.emit('pause');
  }

  load(): void {}

  removeAttribute(): void {
    this.src = '';
  }

  private emit(event: string): void {
    for (const listener of this.listeners.get(event) ?? []) listener();
  }
}

afterEach(() => {
  FakeAudio.instances = [];
  vi.unstubAllGlobals();
});

describe('StemMixerAdapter', () => {
  it('plays, pauses, seeks and mixes independent volumes', () => {
    vi.stubGlobal('Audio', FakeAudio);
    const adapter = new StemMixerAdapter(
      [
        { name: 'vocals', url: 'blob:vocals' },
        { name: 'drums', url: 'blob:drums' },
      ],
      { vocals: 0.5 },
    );
    const [vocals, drums] = FakeAudio.instances;

    expect(vocals?.volume).toBe(0.5);
    expect(drums?.volume).toBe(1);

    adapter.setStemVolume('drums', 0);
    expect(drums?.volume).toBe(0);

    adapter.play();
    expect(vocals?.paused).toBe(false);
    expect(drums?.paused).toBe(false);

    adapter.seekTo(12.5);
    expect(vocals?.currentTime).toBe(12.5);
    expect(drums?.currentTime).toBe(12.5);
    expect(adapter.getCurrentTime()).toBe(12.5);

    adapter.setPlaybackRate(1.25);
    expect(vocals?.playbackRate).toBe(1.25);
    expect(drums?.preservesPitch).toBe(true);

    adapter.pause();
    expect(vocals?.paused).toBe(true);

    adapter.destroy();
    expect(vocals?.src).toBe('');
  });

  it('notifies play state changes from the master stem', () => {
    vi.stubGlobal('Audio', FakeAudio);
    const adapter = new StemMixerAdapter([
      { name: 'vocals', url: 'blob:vocals' },
      { name: 'drums', url: 'blob:drums' },
    ]);
    const listener = vi.fn();
    adapter.onStateChange(listener);

    adapter.play();
    expect(listener).toHaveBeenLastCalledWith(true);
    adapter.pause();
    expect(listener).toHaveBeenLastCalledWith(false);
    adapter.destroy();
  });
});
