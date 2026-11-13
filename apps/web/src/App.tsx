import { useCallback, useEffect, useRef, useState } from 'react';
import { getHealth } from './lib/api';
import { createYoutubeAnalysis } from './lib/api';
import { isDesktopApp, type UpdateInfo } from './lib/platform';
import { useAnalysisRunner } from './lib/useAnalysis';
import { useT, setLanguage } from './i18n';
import { Home } from './components/Home';
import { NoticeBanner } from './components/ErrorBanner';
import { UpdateBanner } from './components/UpdateBanner';
import { LibraryList } from './components/LibraryList';
import { SetlistList } from './components/SetlistList';
import { SetlistView } from './components/SetlistView';
import { SongView } from './components/SongView';
import { getStorage, PREFIX, StorageQuotaError } from './storage/keys';
import { listKeys } from './storage/envelope';
import { BackupError, downloadBackupSnapshot, parseBackupSnapshot } from './storage/backup';
import { decodeSongFromToken } from './lib/share';
import { ChordProError, parseChordPro } from './lib/chordpro';
import { Library, analysisCacheStats, clearAnalysisCache } from './storage/library';
import { loadPreferences, savePreferences } from './storage/preferences';
import { removePractice } from './storage/practice';
import {
  addSongToSetlist,
  createSetlist,
  loadSetlists,
  moveSongInSetlist,
  removeSongFromSetlist,
  renameSetlist,
  saveSetlists,
} from './storage/setlists';
import { loadHistory, markOpened, saveHistory, type HistoryMap } from './storage/history';
import type { AppNotice, Folder, Preferences, Setlist, Song } from './types';

type Route =
  | { name: 'home' }
  | { name: 'library' }
  | { name: 'setlists' }
  | { name: 'setlist'; id: string }
  | { name: 'song'; id: string };

function parseHash(): Route {
  if (typeof window === 'undefined') return { name: 'home' };
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash === 'library') return { name: 'library' };
  if (hash === 'setlists') return { name: 'setlists' };
  const setlistMatch = /^setlist\/(.+)$/.exec(hash);
  if (setlistMatch?.[1]) return { name: 'setlist', id: decodeURIComponent(setlistMatch[1]) };
  const match = /^song\/(.+)$/.exec(hash);
  if (match?.[1]) return { name: 'song', id: decodeURIComponent(match[1]) };
  return { name: 'home' };
}

function hashFor(route: Route): string {
  if (route.name === 'library') return '#/library';
  if (route.name === 'setlists') return '#/setlists';
  if (route.name === 'setlist') return `#/setlist/${encodeURIComponent(route.id)}`;
  if (route.name === 'song') return `#/song/${encodeURIComponent(route.id)}`;
  return '#/';
}

/** Static audio shipped with the app (the built-in demo) has no object URL. */
function audioUrlForSong(song: Song): string | null {
  return song.source.type === 'upload' && song.source.filename === 'demo.wav'
    ? '/demo.wav'
    : null;
}

function hasQuarantinedData(storage: ReturnType<typeof getStorage>): boolean {
  return listKeys(storage, `${PREFIX}:corrupt:`).length > 0;
}

export default function App() {
  const t = useT();
  const desktop = isDesktopApp();
  const [storage] = useState(getStorage);
  const [library] = useState(() => new Library(storage));
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences(storage));
  const analysisRunner = useAnalysisRunner();
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
  const [setlists, setSetlists] = useState<Setlist[]>(() => loadSetlists(storage));
  const [history, setHistory] = useState<HistoryMap>(() => loadHistory(storage));
  const [initial] = useState(() => {
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
  });
  const [route, setRoute] = useState<Route>(initial.route);
  const [song, setSong] = useState<Song | null>(initial.song);
  const songRef = useRef<Song | null>(initial.song);
  const shareHandled = useRef(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(
    initial.song ? audioUrlForSong(initial.song) : null,
  );
  const [songs, setSongs] = useState(() => library.list());
  const [folders, setFolders] = useState(() => library.listFolders());
  const [notice, setNotice] = useState<AppNotice | null>(() =>
    hasQuarantinedData(storage)
      ? {
          message: t('app.storageCorrupt'),
          tone: 'warning',
        }
      : null,
  );
  const [health, setHealth] = useState<{ status: 'ok' | 'down' | 'unknown'; version: string }>({
    status: 'unknown',
    version: 'essentia-1.6',
  });
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!desktop) return;
    const bridge = window.chordifreeDesktop;
    if (!bridge) return;
    const unsubscribe = bridge.onUpdateAvailable?.((info) => setUpdateInfo(info));
    void bridge
      .checkForUpdates?.()
      .then((result) => {
        if (result?.status === 'update' && result.version && result.url) {
          setUpdateInfo({ version: result.version, url: result.url });
        }
      })
      .catch(() => undefined);
    return () => unsubscribe?.();
  }, [desktop]);

  const checkForUpdatesNow = async () => {
    const bridge = window.chordifreeDesktop;
    if (!bridge?.checkForUpdates) {
      setUpdateNotice(t('update.disabled'));
      return;
    }
    try {
      const result = await bridge.checkForUpdates();
      if (result.status === 'update' && result.version && result.url) {
        setUpdateInfo({ version: result.version, url: result.url });
        setUpdateNotice(null);
      } else if (result.status === 'current') {
        setUpdateNotice(t('update.current'));
      } else if (result.status === 'disabled') {
        setUpdateNotice(t('update.disabled'));
      } else {
        setUpdateNotice(t('update.failed'));
      }
    } catch {
      setUpdateNotice(t('update.failed'));
    }
  };

  const forceFake =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('fakePlayer') === '1';

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', preferences.theme === 'dark' ? '#090b0f' : '#f6f7f9');
  }, [preferences.theme]);

  useEffect(() => {
    document.documentElement.lang = preferences.language;
    setLanguage(preferences.language);
  }, [preferences.language]);

  useEffect(() => {
    const controller = new AbortController();
    void getHealth(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setHealth({
        status: result.analyzer,
        version: result.analyzerVersion || 'essentia-1.6',
      });
    });
    return () => controller.abort();
  }, []);

  const replaceAudioUrl = useCallback((next: string | null) => {
    setAudioUrl((previous) => {
      if (previous && previous !== next) URL.revokeObjectURL(previous);
      return next;
    });
  }, []);

  const refreshLibrary = useCallback(() => {
    setSongs(library.list());
    setFolders(library.listFolders());
  }, [library]);

  const recordOpen = useCallback(
    (songId: string) => {
      setHistory((previous) => {
        const next = markOpened(previous, songId);
        try {
          saveHistory(storage, next);
        } catch {
          // History is best-effort; a full quota must not block playback.
        }
        return next;
      });
    },
    [storage],
  );

  const openSong = useCallback(
    (next: Song, nextAudioUrl: string | null) => {
      songRef.current = next;
      setSong(next);
      recordOpen(next.id);
      replaceAudioUrl(nextAudioUrl);
      const nextRoute: Route = { name: 'song', id: next.id };
      setRoute(nextRoute);
      if (window.location.hash !== hashFor(nextRoute)) {
        window.location.hash = hashFor(nextRoute);
      }
    },
    [recordOpen, replaceAudioUrl],
  );

  const applyRoute = useCallback(
    (next: Route) => {
      if (next.name === 'song') {
        const found = library.get(next.id);
        if (found) {
          songRef.current = found;
          setSong(found);
          recordOpen(found.id);
          replaceAudioUrl(audioUrlForSong(found));
          setRoute(next);
          return;
        }
        if (songRef.current?.id === next.id) {
          setRoute(next);
          return;
        }
        setNotice({
          message: t('app.songMissing'),
          tone: 'warning',
        });
        setRoute({ name: 'library' });
        if (window.location.hash !== '#/library') window.location.hash = '#/library';
        return;
      }
      if (next.name === 'library') refreshLibrary();
      if (next.name === 'setlist') {
        const found = setlists.some((setlist) => setlist.id === next.id);
        if (!found) {
          setNotice({ message: t('setlists.notFound'), tone: 'warning' });
          setRoute({ name: 'setlists' });
          if (window.location.hash !== '#/setlists') window.location.hash = '#/setlists';
          return;
        }
      }
      setRoute(next);
    },
    [library, recordOpen, refreshLibrary, replaceAudioUrl, setlists, t],
  );

  useEffect(() => {
    const onHashChange = () => applyRoute(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [applyRoute]);

  const navigate = (next: Route) => {
    if (window.location.hash !== hashFor(next)) window.location.hash = hashFor(next);
    applyRoute(next);
  };

  useEffect(() => {
    const match = /^#share=(.+)$/.exec(window.location.hash);
    if (!match || shareHandled.current) return;
    shareHandled.current = true;

    void (async () => {
      try {
        const shared = await decodeSongFromToken(decodeURIComponent(match[1]!));
        const imported = library.add(shared);
        refreshLibrary();
        openSong(imported, null);
        setNotice({ message: t('share.imported'), tone: 'success' });
      } catch {
        setNotice({ message: t('share.invalid'), tone: 'warning' });
        navigate({ name: 'home' });
      }
    })();
    // The token is consumed once, on first load; later renders must not re-import it.
  }, [refreshLibrary]);

  const updateSetlists = (updater: (current: Setlist[]) => Setlist[]) => {
    setSetlists((current) => {
      const next = updater(current);
      try {
        saveSetlists(storage, next);
      } catch {
        setNotice({ message: t('app.saveFailed'), tone: 'warning' });
      }
      return next;
    });
  };

  const handleCreateSetlist = (name: string) => {
    const created = createSetlist(name);
    updateSetlists((current) => [...current, created]);
    const nextRoute: Route = { name: 'setlist', id: created.id };
    setRoute(nextRoute);
    if (window.location.hash !== hashFor(nextRoute)) window.location.hash = hashFor(nextRoute);
  };

  const handleDeleteSetlist = (id: string) => {
    updateSetlists((current) => current.filter((setlist) => setlist.id !== id));
    if (route.name === 'setlist' && route.id === id) {
      navigate({ name: 'setlists' });
    }
  };

  const handleRenameSetlist = (id: string, name: string) => {
    updateSetlists((current) =>
      current.map((setlist) => (setlist.id === id ? renameSetlist(setlist, name) : setlist)),
    );
  };

  const handleAddSongToSetlist = (id: string, songId: string) => {
    updateSetlists((current) =>
      current.map((setlist) =>
        setlist.id === id ? addSongToSetlist(setlist, songId) : setlist,
      ),
    );
  };

  const handleRemoveSongFromSetlist = (id: string, songId: string) => {
    updateSetlists((current) =>
      current.map((setlist) =>
        setlist.id === id ? removeSongFromSetlist(setlist, songId) : setlist,
      ),
    );
  };

  const handleMoveSongInSetlist = (id: string, songId: string, direction: -1 | 1) => {
    updateSetlists((current) =>
      current.map((setlist) =>
        setlist.id === id ? moveSongInSetlist(setlist, songId, direction) : setlist,
      ),
    );
  };

  const updatePreferences = (patch: Partial<Preferences>) => {
    setPreferences((previous) => {
      const next = { ...previous, ...patch };
      try {
        savePreferences(storage, next);
      } catch (error) {
        setNotice({
          message:
            error instanceof StorageQuotaError
              ? t('app.preferencesQuota')
              : t('app.preferencesFailed'),
          tone: 'warning',
        });
      }
      return next;
    });
  };

  const saveSong = (target: Song) => {
    try {
      library.save(target);
      songRef.current = target;
      setSong(target);
      refreshLibrary();
      setNotice({ message: t('app.songSaved'), tone: 'success' });
    } catch (error) {
      setNotice({
        message:
          error instanceof StorageQuotaError
            ? t('app.saveQuota')
            : t('app.saveFailed'),
        tone: 'warning',
      });
    }
  };

  const deleteSong = (id: string) => {
    library.remove(id);
    removePractice(storage, id);
    refreshLibrary();
    if (songRef.current?.id === id) {
      songRef.current = null;
      setSong(null);
      replaceAudioUrl(null);
    }
    setNotice({ message: t('app.songDeleted'), tone: 'info' });
  };

  const reanalyzeSong = async (target: Song) => {
    const source = target.source;
    if (source.type !== 'youtube' || reanalyzingId !== null) return;
    setReanalyzingId(target.id);
    const result = await analysisRunner.run((signal) =>
      createYoutubeAnalysis(`https://youtu.be/${source.videoId}`, signal),
    );
    setReanalyzingId(null);
    if (!result) {
      setNotice({ message: t('app.reanalyzeFailed'), tone: 'warning' });
      return;
    }

    const updated: Song = {
      ...target,
      segments: result.segments,
      detectedSegments: result.segments,
      beats: result.beats ?? [],
      beatsPerBar: result.beatsPerBar ?? 4,
      vocalRegions: result.vocalRegions ?? [],
      duration: result.duration,
      analyzerVersion: result.analyzerVersion,
      lyricChordOffsets: undefined,
      lyricChordLines: undefined,
      updatedAt: new Date().toISOString(),
    };

    if (songRef.current?.id === target.id) {
      songRef.current = updated;
      setSong(updated);
    }
    try {
      library.save(updated);
      refreshLibrary();
      setNotice({ message: t('app.reanalyzed'), tone: 'success' });
    } catch {
      setNotice({
        message: t('app.reanalyzedNotSaved'),
        tone: 'warning',
      });
    }
  };

  const exportLibrary = () => {
    const snapshot = library.exportSnapshot();
    if (snapshot.songs.length === 0) {
      setNotice({ message: t('app.exportEmpty'), tone: 'warning' });
      return;
    }
    downloadBackupSnapshot(snapshot.songs, snapshot.folders);
    setNotice({
      message: t('app.exported', {
        count: snapshot.songs.length,
        label: snapshot.songs.length === 1 ? t('common.song') : t('common.songs'),
      }),
      tone: 'success',
    });
  };

  const clearAnalysisCacheAndNotify = () => {
    const removed = clearAnalysisCache(storage);
    setNotice({ message: t('app.cacheCleared', { count: removed }), tone: 'info' });
  };

  const importLibrary = async (file: File) => {
    try {
      const text = await file.text();
      const trimmed = text.trimStart();
      const isJson = file.name.toLowerCase().endsWith('.json') || trimmed.startsWith('{"');

      if (!isJson) {
        const sheet = parseChordPro(text, file.name, preferences);
        library.importSongs([sheet]);
        refreshLibrary();
        setNotice({
          message: t('app.importedSheet', { title: sheet.title }),
          tone: 'success',
        });
        return;
      }

      const imported = parseBackupSnapshot(text);
      const result = library.importSnapshot(imported);
      refreshLibrary();
      setNotice({
        message: t('app.imported', {
          added: result.added,
          addedLabel: result.added === 1 ? t('app.newSong') : t('app.newSongs'),
          updated: result.updated,
          updatedLabel: result.updated === 1 ? t('app.updatedSong') : t('app.updatedSongs'),
        }),
        tone: 'success',
      });
    } catch (error) {
      setNotice({
        message:
          error instanceof BackupError || error instanceof ChordProError
            ? error.message
            : t('app.backupImportFailed'),
        tone: 'warning',
      });
    }
  };

  const createFolder = (name: string) => {
    if (!name.trim()) return;
    try {
      library.createFolder(name);
      refreshLibrary();
      setNotice({ message: t('library.folderCreated'), tone: 'success' });
    } catch {
      setNotice({ message: t('app.saveFailed'), tone: 'warning' });
    }
  };

  const renameFolder = (folder: Folder, name: string) => {
    if (!name.trim() || name.trim() === folder.name) return;
    try {
      if (library.renameFolder(folder.id, name.trim())) {
        refreshLibrary();
        setNotice({ message: t('library.folderRenamed'), tone: 'success' });
      }
    } catch {
      setNotice({ message: t('app.saveFailed'), tone: 'warning' });
    }
  };

  const deleteFolder = (folder: Folder) => {
    if (!window.confirm(t('library.folderDeleteConfirm', { name: folder.name }))) return;
    try {
      if (library.deleteFolder(folder.id)) {
        refreshLibrary();
        setNotice({ message: t('library.folderDeleted'), tone: 'info' });
      }
    } catch {
      setNotice({ message: t('app.saveFailed'), tone: 'warning' });
    }
  };

  const moveSongToFolder = (id: string, folderId: string | null) => {
    try {
      if (library.moveSong(id, folderId)) refreshLibrary();
    } catch {
      setNotice({ message: t('app.saveFailed'), tone: 'warning' });
    }
  };

  const currentSetlist =
    route.name === 'setlist'
      ? setlists.find((setlist) => setlist.id === route.id) ?? null
      : null;

  return (
    <div className="shell">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-line pb-4 sm:items-end">
        <button
          type="button"
          className="flex flex-col items-start gap-1.5 text-left"
          onClick={() => navigate({ name: 'home' })}
        >
          <img
            src="/brand-light.png"
            alt="chordifree"
            className="brand-light h-8 w-auto sm:h-9"
          />
          <img
            src="/brand-dark.png"
            alt="chordifree"
            className="brand-dark h-8 w-auto sm:h-9"
          />
          <span className="hidden font-mono text-[0.56rem] uppercase leading-none tracking-[0.16em] text-ink3 sm:block sm:text-[0.6rem]">
            {t('app.tagline')}
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {desktop ? null : <span className="badge hidden sm:inline-flex">{t('app.localOnly')}</span>}
          <button
            type="button"
            className="btn min-h-0 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em]"
            onClick={() => navigate({ name: 'setlists' })}
          >
            {t('nav.setlists')}
          </button>
          <div className="flex items-center gap-1" role="group" aria-label={t('app.language')}>
            <button
              type="button"
              className={preferences.language === 'en' ? 'tool-chip-active' : 'tool-chip'}
              aria-pressed={preferences.language === 'en'}
              onClick={() => updatePreferences({ language: 'en' })}
            >
              EN
            </button>
            <button
              type="button"
              className={preferences.language === 'es' ? 'tool-chip-active' : 'tool-chip'}
              aria-pressed={preferences.language === 'es'}
              onClick={() => updatePreferences({ language: 'es' })}
            >
              ES
            </button>
          </div>
          <button
            type="button"
            className="btn min-h-0 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em]"
            aria-pressed={preferences.theme === 'dark'}
            onClick={() =>
              updatePreferences({
                theme: preferences.theme === 'light' ? 'dark' : 'light',
              })
            }
          >
            {preferences.theme === 'light' ? t('app.themeLight') : t('app.themeDark')}
          </button>
        </div>
      </header>

      <main className="flex-1 py-7 sm:py-10">
        {updateInfo ? (
          <UpdateBanner
            version={updateInfo.version}
            onDownload={() => window.chordifreeDesktop?.openExternal?.(updateInfo.url)}
            onDismiss={() => setUpdateInfo(null)}
          />
        ) : null}
        {updateNotice ? (
          <div className="mb-4">
            <NoticeBanner
              message={updateNotice}
              tone="info"
              onDismiss={() => setUpdateNotice(null)}
            />
          </div>
        ) : null}
        {route.name === 'home' ? (
          <Home
            storage={storage}
            preferences={preferences}
            analyzerVersion={health.version}
            analyzerStatus={health.status}
            libraryCount={songs.length}
            notice={notice}
            onDismissNotice={() => setNotice(null)}
            onOpenLibrary={() => navigate({ name: 'library' })}
            onAnalyzed={openSong}
          />
        ) : null}

        {route.name === 'library' ? (
          <LibraryList
            songs={songs}
            folders={folders}
            history={history}
            notice={notice}
            onDismissNotice={() => setNotice(null)}
            onExport={exportLibrary}
            onImport={(file) => void importLibrary(file)}
            cache={analysisCacheStats(storage)}
            onClearCache={clearAnalysisCacheAndNotify}
            onOpen={(id) => navigate({ name: 'song', id })}
            onDelete={deleteSong}
            onCreateFolder={createFolder}
            onRenameFolder={renameFolder}
            onDeleteFolder={deleteFolder}
            onMoveSong={moveSongToFolder}
            onBack={() => navigate({ name: 'home' })}
            onHome={() => navigate({ name: 'home' })}
          />
        ) : null}

        {route.name === 'setlists' ? (
          <SetlistList
            setlists={setlists}
            songs={songs}
            onCreate={handleCreateSetlist}
            onDelete={handleDeleteSetlist}
            onOpen={(id) => navigate({ name: 'setlist', id })}
            onBack={() => navigate({ name: 'home' })}
          />
        ) : null}

        {route.name === 'setlist' && currentSetlist ? (
          <SetlistView
            setlist={currentSetlist}
            songs={songs}
            onRename={(name) => handleRenameSetlist(currentSetlist.id, name)}
            onDelete={() => handleDeleteSetlist(currentSetlist.id)}
            onAddSong={(songId) => handleAddSongToSetlist(currentSetlist.id, songId)}
            onRemoveSong={(songId) => handleRemoveSongFromSetlist(currentSetlist.id, songId)}
            onMoveSong={(songId, direction) =>
              handleMoveSongInSetlist(currentSetlist.id, songId, direction)
            }
            onOpenSong={(songId) => navigate({ name: 'song', id: songId })}
            onBack={() => navigate({ name: 'setlists' })}
          />
        ) : null}

        {route.name === 'song' && song ? (
          <SongView
            song={song}
            audioUrl={audioUrl}
            forceFake={forceFake}
            saved={songs.some((item) => item.id === song.id)}
            simplifyChords={preferences.simplifyChords}
            reduceChords={preferences.reduceChords}
            reduceChordsMax={preferences.reduceChordsMax}
            instrument={preferences.instrument}
            gridView={preferences.gridView}
            notice={notice}
            onDismissNotice={() => setNotice(null)}
            onChange={(next) => {
              songRef.current = next;
              setSong(next);
            }}
            onSave={saveSong}
            onReanalyze={() => void reanalyzeSong(song)}
            reanalyzing={reanalyzingId === song.id}
            reanalyzeProgress={
              reanalyzingId === song.id
                ? (analysisRunner.state.view?.progress ??
                  (analysisRunner.state.phase === 'starting' ? 0 : null))
                : null
            }
            onBack={() => navigate({ name: 'home' })}
            onOpenLibrary={() => navigate({ name: 'library' })}
            onPreferences={updatePreferences}
          />
        ) : null}
      </main>

      <footer
        data-testid="site-footer"
        className="mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line pb-2 pt-4 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-ink3"
      >
        <span>{t(desktop ? 'footer.desktopTagline' : 'footer.tagline')}</span>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label={t('footer.links')}>
          {desktop ? (
            <button
              type="button"
              className="transition hover:text-accent"
              onClick={() => void checkForUpdatesNow()}
            >
              {t('update.check')}
            </button>
          ) : null}
          <a
            className="transition hover:text-accent"
            href="https://github.com/moiseslodeiro/chordifree"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('footer.github')}
          </a>
          <a
            className="transition hover:text-accent"
            href="https://www.gnu.org/licenses/agpl-3.0.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('footer.license')}
          </a>
          <a
            className="transition hover:text-accent"
            href="https://essentia.upf.edu/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('footer.essentia')}
          </a>
        </nav>
      </footer>
    </div>
  );
}
