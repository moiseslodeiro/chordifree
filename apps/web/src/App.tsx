import { useCallback, useState } from 'react';
import { deleteAccount } from './lib/api';
import { isDesktopApp } from './lib/platform';
import { useAnalysisRunner } from './lib/useAnalysis';
import { useT } from './i18n';
import { NoticeBanner } from './components/ErrorBanner';
import { UpdateBanner } from './components/UpdateBanner';
import { AppHeader } from './components/AppHeader';
import { AppFooter } from './components/AppFooter';
import { AppRoutes } from './components/AppRoutes';
import { useConfirm } from './components/ConfirmDialog';
import { getStorage } from './storage/keys';
import { Library } from './storage/library';
import { loadHistory, markOpened, saveHistory, type HistoryMap } from './storage/history';
import { hasQuarantinedData } from './lib/songState';
import { useAuth } from './auth/AuthProvider';
import { useCloudLibrary } from './sync/useCloudLibrary';
import { usePreferences } from './hooks/usePreferences';
import { useHealth } from './hooks/useHealth';
import { useDesktopUpdates } from './hooks/useDesktopUpdates';
import { useAudioCache } from './hooks/useAudioCache';
import { useSetlistActions } from './hooks/useSetlistActions';
import { useLibraryActions } from './hooks/useLibraryActions';
import { useSharedSongImport } from './hooks/useSharedSongImport';
import { useSongNavigation } from './hooks/useSongNavigation';
import { hashFor, type Route } from './routing';
import type { AppNotice, Song } from './types';

export default function App() {
  const t = useT();
  const auth = useAuth();
  const confirm = useConfirm();
  const desktop = isDesktopApp();
  const [storage] = useState(getStorage);
  const [library] = useState(() => new Library(storage));
  const [notice, setNotice] = useState<AppNotice | null>(() =>
    hasQuarantinedData(storage) ? { message: t('app.storageCorrupt'), tone: 'warning' } : null,
  );
  const { preferences, updatePreferences, resetGridView } = usePreferences(storage, setNotice);
  const health = useHealth();
  const { updateInfo, updateNotice, dismissUpdate, dismissNotice, checkForUpdatesNow } =
    useDesktopUpdates(desktop);
  const analysisRunner = useAnalysisRunner();
  const notifySaveError = useCallback(() => {
    setNotice({ message: t('app.saveFailed'), tone: 'warning' });
  }, [t]);
  const {
    setlists,
    replaceSetlists,
    createList,
    deleteList,
    renameList,
    addSong,
    removeSong,
    moveSong,
    addSongToNewList,
  } = useSetlistActions({ storage, onSaveError: notifySaveError });
  const [history, setHistory] = useState<HistoryMap>(() => loadHistory(storage));
  const [songs, setSongs] = useState(() => library.list());
  const forceFake =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('fakePlayer') === '1';

  const refreshLibrary = useCallback(() => {
    setSongs(library.list());
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

  const {
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
  } = useSongNavigation({
    library,
    setlists,
    recordOpen,
    refreshLibrary,
    resetGridView,
    onNotice: setNotice,
  });

  const { stats: audioCache, clear: clearAudioCacheAndNotify } = useAudioCache(
    route.name === 'library',
    setNotice,
  );

  const cloudEnabled = auth.mode === 'google' && auth.status === 'authenticated';

  const applyCloudSnapshot = useCallback(
    (snapshot: { songs: Song[]; setlists: typeof setlists }) => {
      library.importSnapshot({ songs: snapshot.songs });
      replaceSetlists(snapshot.setlists);
      refreshLibrary();
    },
    [library, refreshLibrary, replaceSetlists],
  );

  const cloud = useCloudLibrary({
    enabled: cloudEnabled,
    songs,
    setlists,
    getSongs: () => library.exportSongs(),
    onMerge: applyCloudSnapshot,
    onNotice: (message, tone) => setNotice({ message, tone }),
  });

  useSharedSongImport({
    library,
    refreshLibrary,
    openSong,
    navigate,
    onNotice: setNotice,
  });

  const {
    reanalyzingId,
    reanalyzeProgress,
    saveSong,
    deleteSong,
    exportLibrary,
    importLibrary,
    clearAnalysisCache,
    reanalyzeSong,
  } = useLibraryActions({
    library,
    storage,
    preferences,
    analysisRunner,
    currentSongRef: songRef,
    setSong,
    setSavedSong,
    replaceAudioUrl,
    refreshLibrary,
    onNotice: setNotice,
  });

  const deleteCloudData = async () => {
    const accepted = await confirm({
      title: t('auth.deleteData'),
      description: t('auth.deleteDataConfirm'),
      confirmLabel: t('auth.deleteData'),
      tone: 'danger',
    });
    if (!accepted) return;
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

  const handleCreateSetlist = (name: string) => {
    const created = createList(name);
    const nextRoute: Route = { name: 'setlist', id: created.id };
    setRoute(nextRoute);
    if (window.location.hash !== hashFor(nextRoute)) window.location.hash = hashFor(nextRoute);
  };

  const handleDeleteSetlist = (id: string) => {
    deleteList(id);
    if (route.name === 'setlist' && route.id === id) {
      navigate({ name: 'setlists' });
    }
  };

  const addCurrentSongToSetlist = (setlistId: string, target: Song) => {
    const setlist = setlists.find((item) => item.id === setlistId);
    if (!setlist) return;
    if (setlist.songIds.includes(target.id)) {
      setNotice({
        message: t('setlists.songAlreadyIn', { name: setlist.name }),
        tone: 'info',
      });
      return;
    }
    addSong(setlistId, target.id);
    setNotice({ message: t('setlists.songAdded', { name: setlist.name }), tone: 'success' });
  };

  const createSetlistWithSong = (name: string, target: Song) => {
    const created = addSongToNewList(name, target.id);
    setNotice({ message: t('setlists.songAdded', { name: created.name }), tone: 'success' });
  };

  const currentSetlist =
    route.name === 'setlist' ? (setlists.find((setlist) => setlist.id === route.id) ?? null) : null;

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
            <NoticeBanner message={updateNotice} tone="info" onDismiss={dismissNotice} />
          </div>
        ) : null}
        <AppRoutes
          route={route}
          song={song}
          audioUrl={audioUrl}
          forceFake={forceFake}
          dirty={dirty}
          songs={songs}
          history={history}
          notice={notice}
          storage={storage}
          preferences={preferences}
          health={health}
          features={auth.features}
          audioCache={audioCache}
          cloud={cloudEnabled ? { status: cloud.status, onSync: cloud.syncNow } : undefined}
          setlists={setlists}
          currentSetlist={currentSetlist}
          reanalyzingId={reanalyzingId}
          reanalyzeProgress={reanalyzeProgress}
          onDismissNotice={() => setNotice(null)}
          onNavigate={navigate}
          onAnalyzed={openSong}
          onImport={(file) => void importLibrary(file)}
          onExport={exportLibrary}
          onClearCache={clearAnalysisCache}
          onClearAudioCache={clearAudioCacheAndNotify}
          onDeleteSong={deleteSong}
          onCreateSetlist={handleCreateSetlist}
          onDeleteSetlist={handleDeleteSetlist}
          onRenameSetlist={renameList}
          onAddSetlistSong={addSong}
          onRemoveSetlistSong={removeSong}
          onMoveSetlistSong={moveSong}
          onChangeSong={(next) => {
            songRef.current = next;
            setSong(next);
          }}
          onSaveSong={saveSong}
          onAddToSetlist={addCurrentSongToSetlist}
          onCreateSetlistWithSong={createSetlistWithSong}
          onReanalyze={(target) => void reanalyzeSong(target)}
          onPreferences={updatePreferences}
        />
      </main>

      <AppFooter desktop={desktop} onCheckUpdates={() => void checkForUpdatesNow()} />
    </div>
  );
}
