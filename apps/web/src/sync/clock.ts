import { findActiveSegmentIndex, type ChordSegment } from '@chordifree/chords';
import type { PlayerAdapter } from '../player/types';

/**
 * Publica el índice del segmento y del pulso activos. Solo notifica cuando
 * cambia cualquiera de los dos, de modo que las celdas puedan suscribirse de
 * forma selectiva sin añadir un segundo bucle de animación.
 */
export class PlaybackClock {
  private index = -1;
  private beatIndex = -1;
  private segments: ChordSegment[] = [];
  private beats: number[] = [];
  private frame: number | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;

  constructor(private readonly adapter: PlayerAdapter) {
    this.unsubscribe = adapter.onStateChange((playing) => {
      if (playing) this.start();
      else {
        this.stop();
        this.tick();
      }
    });
    this.tick();
  }

  setSegments(segments: ChordSegment[]): void {
    this.segments = segments;
    this.tick();
  }

  setBeats(beats: number[]): void {
    this.beats = beats
      .filter((beat) => Number.isFinite(beat) && beat >= 0)
      .sort((a, b) => a - b)
      .filter((beat, index, values) => index === 0 || beat > values[index - 1]!);
    this.tick();
  }

  getIndex = (): number => {
    return this.index;
  };

  getBeatIndex = (): number => {
    return this.beatIndex;
  };

  getTime = (): number => {
    return this.adapter.getCurrentTime();
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  start(): void {
    if (this.frame !== null) return;
    const loop = () => {
      this.tick();
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  tickOnce(): void {
    this.tick();
  }

  destroy(): void {
    this.stop();
    this.unsubscribe();
    this.listeners.clear();
  }

  private beatIndexAt(time: number): number {
    if (this.beats.length === 0 || !Number.isFinite(time)) return -1;
    if (time < this.beats[0]!) return -1;

    let low = 0;
    let high = this.beats.length - 1;
    let candidate = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const beat = this.beats[mid];
      if (beat === undefined) break;
      if (beat <= time) {
        candidate = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return candidate;
  }

  private tick(): void {
    const time = this.adapter.getCurrentTime();
    const next = findActiveSegmentIndex(this.segments, time);
    const nextBeat = this.beatIndexAt(time);
    if (next === this.index && nextBeat === this.beatIndex) return;
    this.index = next;
    this.beatIndex = nextBeat;
    for (const listener of this.listeners) listener();
  }
}
