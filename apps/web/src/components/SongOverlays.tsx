import { useT } from '../i18n';
import type { AppNotice } from '../types';
import type { Setlist, Song } from '../types';
import { AddToSetlistDialog } from './AddToSetlistDialog';
import { NoticeBanner } from './ErrorBanner';
import { SongShareDialog, type ShareNotice } from './SongShareDialog';

interface SongOverlaysProps {
  performance: boolean;
  onExitPerformance: () => void;
  setlistOpen: boolean;
  song: Song;
  setlists: Setlist[];
  onAddToSetlist: (setlistId: string) => void;
  onCreateSetlistWithSong: (name: string) => void;
  onCloseSetlist: () => void;
  shareOpen: boolean;
  getChordPro: () => string;
  shareNotice: ShareNotice | null;
  notice: AppNotice | null;
  onDismissNotice: () => void;
  onShareNotice: (notice: ShareNotice | null) => void;
  onCloseShare: () => void;
}

/** Floating mode button and the modal dialogs that sit above the song view. */
export function SongOverlays({
  performance,
  onExitPerformance,
  setlistOpen,
  song,
  setlists,
  onAddToSetlist,
  onCreateSetlistWithSong,
  onCloseSetlist,
  shareOpen,
  getChordPro,
  shareNotice,
  notice,
  onDismissNotice,
  onShareNotice,
  onCloseShare,
}: SongOverlaysProps) {
  const t = useT();

  return (
    <>
      {performance ? <h1 className="sr-only">{song.title}</h1> : null}
      {notice ? (
        <NoticeBanner message={notice.message} tone={notice.tone} onDismiss={onDismissNotice} />
      ) : null}
      {performance ? (
        <button
          type="button"
          className="btn btn-secondary fixed bottom-4 right-4 z-[60]"
          onClick={onExitPerformance}
        >
          {t('song.exitPerformance')}
        </button>
      ) : null}

      {setlistOpen ? (
        <AddToSetlistDialog
          songId={song.id}
          songTitle={song.title}
          setlists={setlists}
          onAdd={onAddToSetlist}
          onCreate={onCreateSetlistWithSong}
          onClose={onCloseSetlist}
        />
      ) : null}

      {shareOpen ? (
        <SongShareDialog
          song={song}
          getChordPro={getChordPro}
          notice={shareNotice}
          onNotice={onShareNotice}
          onClose={onCloseShare}
        />
      ) : null}
    </>
  );
}
