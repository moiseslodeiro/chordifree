import type { PlayerAdapter } from './types';

export class AudioPlayerAdapter implements PlayerAdapter {
  private readonly audio: HTMLAudioElement;
  private readonly ownsElement: boolean;
  private readonly listeners = new Set<(playing: boolean) => void>();
  private readonly detach: Array<() => void> = [];

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
    return this.audio.currentTime || 0;
  }

  seekTo(seconds: number): void {
    this.audio.currentTime = Math.max(0, seconds);
  }

  play(): void {
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
    const safe = Math.min(2, Math.max(0.25, Number.isFinite(rate) ? rate : 1));
    this.audio.playbackRate = safe;
    this.audio.preservesPitch = true;
  }

  onStateChange(listener: (playing: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.detach.forEach((fn) => fn());
    this.listeners.clear();
    this.audio.pause();
    if (this.ownsElement && typeof this.audio.removeAttribute === 'function') {
      this.audio.removeAttribute('src');
      this.audio.load();
    }
  }

  private emit(): void {
    const playing = this.isPlaying();
    for (const listener of this.listeners) listener(playing);
  }
}
