import { formatTime } from '@chordifree/chords';
import { useT } from '../i18n';
import type { Song } from '../types';
import { ActionMenu, type ActionMenuItem, type ActionMenuSection } from './ActionMenu';
import { useConfirm } from './ConfirmDialog';
import type { ShareNotice } from './SongShareDialog';

export interface SongHeaderProps {
  song: Song;
  sourceLabel: string;
  saved: boolean;
  dirty: boolean;
  editing: boolean;
  editingLyrics: boolean;
  performance: boolean;
  reanalyzing: boolean;
  reanalyzeProgress: number | null;
  canCollaborate: boolean;
  hasPrintRows: boolean;
  onBack: () => void;
  onOpenLibrary: () => void;
  onToggleEditing: () => void;
  onOpenDetails: () => void;
  onOpenSetlist: () => void;
  onTogglePerformance: () => void;
  onOpenShare: () => void;
  onShareNotice: (notice: ShareNotice | null) => void;
  onShareCollab: (song: Song) => Promise<string | null>;
  onExportScore: () => void;
  onExportMidi: () => void;
  onExportChordPro: () => void;
  onReanalyze: () => void;
  onSave: (song: Song) => void;
}

/** Song title block, primary actions and the overflow menu. */
export function SongHeader({
  song,
  sourceLabel,
  saved,
  dirty,
  editing,
  editingLyrics,
  performance,
  reanalyzing,
  reanalyzeProgress,
  canCollaborate,
  hasPrintRows,
  onBack,
  onOpenLibrary,
  onToggleEditing,
  onOpenDetails,
  onOpenSetlist,
  onTogglePerformance,
  onOpenShare,
  onShareNotice,
  onShareCollab,
  onExportScore,
  onExportMidi,
  onExportChordPro,
  onReanalyze,
  onSave,
}: SongHeaderProps) {
  const t = useT();
  const confirm = useConfirm();
  const idle = !editing && !editingLyrics;

  const collabShareItem: ActionMenuItem = {
    label: t('collab.shareAction'),
    onSelect: () => {
      void (async () => {
        const url = await onShareCollab(song);
        if (!url) {
          onShareNotice({ message: t('collab.createFailed'), tone: 'warning' });
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          onShareNotice({ message: t('collab.linkCopied'), tone: 'success' });
        } catch {
          onShareNotice({ message: t('collab.linkReady', { url }), tone: 'warning' });
        }
      })();
    },
  };

  const songMenuSections = (): ActionMenuSection[] => {
    if (!idle) return [];
    return [
      {
        label: t('menu.song'),
        items: [
          { label: t('song.editDetails'), onSelect: onOpenDetails },
          ...(saved ? [{ label: t('song.addToSetlist'), onSelect: onOpenSetlist }] : []),
          {
            label: performance ? t('song.exitPerformance') : t('song.performance'),
            onSelect: onTogglePerformance,
          },
        ] satisfies ActionMenuItem[],
      },
      {
        label: t('menu.share'),
        items: [
          { label: t('song.share'), onSelect: onOpenShare },
          ...(canCollaborate && saved ? [collabShareItem] : []),
        ] satisfies ActionMenuItem[],
      },
    ];
  };

  const exportMenuSections = (): ActionMenuSection[] => {
    if (!idle || !hasPrintRows) return [];
    return [
      {
        label: t('menu.export'),
        items: [
          { label: t('song.print'), onSelect: () => window.print() },
          { label: t('song.score'), onSelect: onExportScore },
          { label: t('song.midi'), onSelect: onExportMidi },
          { label: t('song.chordpro'), onSelect: onExportChordPro },
        ] satisfies ActionMenuItem[],
      },
    ];
  };

  const analysisMenuSections = (): ActionMenuSection[] => {
    if (!idle || song.source.type !== 'youtube') return [];
    return [
      {
        label: t('menu.analysis'),
        items: [
          {
            label: reanalyzing
              ? `${t('song.reanalyzing')}${
                  reanalyzeProgress !== null ? ` ${reanalyzeProgress}%` : '…'
                }`
              : t('song.reanalyze'),
            onSelect: () => {
              void confirm({
                title: t('song.reanalyze'),
                description: t('song.reanalyzeConfirm'),
                confirmLabel: t('song.reanalyze'),
              }).then((accepted) => {
                if (accepted) onReanalyze();
              });
            },
            disabled: reanalyzing,
          },
        ] satisfies ActionMenuItem[],
      },
    ];
  };

  return (
    <header className="song-header border-b border-line pb-5">
      <nav className="flex flex-wrap items-center gap-5" aria-label={t('song.navAria')}>
        <button
          type="button"
          className="song-crumb font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink3 transition hover:text-accent"
          onClick={onBack}
        >
          {t('song.back')}
        </button>
        <button
          type="button"
          className="song-crumb font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink3 transition hover:text-accent"
          onClick={onOpenLibrary}
        >
          {t('song.library')}
        </button>
      </nav>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="eyebrow">{t('song.eyebrow')}</p>
          <h1 className="display mt-2 truncate text-2xl sm:text-3xl">{song.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink3">
            <span className="badge">{sourceLabel}</span>
            <span className="tabular-nums">{formatTime(song.duration)}</span>
            <span aria-hidden="true">·</span>
            <span>{t('song.analyzer', { version: song.analyzerVersion })}</span>
            {saved ? null : (
              <span className="badge border-accent/50 text-accent">{t('song.unsaved')}</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!editingLyrics ? (
            <button type="button" className="btn" onClick={onToggleEditing}>
              {editing ? t('song.exitEdit') : t('song.editChords')}
            </button>
          ) : null}
          <ActionMenu
            label={t('song.moreActions')}
            sections={[...songMenuSections(), ...exportMenuSections(), ...analysisMenuSections()]}
          />
          {!editingLyrics && (!saved || dirty) ? (
            <button type="button" className="btn btn-primary" onClick={() => onSave(song)}>
              {saved ? t('song.save') : t('song.saveToLibrary')}
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
