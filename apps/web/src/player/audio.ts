import type { SoundTouchNode as SoundTouchNodeType } from '@soundtouchjs/audio-worklet';
import type { PlayerAdapter } from './types';

type AudioContextConstructor = typeof AudioContext;

/**
 * WSOLA window used by the pitch shifter. The library default (around 110 ms
 * of sequence) is smoother but adds noticeable latency, and the chord grid is
 * driven by the audio clock. These values keep the shift usable while the
 * display stays close to what the listener hears.
 */
const STRETCH = { sequenceMs: 60, seekWindowMs: 20, overlapMs: 8 };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Latency introduced by the pitch shifter, in seconds of media time. The
 * processor needs a full sequence plus its seek window before it can emit
 * audio, and media time advances `rate` times faster while it fills.
 *
 * Measured with the fixed window above, the delay is 56–77 ms at 1x and
 * 125–174 ms at 1.5x–2x depending on the pitch. Using the window length keeps
 * the grid within a few dozen milliseconds of the shifted audio.
 */
export function pitchShiftLatency(rate: number): number {
  const safeRate = clamp(Number.isFinite(rate) ? rate : 1, 0.25, 2);
  return ((STRETCH.sequenceMs + STRETCH.seekWindowMs) / 1000) * safeRate;
}

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const candidate =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  return candidate ?? null;
}

export class AudioPlayerAdapter implements PlayerAdapter {
  private readonly audio: HTMLAudioElement;
  private readonly ownsElement: boolean;
  private readonly listeners = new Set<(playing: boolean) => void>();
  private readonly detach: Array<() => void> = [];
  private pitch = 0;
  private context: AudioContext | null = null;
  private shifter: SoundTouchNodeType | null = null;
  private graph: Promise<void> | null = null;

  constructor(source: string | HTMLAudioElement) {
    this.ownsElement = typeof source === 'string';
    this.audio = this.ownsElement ? new Audio(source as string) : (source as HTMLAudioElement);
    this.audio.preload = 'metadata';
    const notify = () => this.emit();
    for (const event of ['play', 'pause', 'ended'] as const) {
      this.audio.addEventListener(event, notify);
      this.detach.push(() => this.audio.removeEventListener(event, notify));
    }
  }

  get element(): HTMLAudioElement {
    return this.audio;
  }

  getCurrentTime(): number {
    const time = this.audio.currentTime || 0;
    if (!this.shifter || this.audio.paused) return time;
    return Math.max(0, time - this.latency());
  }

  seekTo(seconds: number): void {
    this.audio.currentTime = Math.max(0, seconds);
  }

  play(): void {
    // Start immediately; the worklet is wired in parallel on the first play.
    // Without a pitch shift the element stays on the native audio path.
    if (this.pitch !== 0) void this.ensureGraph();
    void this.audio.play().catch(() => undefined);
  }

  pause(): void {
    this.audio.pause();
  }

  isPlaying(): boolean {
    return !this.audio.paused && !this.audio.ended;
  }

  getPlaybackRate(): number {
    return this.audio.playbackRate || 1;
  }

  setPlaybackRate(rate: number): void {
    const safe = clamp(Number.isFinite(rate) ? rate : 1, 0.25, 2);
    this.audio.playbackRate = safe;
    if (this.shifter) {
      // SoundTouch compensates the pitch of the sped-up element.
      this.shifter.playbackRate.value = safe;
      this.audio.preservesPitch = false;
    } else {
      this.audio.preservesPitch = true;
    }
  }

  setPitch(semitones: number): void {
    const safe = clamp(Number.isFinite(semitones) ? semitones : 0, -12, 12);
    const next = Math.round(safe);
    if (next === this.pitch && this.shifter) return;
    this.pitch = next;
    if (this.shifter) {
      this.shifter.pitchSemitones.value = next;
      return;
    }
    if (next !== 0) void this.ensureGraph();
  }

  onStateChange(listener: (playing: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.detach.forEach((fn) => fn());
    this.listeners.clear();
    this.audio.pause();
    try {
      this.shifter?.disconnect();
    } catch {
      // The context may already be closed.
    }
    this.shifter = null;
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.graph = null;
    if (this.ownsElement && typeof this.audio.removeAttribute === 'function') {
      this.audio.removeAttribute('src');
      this.audio.load();
    }
  }

  /**
   * Routes the element through SoundTouch once. The graph is created on the
   * first play so the AudioContext starts inside a user gesture. If the
   * worklet cannot load, the element keeps playing on its own.
   */
  private ensureGraph(): Promise<void> {
    if (this.graph) return this.graph;
    this.graph = (async () => {
      const Constructor = audioContextConstructor();
      if (!Constructor) return;
      const context = new Constructor();
      this.context = context;
      void context.resume();
      try {
        const [{ SoundTouchNode }, processor] = await Promise.all([
          import('@soundtouchjs/audio-worklet'),
          import('@soundtouchjs/audio-worklet/processor?url'),
        ]);
        await SoundTouchNode.register(context, processor.default);
        const shifter = new SoundTouchNode({ context });
        shifter.setStretchParameters(STRETCH);
        shifter.pitchSemitones.value = this.pitch;
        shifter.playbackRate.value = this.audio.playbackRate || 1;
        shifter.connect(context.destination);
        const source = context.createMediaElementSource(this.audio);
        source.connect(shifter);
        this.shifter = shifter;
        this.audio.preservesPitch = false;
      } catch {
        // Leave the element on the normal audio path.
        void context.close().catch(() => undefined);
        this.context = null;
        this.graph = null;
      }
    })();
    return this.graph;
  }

  private latency(): number {
    if (!this.shifter || !this.context) return 0;
    const rate = this.audio.playbackRate || 1;
    const output = (this.context.baseLatency ?? 0) + (this.context.outputLatency ?? 0);
    return pitchShiftLatency(rate) + output * rate;
  }

  private emit(): void {
    const playing = this.isPlaying();
    for (const listener of this.listeners) listener(playing);
  }
}
