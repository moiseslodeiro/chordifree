import { useEffect, useRef } from 'react';
import type { PlayerAdapter } from '../player/types';
import { AudioPlayerAdapter } from '../player/audio';
import { FakePlayerAdapter } from '../player/fake';
import { YouTubePlayerAdapter } from '../player/youtube';
import type { Song } from '../types';

interface PlayerHostProps {
  song: Song;
  audioUrl: string | null;
  forceFake: boolean;
  variant?: 'default' | 'compact';
  onAdapter: (adapter: PlayerAdapter | null) => void;
  onPlaybackError: (message: string) => void;
}

const YOUTUBE_ERRORS: Record<number, string> = {
  2: 'El identificador del video no es válido.',
  5: 'El reproductor HTML5 de YouTube no está disponible en este navegador.',
  100: 'El video no existe o es privado.',
  101: 'El propietario no permite reproducir este video fuera de YouTube.',
  150: 'El propietario no permite reproducir este video fuera de YouTube.',
};

export function PlayerHost({
  song,
  audioUrl,
  forceFake,
  variant = 'default',
  onAdapter,
  onPlaybackError,
}: PlayerHostProps) {
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
          YOUTUBE_ERRORS[code] ?? `No se pudo reproducir el video (código ${code}).`,
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
            El reproductor de YouTube sustituye este nodo por un iframe con un
            tamaño fijo. Los selectores del contenedor fuerzan a que ocupe todo
            el ancho y respete la relación 16:9 del contenedor.
          */}
          <div ref={youtubeRef} className="absolute inset-0" />
        </div>
      ) : null}

      {mode === 'audio' && audioUrl ? (
        <audio ref={audioRef} src={audioUrl} controls className="w-full" preload="metadata">
          Tu navegador no admite la reproducción de audio.
        </audio>
      ) : null}

      {mode === 'fake' ? (
        <div className="note note-info text-sm leading-relaxed">
          Modo de demostración: la reproducción se simula con un reloj local para poder probar la
          sincronización sin cargar el video.
        </div>
      ) : null}

      {mode === 'missing' ? (
        <div className="note note-warning text-sm leading-relaxed">
          El audio original de esta canción no está disponible: no se guarda en la biblioteca.
          Puedes consultar y editar la línea de tiempo, pero no reproducirla. Vuelve a subir el
          archivo para escucharla.
        </div>
      ) : null}
    </div>
  );
}
