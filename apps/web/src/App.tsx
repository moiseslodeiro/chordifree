import { useCallback, useEffect, useState } from 'react';
import { createYoutubeAnalysis, deleteAccount, getStemsStatus } from './lib/api';
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
import { useProfile } from './hooks/useProfile';
import { useSongNavigation } from './hooks/useSongNavigation';
import { useCollab } from './collab/useCollab';
import { NicknameDialog } from './components/NicknameDialog';
import { audioUrlForSong } from './lib/songState';
import { hashFor, type Route } from './routing';
import { songFromResult, type AppNotice, type CollabRevision, type Song } from './types';

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

  const openCollabSong = useCallback(
    (next: Song) => {
      library.save(next);
      refreshLibrary();
      openSong(next, audioUrlForSong(next));
    },
    [library, openSong, refreshLibrary],
  );

  const collab = useCollab({
    enabled: cloudEnabled,
    song,
    onNotice: setNotice,
    onOpenSong: openCollabSong,
  });

  const nickname = useProfile(cloudEnabled);
  const [nicknameEditing, setNicknameEditing] = useState(false);
  const [stemsAvailable, setStemsAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getStemsStatus()
      .then((next) => {
        if (!cancelled) setStemsAvailable(next.available);
      })
      .catch(() => {
        if (!cancelled) setStemsAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    onSongSaved: (saved) => void collab.publish(saved),
  });

  const handleShareCollab = useCallback(
    async (target: Song) => {
      if (!cloudEnabled) return null;
      const share = await collab.createShare(target);
      if (!share) return null;
      if (!target.collabId) {
        const updated: Song = { ...target, collabId: share.id };
        library.save(updated);
        songRef.current = updated;
        setSong(updated);
        setSavedSong(updated);
        refreshLibrary();
      }
      return `${window.location.origin}${window.location.pathname}${hashFor({
        name: 'collab',
        id: share.id,
      })}`;
    },
    [cloudEnabled, collab, library, refreshLibrary, setSong, setSavedSong, songRef],
  );

  const handleApplyCollab = useCallback(
    (revision: CollabRevision) => {
      const updated: Song = {
        ...revision.song,
        ...(collab.share ? { collabId: collab.share.id } : {}),
        updatedAt: new Date().toISOString(),
      };
      songRef.current = updated;
      setSong(updated);
      saveSong(updated);
    },
    [collab.share, saveSong, setSong, songRef],
  );

  const openAnalyzedVideo = useCallback(
    async (videoId: string) => {
      const existing = library
        .exportSongs()
        .find((item) => item.source.type === 'youtube' && item.source.videoId === videoId);
      if (existing) {
        openSong(existing, audioUrlForSong(existing));
        return true;
      }
      const result = await analysisRunner.run((signal) =>
        createYoutubeAnalysis(`https://youtu.be/${videoId}`, signal),
      );
      if (!result) return false;
      openSong(songFromResult(result, preferences), null);
      return true;
    },
    [analysisRunner, library, openSong, preferences],
  );

  const [openedCollabId, setOpenedCollabId] = useState<string | null>(null);
  const openCollabLink = collab.openFromLink;
  useEffect(() => {
    if (route.name !== 'collab') {
      if (openedCollabId !== null) setOpenedCollabId(null);
      return;
    }
    if (!cloudEnabled) {
      setNotice({ message: t('collab.requiresSignIn'), tone: 'info' });
      navigate({ name: 'home' });
      return;
    }
    if (openedCollabId === route.id) return;
    setOpenedCollabId(route.id);
    void openCollabLink(route.id);
  }, [cloudEnabled, navigate, openCollabLink, openedCollabId, route, t]);

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
        nickname={nickname.profile?.nickname ?? null}
        stemsAvailable={stemsAvailable}
        onEditNickname={() => setNicknameEditing(true)}
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
          collabShare={collab.share}
          collabLoading={collab.loading}
          collabUid={auth.user?.uid ?? null}
          canCollaborate={cloudEnabled}
          onShareCollab={handleShareCollab}
          onLoadCollabRevision={collab.loadRevision}
          onApplyCollabRevision={handleApplyCollab}
          onRefreshCollab={() => void collab.refresh()}
          onOpenAnalysis={openAnalyzedVideo}
        />
      </main>

      <NicknameDialog
        open={nickname.needsNickname || nicknameEditing}
        required={nickname.needsNickname}
        initial={nickname.profile?.nickname ?? ''}
        onSave={async (value) => {
          await nickname.save(value);
        }}
        onClose={() => setNicknameEditing(false)}
      />

      <AppFooter desktop={desktop} onCheckUpdates={() => void checkForUpdatesNow()} />
    </div>
  );
}
