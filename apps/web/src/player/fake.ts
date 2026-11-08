import type { PlayerAdapter } from './types';

/**
 * Adaptador controlable para tests y para el modo de demostración E2E.
 * Con `autoAdvance` el tiempo avanza con el reloj real mientras está en reproducción.
 */
export class FakePlayerAdapter implements PlayerAdapter {
  private base: number;
  private startedAt = Date.now();
  private playing = false;
  private rate = 1;
  private readonly listeners = new Set<(playing: boolean) => void>();

  constructor(
    initialTime = 0,
    private readonly autoAdvance = true,
  ) {
    this.base = initialTime;
  }

  getCurrentTime(): number {
    if (!this.autoAdvance || !this.playing) return this.base;
    return this.base + ((Date.now() - this.startedAt) / 1000) * this.rate;
  }

  seekTo(seconds: number): void {
    this.base = Math.max(0, seconds);
    this.startedAt = Date.now();
  }

  play(): void {
    if (this.playing) return;
    this.base = this.getCurrentTime();
    this.startedAt = Date.now();
    this.playing = true;
    this.emit();
  }

  pause(): void {
    if (!this.playing) return;
    this.base = this.getCurrentTime();
    this.playing = false;
    this.emit();
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getPlaybackRate(): number {
    return this.rate;
  }

  setPlaybackRate(rate: number): void {
    const safe = Math.min(2, Math.max(0.25, Number.isFinite(rate) ? rate : 1));
    this.base = this.getCurrentTime();
    this.startedAt = Date.now();
    this.rate = safe;
  }

  onStateChange(listener: (playing: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  advance(seconds: number): void {
    this.base = this.getCurrentTime() + seconds;
    this.startedAt = Date.now();
  }

  destroy(): void {
    this.listeners.clear();
    this.playing = false;
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.playing);
  }
}
