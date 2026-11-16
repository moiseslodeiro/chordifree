import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useT } from '../i18n';
import { audioUrlForSong, songIsDirty } from '../lib/songState';
import type { Library } from '../storage/library';
import type { Setlist, Song, AppNotice } from '../types';
import { hashFor, parseHash, type Route } from '../routing';

export interface SongNavigationOptions {
  library: Library;
  setlists: Setlist[];
  recordOpen: (songId: string) => void;
  refreshLibrary: () => void;
  resetGridView: () => void;
  onNotice: (notice: AppNotice) => void;
}

export interface SongNavigation {
  route: Route;
  setRoute: (route: Route) => void;
  song: Song | null;
  setSong: (song: Song | null) => void;
  setSavedSong: (song: Song | null) => void;
  songRef: MutableRefObject<Song | null>;
  audioUrl: string | null;
  dirty: boolean;
  replaceAudioUrl: (url: string | null) => void;
  openSong: (song: Song, audioUrl: string | null) => void;
  navigate: (route: Route) => void;
}

function initialSongState(library: Library, setlists: Setlist[]) {
  const route = parseHash();
  if (route.name === 'song') {
    const found = library.get(route.id);
    if (found) return { route, song: found as Song | null };
    return { route: { name: 'home' } as Route, song: null };
  }
  if (route.name === 'setlist') {
    const found = setlists.some((setlist) => setlist.id === route.id);
    if (found) return { route, song: null as Song | null };
    return { route: { name: 'setlists' } as Route, song: null };
  }
  return { route, song: null as Song | null };
}

/** Keeps the current song, its audio URL and the hash route in sync. */
export function useSongNavigation({
  library,
  setlists,
  recordOpen,
  refreshLibrary,
  resetGridView,
  onNotice,
}: SongNavigationOptions): SongNavigation {
  const t = useT();
  const [initial] = useState(() => initialSongState(library, setlists));
  const [route, setRoute] = useState<Route>(initial.route);
  const [song, setSong] = useState<Song | null>(initial.song);
  const [savedSong, setSavedSong] = useState<Song | null>(initial.song);
  const songRef = useRef<Song | null>(initial.song);
  const [audioUrl, setAudioUrl] = useState<string | null>(
    initial.song ? audioUrlForSong(initial.song) : null,
  );
  const dirty = useMemo(() => songIsDirty(song, savedSong), [song, savedSong]);

  const replaceAudioUrl = useCallback((next: string | null) => {
    setAudioUrl((previous) => {
      if (previous && previous !== next) URL.revokeObjectURL(previous);
      return next;
    });
  }, []);

  const openSong = useCallback(
    (next: Song, nextAudioUrl: string | null) => {
      songRef.current = next;
      setSong(next);
      setSavedSong(next);
      resetGridView();
      recordOpen(next.id);
      replaceAudioUrl(nextAudioUrl);
      const nextRoute: Route = { name: 'song', id: next.id };
      setRoute(nextRoute);
      if (window.location.hash !== hashFor(nextRoute)) {
        window.location.hash = hashFor(nextRoute);
      }
    },
    [recordOpen, replaceAudioUrl, resetGridView],
  );

  const applyRoute = useCallback(
    (next: Route) => {
      if (next.name === 'song') {
        const found = library.get(next.id);
        if (found) {
          songRef.current = found;
          setSong(found);
          setSavedSong(found);
          resetGridView();
          recordOpen(found.id);
          replaceAudioUrl(audioUrlForSong(found));
          setRoute(next);
          return;
        }
        if (songRef.current?.id === next.id) {
          resetGridView();
          setRoute(next);
          return;
        }
        onNotice({ message: t('app.songMissing'), tone: 'warning' });
        setRoute({ name: 'library' });
        if (window.location.hash !== '#/library') window.location.hash = '#/library';
        return;
      }
      if (next.name === 'library') refreshLibrary();
      if (next.name === 'setlist') {
        const found = setlists.some((setlist) => setlist.id === next.id);
        if (!found) {
          onNotice({ message: t('setlists.notFound'), tone: 'warning' });
          setRoute({ name: 'setlists' });
          if (window.location.hash !== '#/setlists') window.location.hash = '#/setlists';
          return;
        }
      }
      setRoute(next);
    },
    [library, onNotice, recordOpen, refreshLibrary, replaceAudioUrl, resetGridView, setlists, t],
  );

  useEffect(() => {
    const onHashChange = () => applyRoute(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [applyRoute]);

  const navigate = useCallback(
    (next: Route) => {
      if (window.location.hash !== hashFor(next)) window.location.hash = hashFor(next);
      applyRoute(next);
    },
    [applyRoute],
  );

  return {
    route,
    setRoute,
    song,
    setSong,
    setSavedSong,
    songRef,
    audioUrl,
    dirty,
    replaceAudioUrl,
    openSong,
    navigate,
  };
}
