import { useEffect, useRef } from 'react';
import { useT } from '../i18n';
import { decodeSongFromToken } from '../lib/share';
import type { Library } from '../storage/library';
import type { Route } from '../routing';
import type { AppNotice, Song } from '../types';

export interface SharedSongImportOptions {
  library: Library;
  refreshLibrary: () => void;
  openSong: (song: Song, audioUrl: string | null) => void;
  navigate: (route: Route) => void;
  onNotice: (notice: AppNotice) => void;
}

/** Imports a `#share=…` link once, on first load. */
export function useSharedSongImport({
  library,
  refreshLibrary,
  openSong,
  navigate,
  onNotice,
}: SharedSongImportOptions): void {
  const t = useT();
  const handled = useRef(false);

  useEffect(() => {
    const match = /^#share=(.+)$/.exec(window.location.hash);
    if (!match || handled.current) return;
    handled.current = true;

    void (async () => {
      try {
        const shared = await decodeSongFromToken(decodeURIComponent(match[1]!));
        const imported = library.add(shared);
        refreshLibrary();
        openSong(imported, null);
        onNotice({ message: t('share.imported'), tone: 'success' });
      } catch {
        onNotice({ message: t('share.invalid'), tone: 'warning' });
        navigate({ name: 'home' });
      }
    })();
  }, [library, navigate, onNotice, openSong, refreshLibrary, t]);
}
