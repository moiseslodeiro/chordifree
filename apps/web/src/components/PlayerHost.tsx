import { useEffect, useRef } from 'react';
import type { PlayerAdapter } from '../player/types';
import { AudioPlayerAdapter } from '../player/audio';
import { FakePlayerAdapter } from '../player/fake';
import { YouTubePlayerAdapter } from '../player/youtube';
import { useT } from '../i18n';
import type { Song } from '../types';

interface PlayerHostProps {
  song: Song;
  audioUrl: string | null;
  forceFake: boolean;
  variant?: 'default' | 'compact';
  onAdapter: (adapter: PlayerAdapter | null) => void;
  onPlaybackError: (message: string) => void;
}

const YOUTUBE_ERRORS: Record<number, 'player.youtubeInvalid' | 'player.html5Unavailable' | 'player.youtubeMissing' | 'player.youtubeOwner'> = {
  2: 'player.youtubeInvalid',
  5: 'player.html5Unavailable',
  100: 'player.youtubeMissing',
  101: 'player.youtubeOwner',
  150: 'player.youtubeOwner',
};

export function PlayerHost({
  song,
  audioUrl,
  forceFake,
  variant = 'default',
  onAdapter,
  onPlaybackError,
}: PlayerHostProps) {
  const t = useT();
  const youtubeRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const adapterCallback = useRef(onAdapter);
  const errorCallback = useRef(onPlaybackError);

  adapterCallback.current = onAdapter;
  errorCallback.current = onPlaybackError;

  const isYoutube = song.source.type === 'youtube';
  const mode: 'youtube' | 'audio' | 'fake' | 'missing' = forceFake
    ? 'fake'
    : isYoutube
      ? 'youtube'
      : audioUrl
        ? 'audio'
        : 'missing';

  useEffect(() => {
    let adapter: PlayerAdapter | null = null;

    if (mode === 'fake') {
      adapter = new FakePlayerAdapter(0, true);
    } else if (mode === 'youtube' && youtubeRef.current && song.source.type === 'youtube') {
      adapter = new YouTubePlayerAdapter(youtubeRef.current, song.source.videoId, (code) => {
        errorCallback.current(
          YOUTUBE_ERRORS[code] ? t(YOUTUBE_ERRORS[code]) : t('player.playFailed', { code }),
        );
      });
    } else if (mode === 'audio' && audioRef.current) {
      adapter = new AudioPlayerAdapter(audioRef.current);
    }

    if (adapter) adapterCallback.current(adapter);
    return () => {
      adapterCallback.current(null);
      adapter?.destroy();
    };
  }, [mode, song.id, audioUrl]);

  return (
    <div className="space-y-3">
      {mode === 'youtube' ? (
        <div
          data-testid="player-video"
          data-variant={variant}
          className={`relative aspect-video w-full overflow-hidden border border-line bg-black [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full ${
            variant === 'compact' ? 'mx-auto max-w-[22rem]' : ''
          }`}
        >
          {/*
            The YouTube player replaces this node with an iframe of a
            fixed size. The container selectors force it to fill the full
            width and respect the container's 16:9 ratio.
          */}
          <div ref={youtubeRef} className="absolute inset-0" />
        </div>
      ) : null}

      {mode === 'audio' && audioUrl ? (
        <audio ref={audioRef} src={audioUrl} controls className="w-full" preload="metadata">
          {t('player.audioUnsupported')}
        </audio>
      ) : null}

      {mode === 'fake' ? (
        <div className="note note-info text-sm leading-relaxed">
          {t('player.demo')}
        </div>
      ) : null}

      {mode === 'missing' ? (
        <div className="note note-warning text-sm leading-relaxed">
          {t('player.audioMissing')}
        </div>
      ) : null}
    </div>
  );
}
