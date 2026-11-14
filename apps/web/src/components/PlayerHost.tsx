import { useEffect, useRef, useState } from 'react';
import type { PlayerAdapter } from '../player/types';
import { AudioPlayerAdapter } from '../player/audio';
import { FakePlayerAdapter } from '../player/fake';
import { YouTubePlayerAdapter } from '../player/youtube';
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

interface Handoff {
  songId: string;
  time: number;
  playing: boolean;
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
  pitch,
  onAdapter,
  onPlaybackError,
}: PlayerHostProps) {
  const t = useT();
  const youtubeRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const adapterCallback = useRef(onAdapter);
  const errorCallback = useRef(onPlaybackError);
  const adapterRef = useRef<PlayerAdapter | null>(null);
  const handoff = useRef<Handoff | null>(null);
  const pitchRef = useRef(pitch);
  pitchRef.current = pitch;

  const [temporary, setTemporary] = useState<TemporaryAudio | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepareFailed, setPrepareFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  adapterCallback.current = onAdapter;
  errorCallback.current = onPlaybackError;

  const videoId = song.source.type === 'youtube' ? song.source.videoId : null;
  const wantsTemporary = !forceFake && videoId !== null && pitch !== 0;
  const temporaryUrl = temporary && temporary.videoId === videoId ? temporary.url : null;
  const playableUrl = videoId ? temporaryUrl : audioUrl;
  const mode: 'youtube' | 'audio' | 'fake' | 'missing' = forceFake
    ? 'fake'
    : videoId
      ? temporaryUrl
        ? 'audio'
        : 'youtube'
      : audioUrl
        ? 'audio'
        : 'missing';

  // The temporary file is only valid for a while on the server. Clear the
  // reference when the pitch is reset so the next selection prepares it again.
  useEffect(() => {
    if (pitch === 0) setTemporary(null);
  }, [pitch]);

  useEffect(() => {
    if (!wantsTemporary || !videoId || temporaryUrl) {
      setPreparing(false);
      setPrepareFailed(false);
      return;
    }

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
  }, [wantsTemporary, videoId, temporaryUrl, retry]);

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
    } else if (mode === 'audio' && audioRef.current && playableUrl) {
      adapter = new AudioPlayerAdapter(audioRef.current);
    }

    if (adapter) {
      const saved = handoff.current;
      if (saved && saved.songId === song.id) {
        adapter.seekTo(saved.time);
        if (saved.playing) adapter.play();
      }
      handoff.current = null;
      adapter.setPitch?.(pitchRef.current);
      adapterRef.current = adapter;
      adapterCallback.current(adapter);
    }
    return () => {
      if (adapter) {
        handoff.current = {
          songId: song.id,
          time: adapter.getCurrentTime(),
          playing: adapter.isPlaying(),
        };
      }
      adapterRef.current = null;
      adapterCallback.current(null);
      adapter?.destroy();
    };
  }, [mode, song.id, playableUrl]);

  useEffect(() => {
    adapterRef.current?.setPitch?.(pitch);
  }, [pitch]);

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

      {mode === 'audio' && playableUrl ? (
        <audio
          key={playableUrl}
          ref={audioRef}
          src={playableUrl}
          controls
          className="w-full"
          preload="metadata"
        >
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

      {mode === 'youtube' && wantsTemporary && preparing ? (
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

      {mode === 'youtube' && wantsTemporary && prepareFailed ? (
        <div className="note note-warning flex flex-wrap items-center gap-2 text-sm leading-relaxed" role="alert">
          <span>{t('player.pitchAudioFailed')}</span>
          <button
            type="button"
            className="btn min-h-0 px-3 py-1.5 text-xs"
            onClick={() => setRetry((value) => value + 1)}
          >
            {t('common.retry')}
          </button>
        </div>
      ) : null}

      {mode === 'audio' && videoId ? (
        <div className="note note-info text-sm leading-relaxed">
          {t('player.pitchTemporary')}
        </div>
      ) : null}
    </div>
  );
}
