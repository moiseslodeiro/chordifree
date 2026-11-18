import { useEffect, useRef, useState } from 'react';
import type { PlayerAdapter } from '../player/types';
import { AudioPlayerAdapter } from '../player/audio';
import { FakePlayerAdapter } from '../player/fake';
import { prepareYoutubeAudio } from '../lib/api';
import { useT } from '../i18n';
import type { Song } from '../types';

interface PlayerHostProps {
  song: Song;
  audioUrl: string | null;
  forceFake: boolean;
  variant?: 'default' | 'compact';
  pitch: number;
  onAdapter: (adapter: PlayerAdapter | null) => void;
  onPlaybackError: (message: string) => void;
}

interface TemporaryAudio {
  videoId: string;
  url: string;
}

export function PlayerHost({
  song,
  audioUrl,
  forceFake,
  variant = 'default',
  pitch,
  onAdapter,
  onPlaybackError,
}: PlayerHostProps) {
  const t = useT();
  const audioRef = useRef<HTMLAudioElement>(null);
  const adapterCallback = useRef(onAdapter);
  const errorCallback = useRef(onPlaybackError);
  const adapterRef = useRef<PlayerAdapter | null>(null);
  const pitchRef = useRef(pitch);
  pitchRef.current = pitch;

  const [temporary, setTemporary] = useState<TemporaryAudio | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepareFailed, setPrepareFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  adapterCallback.current = onAdapter;
  errorCallback.current = onPlaybackError;

  const videoId = song.source.type === 'youtube' ? song.source.videoId : null;
  const temporaryUrl = temporary && temporary.videoId === videoId ? temporary.url : null;
  const playableUrl = videoId ? temporaryUrl : audioUrl;
  const mode: 'audio' | 'fake' | 'missing' | 'video' = forceFake
    ? 'fake'
    : playableUrl
      ? 'audio'
      : videoId
        ? 'video'
        : 'missing';

  useEffect(() => {
    const url = temporary?.url;
    return () => {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [temporary?.url]);

  useEffect(() => {
    if (!videoId || forceFake) {
      setPreparing(false);
      return;
    }
    if (temporary?.videoId === videoId) return;

    const controller = new AbortController();
    setPreparing(true);
    setPrepareFailed(false);
    void prepareYoutubeAudio(videoId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setTemporary({ videoId, url: result.url });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setPrepareFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPreparing(false);
      });

    return () => controller.abort();
    // `temporary` is intentionally read, not watched: the request must only
    // restart when the video changes or the user retries.
  }, [videoId, forceFake, retry]);

  useEffect(() => {
    let adapter: PlayerAdapter | null = null;

    if (mode === 'fake') {
      adapter = new FakePlayerAdapter(0, true);
    } else if (mode === 'audio' && audioRef.current && playableUrl) {
      adapter = new AudioPlayerAdapter(audioRef.current);
    }

    if (adapter) {
      adapter.setPitch?.(pitchRef.current);
      adapterRef.current = adapter;
      adapterCallback.current(adapter);
    }
    return () => {
      adapterRef.current = null;
      adapterCallback.current(null);
      adapter?.destroy();
    };
  }, [mode, song.id, playableUrl]);

  useEffect(() => {
    adapterRef.current?.setPitch?.(pitch);
  }, [pitch]);

  const audioError = () => {
    if (videoId) {
      setTemporary(null);
      setPrepareFailed(true);
      return;
    }
    errorCallback.current(t('player.audioLoadFailed'));
  };

  const retryAudio = () => {
    setPrepareFailed(false);
    setTemporary(null);
    setRetry((value) => value + 1);
  };

  return (
    <div className="space-y-3">
      {videoId ? (
        <figure
          data-testid="player-thumbnail"
          data-variant={variant}
          className={`relative overflow-hidden rounded-lg border border-line bg-black ${
            variant === 'compact' ? 'mx-auto w-full max-w-[22rem]' : ''
          }`}
        >
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            className="aspect-video w-full object-cover"
            loading="lazy"
          />
          <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-white">
            YouTube
          </span>
        </figure>
      ) : null}

      {mode === 'audio' && playableUrl ? (
        <audio
          key={playableUrl}
          ref={audioRef}
          src={playableUrl}
          preload="metadata"
          className="hidden"
          onError={audioError}
        >
          {t('player.audioUnsupported')}
        </audio>
      ) : null}

      {mode === 'fake' ? (
        <div className="note note-info text-sm leading-relaxed">{t('player.demo')}</div>
      ) : null}

      {mode === 'missing' ? (
        <div className="note note-warning text-sm leading-relaxed">{t('player.audioMissing')}</div>
      ) : null}

      {!videoId && mode === 'audio' ? (
        <div className="note note-info text-sm leading-relaxed">{t('player.audioFileHint')}</div>
      ) : null}

      {videoId && preparing ? (
        <div
          className="note note-info flex items-center gap-2 text-sm leading-relaxed"
          role="status"
        >
          <span
            className="inline-block size-2 shrink-0 animate-pulse rounded-full bg-accent"
            aria-hidden="true"
          />
          {t('player.pitchPreparing')}
        </div>
      ) : null}

      {videoId && prepareFailed ? (
        <div
          className="note note-warning flex flex-wrap items-center gap-2 text-sm leading-relaxed"
          role="alert"
        >
          <span>{t('player.pitchAudioFailed')}</span>
          <button type="button" className="btn min-h-0 px-3 py-1.5 text-xs" onClick={retryAudio}>
            {t('common.retry')}
          </button>
        </div>
      ) : null}

      {videoId && temporaryUrl && !preparing && !prepareFailed ? (
        <div className="note note-info text-sm leading-relaxed">{t('player.youtubeTemporary')}</div>
      ) : null}
    </div>
  );
}
