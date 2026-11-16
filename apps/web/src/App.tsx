import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createYoutubeAnalysis,
  deleteAccount,
} from './lib/api';
import { isDesktopApp } from './lib/platform';
import { useAnalysisRunner } from './lib/useAnalysis';
import { useT } from './i18n';
import { Home } from './components/Home';
import { NoticeBanner } from './components/ErrorBanner';
import { UpdateBanner } from './components/UpdateBanner';
import { LibraryList } from './components/LibraryList';
import { AdminAccess } from './components/AdminAccess';
import { AppHeader } from './components/AppHeader';
import { AppFooter } from './components/AppFooter';
import { SetlistList } from './components/SetlistList';
import { SetlistView } from './components/SetlistView';
import { SongView } from './components/SongView';
import { getStorage, PREFIX, StorageQuotaError } from './storage/keys';
import { listKeys } from './storage/envelope';
import { BackupError, downloadBackup, parseBackupSnapshot } from './storage/backup';
import { decodeSongFromToken } from './lib/share';
import { ChordProError, parseChordPro } from './lib/chordpro';
import { Library, analysisCacheStats, clearAnalysisCache } from './storage/library';
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
import { useAuth } from './auth/AuthProvider';
import { useCloudLibrary } from './sync/useCloudLibrary';
import { usePreferences } from './hooks/usePreferences';
import { useHealth } from './hooks/useHealth';
import { useDesktopUpdates } from './hooks/useDesktopUpdates';
import { useAudioCache } from './hooks/useAudioCache';
import { hashFor, parseHash, type Route } from './routing';
import type { AppNotice, Setlist, Song } from './types';

/** Static audio shipped with the app (the built-in demo) has no object URL. */
function audioUrlForSong(song: Song): string | null {
  return song.source.type === 'upload' && song.source.filename === 'demo.wav'
    ? '/demo.wav'
    : null;
}

/** Stable comparison that ignores timestamps and object key order. */
function comparableSong(song: Song): string {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, stable(entry)]),
      );
    }
    return value;
  };
  const { updatedAt: _updatedAt, ...rest } = song;
  return JSON.stringify(stable(rest));
}

function songIsDirty(current: Song | null, saved: Song | null): boolean {
  if (!current || !saved) return false;
  return comparableSong(current) !== comparableSong(saved);
}

function hasQuarantinedData(storage: ReturnType<typeof getStorage>): boolean {
  return listKeys(storage, `${PREFIX}:corrupt:`).length > 0;
}

export default function App() {
  const t = useT();
  const auth = useAuth();
  const desktop = isDesktopApp();
  const [storage] = useState(getStorage);
  const [library] = useState(() => new Library(storage));
  const [notice, setNotice] = useState<AppNotice | null>(() =>
    hasQuarantinedData(storage)
      ? {
          message: t('app.storageCorrupt'),
          tone: 'warning',
        }
      : null,
  );
  const { preferences, updatePreferences, resetGridView } = usePreferences(storage, setNotice);
  const health = useHealth();
  const { updateInfo, updateNotice, dismissUpdate, dismissNotice, checkForUpdatesNow } =
    useDesktopUpdates(desktop);
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
  const { stats: audioCache, clear: clearAudioCacheAndNotify } = useAudioCache(
    route.name === 'library',
    setNotice,
  );
  const [song, setSong] = useState<Song | null>(initial.song);
  const [savedSong, setSavedSong] = useState<Song | null>(initial.song);
  const dirty = useMemo(() => songIsDirty(song, savedSong), [song, savedSong]);
  const songRef = useRef<Song | null>(initial.song);
  const shareHandled = useRef(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(
    initial.song ? audioUrlForSong(initial.song) : null,
  );
  const [songs, setSongs] = useState(() => library.list());
  const forceFake =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('fakePlayer') === '1';

  const replaceAudioUrl = useCallback((next: string | null) => {
    setAudioUrl((previous) => {
      if (previous && previous !== next) URL.revokeObjectURL(previous);
      return next;
    });
  }, []);

  const refreshLibrary = useCallback(() => {
    setSongs(library.list());
  }, [library]);

  const cloudEnabled = auth.mode === 'google' && auth.status === 'authenticated';

  const applyCloudSnapshot = useCallback(
    (snapshot: { songs: Song[]; setlists: Setlist[] }) => {
      library.importSnapshot({ songs: snapshot.songs });
      setSetlists(snapshot.setlists);
      try {
        saveSetlists(storage, snapshot.setlists);
      } catch {
        // The local copy remains usable.
      }
      refreshLibrary();
    },
    [library, refreshLibrary, storage],
  );

  const cloud = useCloudLibrary({
    enabled: cloudEnabled,
    songs,
    setlists,
    getSongs: () => library.exportSongs(),
    onMerge: applyCloudSnapshot,
    onNotice: (message, tone) => setNotice({ message, tone }),
  });

  const deleteCloudData = async () => {
    if (!window.confirm(t('auth.deleteDataConfirm'))) return;
    try {
      const result = await deleteAccount();
      setNotice({
        message: t('auth.deleteDataDone', {
          songs: result.songs,
          setlists: result.setlists,
        }),
        tone: 'success',
      });
      if (result.accessRemoved) {
        auth.signOut();
        navigate({ name: 'home' });
      }
    } catch {
      setNotice({ message: t('auth.deleteDataFailed'), tone: 'warning' });
    }
  };


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
    [library, recordOpen, refreshLibrary, replaceAudioUrl, resetGridView, setlists, t],
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

  const addCurrentSongToSetlist = (setlistId: string, song: Song) => {
    const target = setlists.find((setlist) => setlist.id === setlistId);
    if (!target) return;
    if (target.songIds.includes(song.id)) {
      setNotice({
        message: t('setlists.songAlreadyIn', { name: target.name }),
        tone: 'info',
      });
      return;
    }
    handleAddSongToSetlist(setlistId, song.id);
    setNotice({ message: t('setlists.songAdded', { name: target.name }), tone: 'success' });
  };

  const createSetlistWithSong = (name: string, song: Song) => {
    const created = addSongToSetlist(createSetlist(name), song.id);
    updateSetlists((current) => [...current, created]);
    setNotice({ message: t('setlists.songAdded', { name: created.name }), tone: 'success' });
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

  const saveSong = (target: Song) => {
    try {
      library.save(target);
      songRef.current = target;
      setSong(target);
      setSavedSong(target);
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
      setSavedSong(null);
      replaceAudioUrl(null);
    }
    setNotice({ message: t('app.songDeleted'), tone: 'info' });
  };

  useEffect(() => {
    if (reanalyzingId === null) return;
    const progress = analysisRunner.state.view?.progress;
    if (progress === undefined) return;
    setNotice({
      message: t('app.reanalyzingProgress', { progress: Math.round(progress) }),
      tone: 'info',
    });
  }, [analysisRunner.state.view?.progress, reanalyzingId, t]);

  const reanalyzeSong = async (target: Song) => {
    const source = target.source;
    if (source.type !== 'youtube' || reanalyzingId !== null) return;
    setReanalyzingId(target.id);
    setNotice({ message: t('app.reanalyzingProgress', { progress: 0 }), tone: 'info' });
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
      setSavedSong(updated);
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
    downloadBackup(snapshot.songs);
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

  const currentSetlist =
    route.name === 'setlist'
      ? setlists.find((setlist) => setlist.id === route.id) ?? null
      : null;

  return (
    <div className="shell">
      <AppHeader
        auth={auth}
        desktop={desktop}
        preferences={preferences}
        onNavigate={navigate}
        onPreferences={updatePreferences}
        onDeleteCloudData={() => void deleteCloudData()}
      />

      <main className="flex-1 py-7 sm:py-10">
        {updateInfo ? (
          <UpdateBanner
            version={updateInfo.version}
            onDownload={() => window.chordifreeDesktop?.openExternal?.(updateInfo.url)}
            onDismiss={dismissUpdate}
          />
        ) : null}
        {updateNotice ? (
          <div className="mb-4">
            <NoticeBanner
              message={updateNotice}
              tone="info"
              onDismiss={dismissNotice}
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
            youtubeMode={auth.features?.features.youtube ?? 'direct'}
          />
        ) : null}

        {route.name === 'library' ? (
          <LibraryList
            songs={songs}
            history={history}
            notice={notice}
            onDismissNotice={() => setNotice(null)}
            onExport={exportLibrary}
            onImport={(file) => void importLibrary(file)}
            cache={analysisCacheStats(storage)}
            onClearCache={clearAnalysisCacheAndNotify}
            audioCache={audioCache ?? undefined}
            onClearAudioCache={clearAudioCacheAndNotify}
            cloud={
              cloudEnabled ? { status: cloud.status, onSync: cloud.syncNow } : undefined
            }
            onOpen={(id) => navigate({ name: 'song', id })}
            onDelete={deleteSong}
            onBack={() => navigate({ name: 'home' })}
            onHome={() => navigate({ name: 'home' })}
          />
        ) : null}

        {route.name === 'admin' ? (
          <AdminAccess onBack={() => navigate({ name: 'library' })} />
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
            dirty={dirty}
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
            setlists={setlists}
            onAddToSetlist={(setlistId) => addCurrentSongToSetlist(setlistId, song)}
            onCreateSetlistWithSong={(name) => createSetlistWithSong(name, song)}
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

      <AppFooter desktop={desktop} onCheckUpdates={() => void checkForUpdatesNow()} />
    </div>
  );
}
