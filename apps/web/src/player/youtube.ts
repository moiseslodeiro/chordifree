import { t } from '../i18n';
import type { PlayerAdapter } from './types';

interface YTPlayer {
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
  getPlaybackRate?(): number;
  setPlaybackRate?(rate: number): void;
  destroy(): void;
}

interface YTNamespace {
  Player: new (elementId: string, options: Record<string, unknown>) => YTPlayer;
  PlayerState: { PLAYING: number; ENDED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error(t('player.youtubeNoWindow')));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error(t('player.youtubeApi')));
    };

    if (!document.getElementById('youtube-iframe-api')) {
      const script = document.createElement('script');
      script.id = 'youtube-iframe-api';
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => reject(new Error(t('player.youtubeLoad')));
      document.head.appendChild(script);
    }
  });

  return apiPromise;
}

export class YouTubePlayerAdapter implements PlayerAdapter {
  private player: YTPlayer | null = null;
  private playing = false;
  private readonly listeners = new Set<(playing: boolean) => void>();
  private readonly elementId: string;

  constructor(
    private readonly container: HTMLElement,
    videoId: string,
    private readonly onError?: (code: number) => void,
  ) {
    this.elementId = `yt-player-${Math.random().toString(36).slice(2)}`;
    const target = document.createElement('div');
    target.id = this.elementId;
    container.appendChild(target);

    void loadYouTubeApi()
      .then((YT) => {
        this.player = new YT.Player(this.elementId, {
          videoId,
          playerVars: { playsinline: 1, rel: 0, origin: window.location.origin },
          events: {
            onStateChange: (event: { data: number }) => {
              this.playing = event.data === YT.PlayerState.PLAYING;
              this.emit();
            },
            onError: (event: { data: number }) => this.onError?.(event.data),
          },
        });
      })
      .catch(() => this.onError?.(-1));
  }

  getCurrentTime(): number {
    return this.player?.getCurrentTime?.() ?? 0;
  }

  seekTo(seconds: number): void {
    this.player?.seekTo(Math.max(0, seconds), true);
  }

  play(): void {
    this.player?.playVideo();
  }

  pause(): void {
    this.player?.pauseVideo();
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getPlaybackRate(): number {
    return this.player?.getPlaybackRate?.() ?? 1;
  }

  setPlaybackRate(rate: number): void {
    const safe = Math.min(2, Math.max(0.25, Number.isFinite(rate) ? rate : 1));
    this.player?.setPlaybackRate?.(safe);
  }

  onStateChange(listener: (playing: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.listeners.clear();
    try {
      this.player?.destroy();
    } catch {
      // The player may not have been initialized.
    }
    this.container.replaceChildren();
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.playing);
  }
}
