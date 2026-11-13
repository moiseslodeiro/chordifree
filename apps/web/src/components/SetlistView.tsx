import { formatTime } from '@chordifree/chords';
import { useState } from 'react';
import { useT } from '../i18n';
import { emailShareUrl, telegramShareUrl, whatsappShareUrl } from '../lib/share';
import { NoticeBanner } from './ErrorBanner';
import type { Setlist, SongSummary } from '../types';

interface SetlistViewProps {
  setlist: Setlist;
  songs: SongSummary[];
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddSong: (songId: string) => void;
  onRemoveSong: (songId: string) => void;
  onMoveSong: (songId: string, direction: -1 | 1) => void;
  onOpenSong: (songId: string) => void;
  onBack: () => void;
}

export function SetlistView({
  setlist,
  songs,
  onRename,
  onDelete,
  onAddSong,
  onRemoveSong,
  onMoveSong,
  onOpenSong,
  onBack,
}: SetlistViewProps) {
  const t = useT();
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<{
    message: string;
    tone: 'success' | 'warning';
  } | null>(null);
  const byId = new Map(songs.map((song) => [song.id, song]));
  const ordered = setlist.songIds
    .map((id) => byId.get(id))
    .filter((song): song is SongSummary => Boolean(song));
  const missing = setlist.songIds.length - ordered.length;
  const available = songs.filter((song) => !setlist.songIds.includes(song.id));

  const setlistText = () =>
    [
      setlist.name,
      '',
      ...ordered.map((song, index) => `${index + 1}. ${song.title}`),
      '',
      'Chordifree: https://github.com/moiseslodeiro/chordifree',
    ].join('\n');

  const copySetlist = async () => {
    try {
      await navigator.clipboard.writeText(setlistText());
      setShareNotice({ message: t('setlists.copied'), tone: 'success' });
    } catch {
      setShareNotice({ message: t('setlists.copyFailed'), tone: 'warning' });
    }
  };

  const shareSetlist = (target: 'whatsapp' | 'telegram' | 'email') => {
    const text = setlistText();
    if (target === 'email') {
      window.location.href = emailShareUrl(setlist.name, text);
      return;
    }
    const url = target === 'whatsapp' ? whatsappShareUrl(text) : telegramShareUrl(text);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const rename = () => {
    const name = window.prompt(t('setlists.renamePrompt'), setlist.name);
    if (name?.trim()) onRename(name.trim());
  };

  return (
    <section
      className="overflow-hidden rounded-2xl border border-line bg-panel shadow-lg"
      aria-label={setlist.name}
    >
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line p-6 sm:p-8">
        <div className="min-w-0">
          <nav className="flex flex-wrap items-center gap-4" aria-label={t('setlists.title')}>
            <button type="button" className="btn btn-ghost" onClick={onBack}>
              ← {t('setlists.back')}
            </button>
          </nav>
          <p className="eyebrow mt-4">{t('setlists.eyebrow')}</p>
          <h1 className="display mt-2 truncate text-3xl sm:text-4xl">{setlist.name}</h1>
          <p className="mt-2 text-sm text-ink2">
            {t('setlists.songCount', {
              count: ordered.length,
              label: ordered.length === 1 ? t('common.song') : t('common.songs'),
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => setSharing((open) => !open)}>
            {t('setlists.share')}
          </button>
          <button type="button" className="btn" onClick={rename}>
            {t('setlists.rename')}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (window.confirm(t('setlists.deleteConfirm', { name: setlist.name }))) {
                onDelete();
              }
            }}
          >
            {t('common.delete')}
          </button>
        </div>
      </header>

      {sharing ? (
        <div className="border-b border-line px-6 py-4 sm:px-8">
          <p className="eyebrow">{t('setlists.shareTitle')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={() => void copySetlist()}>
              {t('setlists.copy')}
            </button>
            <button type="button" className="btn" onClick={() => shareSetlist('whatsapp')}>
              {t('share.whatsapp')}
            </button>
            <button type="button" className="btn" onClick={() => shareSetlist('telegram')}>
              {t('share.telegram')}
            </button>
            <button type="button" className="btn" onClick={() => shareSetlist('email')}>
              {t('share.email')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSharing(false)}
            >
              {t('common.close')}
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink3">{t('setlists.shareNote')}</p>
          {shareNotice ? (
            <NoticeBanner
              message={shareNotice.message}
              tone={shareNotice.tone}
              onDismiss={() => setShareNotice(null)}
            />
          ) : null}
        </div>
      ) : null}

      <div className="border-b border-line px-6 py-4 sm:px-8">
        <label htmlFor="setlist-add-song" className="eyebrow block">
          {t('setlists.addSong')}
        </label>
        <select
          id="setlist-add-song"
          className="tool-select mt-2 max-w-full sm:max-w-md"
          value=""
          disabled={available.length === 0}
          onChange={(event) => {
            if (event.target.value) onAddSong(event.target.value);
          }}
        >
          <option value="">
            {available.length === 0
              ? t('setlists.noSongsAvailable')
              : t('setlists.addSongPlaceholder')}
          </option>
          {available.map((song) => (
            <option key={song.id} value={song.id}>
              {song.title}
            </option>
          ))}
        </select>
        {missing > 0 ? (
          <p className="mt-2 text-xs text-warning">
            {t('setlists.missingSongs', { count: missing })}
          </p>
        ) : null}
      </div>

      {ordered.length === 0 ? (
        <p className="p-10 text-center text-sm text-ink2 sm:p-16">{t('setlists.emptySongs')}</p>
      ) : (
        <ol className="divide-y divide-line">
          {ordered.map((song, index) => (
            <li
              key={song.id}
              className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 hover:bg-panel-2/40 sm:px-8"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-baseline gap-3 text-left"
                onClick={() => onOpenSong(song.id)}
              >
                <span className="font-mono text-[0.62rem] tracking-[0.1em] text-ink3">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="truncate font-display text-base font-bold text-ink">
                  {song.title}
                </span>
                <span className="badge shrink-0">
                  {song.source.type === 'youtube'
                    ? 'YouTube'
                    : song.source.type === 'sheet'
                      ? t('library.sheetSource')
                      : t('library.uploadSource')}
                </span>
                <span className="font-mono text-xs tabular-nums text-ink3">
                  {formatTime(song.duration)}
                </span>
              </button>
              <div className="flex shrink-0 flex-wrap gap-1">
                <button
                  type="button"
                  className="btn btn-ghost min-h-0 px-2 py-1 text-xs"
                  disabled={index === 0}
                  onClick={() => onMoveSong(song.id, -1)}
                  aria-label={`${t('setlists.moveUp')}: ${song.title}`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-ghost min-h-0 px-2 py-1 text-xs"
                  disabled={index === ordered.length - 1}
                  onClick={() => onMoveSong(song.id, 1)}
                  aria-label={`${t('setlists.moveDown')}: ${song.title}`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn-ghost min-h-0 px-2 py-1 text-xs"
                  onClick={() => onRemoveSong(song.id)}
                >
                  {t('setlists.removeSong')}
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
