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
  destroy(): void;
}

export type PlayerMode = 'youtube' | 'audio' | 'fake';
