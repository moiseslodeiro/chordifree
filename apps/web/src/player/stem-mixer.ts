import type { PlayerAdapter } from './types';

export interface StemSource {
  name: string;
  url: string;
}

const SYNC_INTERVAL_MS = 750;
const MAX_DRIFT_SECONDS = 0.08;

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

/**
 * Plays several separated stems at once with one transport. The first stem is
 * the clock master; the rest are aligned on play/seek and corrected if they
 * drift. Volume is per element, so the mixer works without Web Audio; the
 * pitch and karaoke controls stay on the original track.
 */
export class StemMixerAdapter implements PlayerAdapter {
  private readonly elements: HTMLAudioElement[] = [];
  private readonly byName = new Map<string, HTMLAudioElement>();
  private readonly listeners = new Set<(playing: boolean) => void>();
  private readonly detach: Array<() => void> = [];
  private readonly master: HTMLAudioElement;
  private syncTimer: number | null = null;

  constructor(stems: StemSource[], gains: Record<string, number> = {}) {
    if (stems.length === 0) throw new Error('The stem mix needs at least one stem');
    for (const stem of stems) {
      const audio = new Audio(stem.url);
      audio.preload = 'auto';
      audio.volume = clampVolume(gains[stem.name] ?? 1);
      audio.preservesPitch = true;
      this.elements.push(audio);
      this.byName.set(stem.name, audio);
    }
    this.master = this.elements[0]!;
    for (const event of ['play', 'pause', 'ended'] as const) {
      const handler = () => this.emit();
      this.master.addEventListener(event, handler);
      this.detach.push(() => this.master.removeEventListener(event, handler));
    }
  }

  getCurrentTime(): number {
    return this.master.currentTime || 0;
  }

  seekTo(seconds: number): void {
    const time = Math.max(0, seconds);
    for (const audio of this.elements) audio.currentTime = time;
  }

  play(): void {
    const time = this.master.currentTime;
    for (const audio of this.elements) {
      if (Math.abs(audio.currentTime - time) > 0.03) audio.currentTime = time;
      void audio.play().catch(() => undefined);
    }
    this.startSync();
  }

  pause(): void {
    for (const audio of this.elements) audio.pause();
    this.stopSync();
  }

  isPlaying(): boolean {
    return !this.master.paused && !this.master.ended;
  }

  getPlaybackRate(): number {
    return this.master.playbackRate || 1;
  }

  setPlaybackRate(rate: number): void {
    const safe = Math.max(0.25, Math.min(2, Number.isFinite(rate) ? rate : 1));
    for (const audio of this.elements) {
      audio.playbackRate = safe;
      audio.preservesPitch = true;
    }
  }

  /** Pitch shifting is not applied to the mix; use the original track. */
  setPitch(): void {
    // Intentionally empty: the mixer keeps the original pitch.
  }

  setKaraoke(): void {
    // With separated stems the user can simply lower the vocal volume.
  }

  setStemVolume(name: string, value: number): void {
    const audio = this.byName.get(name);
    if (audio) audio.volume = clampVolume(value);
  }

  onStateChange(listener: (playing: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.stopSync();
    for (const detach of this.detach) detach();
    this.listeners.clear();
    for (const audio of this.elements) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
  }

  private emit(): void {
    const playing = this.isPlaying();
    for (const listener of this.listeners) listener(playing);
    if (playing) this.startSync();
    else this.stopSync();
  }

  private startSync(): void {
    if (this.syncTimer !== null) return;
    this.syncTimer = window.setInterval(() => this.sync(), SYNC_INTERVAL_MS);
  }

  private stopSync(): void {
    if (this.syncTimer === null) return;
    window.clearInterval(this.syncTimer);
    this.syncTimer = null;
  }

  private sync(): void {
    if (this.master.paused) return;
    const time = this.master.currentTime;
    for (const audio of this.elements) {
      if (audio === this.master || audio.readyState < 1) continue;
      if (Math.abs(audio.currentTime - time) > MAX_DRIFT_SECONDS) audio.currentTime = time;
    }
  }
}
