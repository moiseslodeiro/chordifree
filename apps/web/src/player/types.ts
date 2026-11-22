export interface PlayerAdapter {
  getCurrentTime(): number;
  seekTo(seconds: number): void;
  play(): void;
  pause(): void;
  isPlaying(): boolean;
  onStateChange(listener: (playing: boolean) => void): () => void;
  getPlaybackRate?(): number;
  setPlaybackRate?(rate: number): void;
  /** Audio pitch in semitones, independent from the chord transposition. */
  setPitch?(semitones: number): void;
  /** Center-channel cancellation for a karaoke-style backing track. */
  setKaraoke?(enabled: boolean): void;
  /** Per-stem volume in the mix (0 to 1). */
  setStemVolume?(stem: string, value: number): void;
  destroy(): void;
}

export type PlayerMode = 'youtube' | 'audio' | 'fake';
