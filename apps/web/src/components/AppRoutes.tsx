import type { AuthValue } from '../auth/AuthProvider';
import { useT } from '../i18n';
import type { AudioCacheState } from '../hooks/useAudioCache';
import type { HealthState } from '../hooks/useHealth';
import { analysisCacheStats } from '../storage/library';
import type { StorageLike } from '../storage/keys';
import type { HistoryMap } from '../storage/history';
import type { CloudStatus } from '../sync/useCloudLibrary';
import type {
  AppNotice,
  CollabRevision,
  CollabShare,
  Preferences,
  Setlist,
  Song,
  SongSummary,
} from '../types';
import type { Route } from '../routing';
import { AdminAccess } from './AdminAccess';
import { Home } from './Home';
import { LibraryList } from './LibraryList';
import { SetlistList } from './SetlistList';
import { SetlistView } from './SetlistView';
import { SongView } from './SongView';

interface AppRoutesProps {
  route: Route;
  song: Song | null;
  audioUrl: string | null;
  forceFake: boolean;
  dirty: boolean;
  songs: SongSummary[];
  history: HistoryMap;
  notice: AppNotice | null;
  storage: StorageLike;
  preferences: Preferences;
  health: HealthState;
  features: AuthValue['features'];
  audioCache: AudioCacheState['stats'];
  cloud: { status: CloudStatus; onSync: () => void } | undefined;
  setlists: Setlist[];
  currentSetlist: Setlist | null;
  reanalyzingId: string | null;
  reanalyzeProgress: number | null;
  onDismissNotice: () => void;
  onNavigate: (route: Route) => void;
  onAnalyzed: (song: Song, audioUrl: string | null) => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onClearCache: () => void;
  onClearAudioCache: () => void;
  onDeleteSong: (id: string) => void;
  onCreateSetlist: (name: string) => void;
  onDeleteSetlist: (id: string) => void;
  onRenameSetlist: (id: string, name: string) => void;
  onAddSetlistSong: (id: string, songId: string) => void;
  onRemoveSetlistSong: (id: string, songId: string) => void;
  onMoveSetlistSong: (id: string, songId: string, direction: -1 | 1) => void;
  onChangeSong: (song: Song) => void;
  onSaveSong: (song: Song) => void;
  onAddToSetlist: (setlistId: string, song: Song) => void;
  onCreateSetlistWithSong: (name: string, song: Song) => void;
  onReanalyze: (song: Song) => void;
  onPreferences: (patch: Partial<Preferences>) => void;
  collabShare: CollabShare | null;
  collabLoading: boolean;
  collabUid: string | null;
  canCollaborate: boolean;
  onShareCollab: (song: Song) => Promise<string | null>;
  onLoadCollabRevision: (revisionId: string) => Promise<CollabRevision | null>;
  onApplyCollabRevision: (revision: CollabRevision) => void;
  onRefreshCollab: () => void;
  onOpenAnalysis: (videoId: string) => Promise<boolean>;
}

export function AppRoutes({
  route,
  song,
  audioUrl,
  forceFake,
  dirty,
  songs,
  history,
  notice,
  storage,
  preferences,
  health,
  features,
  audioCache,
  cloud,
  setlists,
  currentSetlist,
  reanalyzingId,
  reanalyzeProgress,
  onDismissNotice,
  onNavigate,
  onAnalyzed,
  onImport,
  onExport,
  onClearCache,
  onClearAudioCache,
  onDeleteSong,
  onCreateSetlist,
  onDeleteSetlist,
  onRenameSetlist,
  onAddSetlistSong,
  onRemoveSetlistSong,
  onMoveSetlistSong,
  onChangeSong,
  onSaveSong,
  onAddToSetlist,
  onCreateSetlistWithSong,
  onReanalyze,
  onPreferences,
  collabShare,
  collabLoading,
  collabUid,
  canCollaborate,
  onShareCollab,
  onLoadCollabRevision,
  onApplyCollabRevision,
  onRefreshCollab,
  onOpenAnalysis,
}: AppRoutesProps) {
  const t = useT();
  if (route.name === 'collab') {
    return (
      <p className="py-24 text-center text-sm text-ink3" role="status">
        {t('collab.opening')}
      </p>
    );
  }

  if (route.name === 'home') {
    return (
      <Home
        storage={storage}
        preferences={preferences}
        analyzerVersion={health.version}
        analyzerStatus={health.status}
        extractorStatus={health.extractor}
        extractorVersion={health.extractorVersion}
        libraryCount={songs.length}
        notice={notice}
        onDismissNotice={onDismissNotice}
        onOpenLibrary={() => onNavigate({ name: 'library' })}
        onAnalyzed={onAnalyzed}
        youtubeMode={features?.features.youtube ?? 'direct'}
      />
    );
  }

  if (route.name === 'library') {
    return (
      <LibraryList
        songs={songs}
        history={history}
        notice={notice}
        onDismissNotice={onDismissNotice}
        onExport={onExport}
        onImport={onImport}
        cache={analysisCacheStats(storage)}
        onClearCache={onClearCache}
        audioCache={audioCache ?? undefined}
        onClearAudioCache={onClearAudioCache}
        cloud={cloud}
        onOpen={(id) => onNavigate({ name: 'song', id })}
        onDelete={onDeleteSong}
        onBack={() => onNavigate({ name: 'home' })}
        onHome={() => onNavigate({ name: 'home' })}
      />
    );
  }

  if (route.name === 'admin') {
    return (
      <AdminAccess onBack={() => onNavigate({ name: 'library' })} onOpenVideo={onOpenAnalysis} />
    );
  }

  if (route.name === 'setlists') {
    return (
      <SetlistList
        setlists={setlists}
        songs={songs}
        onCreate={onCreateSetlist}
        onDelete={onDeleteSetlist}
        onOpen={(id) => onNavigate({ name: 'setlist', id })}
        onBack={() => onNavigate({ name: 'home' })}
      />
    );
  }

  if (route.name === 'setlist' && currentSetlist) {
    return (
      <SetlistView
        setlist={currentSetlist}
        songs={songs}
        onRename={(name) => onRenameSetlist(currentSetlist.id, name)}
        onDelete={() => onDeleteSetlist(currentSetlist.id)}
        onAddSong={(songId) => onAddSetlistSong(currentSetlist.id, songId)}
        onRemoveSong={(songId) => onRemoveSetlistSong(currentSetlist.id, songId)}
        onMoveSong={(songId, direction) => onMoveSetlistSong(currentSetlist.id, songId, direction)}
        onOpenSong={(songId) => onNavigate({ name: 'song', id: songId })}
        onBack={() => onNavigate({ name: 'setlists' })}
      />
    );
  }

  if (route.name === 'song' && song) {
    return (
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
        onDismissNotice={onDismissNotice}
        onChange={onChangeSong}
        onSave={onSaveSong}
        setlists={setlists}
        onAddToSetlist={(setlistId) => onAddToSetlist(setlistId, song)}
        onCreateSetlistWithSong={(name) => onCreateSetlistWithSong(name, song)}
        onReanalyze={() => onReanalyze(song)}
        reanalyzing={reanalyzingId === song.id}
        reanalyzeProgress={reanalyzingId === song.id ? reanalyzeProgress : null}
        onBack={() => onNavigate({ name: 'home' })}
        onOpenLibrary={() => onNavigate({ name: 'library' })}
        onPreferences={onPreferences}
        language={preferences.language}
        collabShare={collabShare}
        collabLoading={collabLoading}
        collabUid={collabUid}
        canCollaborate={canCollaborate}
        onShareCollab={onShareCollab}
        onLoadCollabRevision={onLoadCollabRevision}
        onApplyCollabRevision={onApplyCollabRevision}
        onRefreshCollab={onRefreshCollab}
      />
    );
  }

  return null;
}
