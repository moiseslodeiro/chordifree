import { useEffect, useMemo, useRef, useState } from 'react';
import { formatTime } from '@chordifree/chords';
import type { Folder, SongHistory, SongSummary } from '../types';
import { useLanguage, useT, type MessageKey } from '../i18n';
import { isDesktopApp } from '../lib/platform';
import { NoticeBanner } from './ErrorBanner';

type SourceFilter = 'all' | 'youtube' | 'upload' | 'sheet';

const SOURCE_FILTERS: { value: SourceFilter; label: MessageKey }[] = [
  { value: 'all', label: 'library.filterAll' },
  { value: 'youtube', label: 'library.filterYoutube' },
  { value: 'upload', label: 'library.filterUpload' },
  { value: 'sheet', label: 'library.filterSheet' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

interface LibraryNotice {
  message: string;
  tone: 'info' | 'warning' | 'success';
}

interface LibraryListProps {
  songs: SongSummary[];
  folders?: Folder[];
  history?: Record<string, SongHistory>;
  notice?: LibraryNotice | null;
  onDismissNotice?: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  cache?: { entries: number; bytes: number };
  onClearCache?: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onCreateFolder?: (name: string) => void;
  onRenameFolder?: (folder: Folder, name: string) => void;
  onDeleteFolder?: (folder: Folder) => void;
  onMoveSong?: (songId: string, folderId: string | null) => void;
  onBack: () => void;
  onHome: () => void;
}

function formatDate(value: string, language: 'en' | 'es'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language === 'es' ? 'es-ES' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LibraryList({
  songs,
  folders = [],
  history = {},
  notice,
  onDismissNotice,
  onExport,
  onImport,
  cache,
  onClearCache,
  onOpen,
  onDelete,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveSong,
  onBack,
  onHome,
}: LibraryListProps) {
  const t = useT();
  const language = useLanguage();
  const desktop = isDesktopApp();
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<SourceFilter>('all');
  const [folder, setFolder] = useState('all');
  const [folderEditor, setFolderEditor] = useState<{
    mode: 'create' | 'rename';
    value: string;
    folderId?: string;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const activeFolder =
    folder !== 'all' && folder !== 'unfiled'
      ? folders.find((item) => item.id === folder) ?? null
      : null;

  useEffect(() => {
    if (folder !== 'all' && folder !== 'unfiled' && !folders.some((item) => item.id === folder)) {
      setFolder('all');
    }
  }, [folder, folders]);

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    return songs.filter((song) => {
      if (source !== 'all' && song.source.type !== source) return false;
      if (folder === 'unfiled' && song.folderId) return false;
      if (folder !== 'all' && folder !== 'unfiled' && song.folderId !== folder) return false;
      if (!needle) return true;
      return normalize(song.title).includes(needle);
    });
  }, [songs, query, source, folder]);

  const hasFilters = query.trim().length > 0 || source !== 'all' || folder !== 'all';
  const clearFilters = () => {
    setQuery('');
    setSource('all');
    setFolder('all');
  };

  return (
    <section
      className="overflow-hidden rounded-2xl border border-line bg-panel shadow-lg"
      aria-label={t('library.title')}
    >
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line p-6 sm:p-8">
        <div>
          <p className="eyebrow">{t('library.eyebrow')}</p>
          <h1 className="display mt-2 text-3xl sm:text-4xl">{t('library.title')}</h1>
          <p className="mt-2 text-sm text-ink2">
            {t(desktop ? 'library.localOnlyDesktop' : 'library.localOnly')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onExport}
            disabled={songs.length === 0}
          >
            {t('library.export')}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => fileInput.current?.click()}
          >
            {t('library.import')}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,.cho,.pro,.crd,.txt,application/json,text/plain"
            className="sr-only"
            aria-label={t('library.importFile')}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onImport(file);
            }}
          />
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            {t('library.back')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onHome}>
            {t('library.analyzeAnother')}
          </button>
        </div>
      </header>

      {notice ? (
        <NoticeBanner message={notice.message} tone={notice.tone} onDismiss={onDismissNotice} />
      ) : null}

      {songs.length === 0 ? (
        <div className="p-10 text-center sm:p-16">
          <p className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {t('library.emptyTitle')}
          </p>
          <p className="mx-auto mt-2 max-w-[40ch] text-sm text-ink2">
            {t('library.emptyBody')}
          </p>
        </div>
      ) : (
        <>
          <div className="border-b border-line px-6 py-4 sm:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[13rem] flex-1">
                <label htmlFor="library-search" className="sr-only">
                  {t('library.searchLabel')}
                </label>
                <input
                  id="library-search"
                  type="search"
                  className="field"
                  placeholder={t('library.searchPlaceholder')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoComplete="off"
                />
              </div>

              <div
                className="flex flex-wrap items-center gap-1"
                role="group"
                aria-label={t('library.filterAria')}
              >
                {SOURCE_FILTERS.map((filter) => {
                  const active = source === filter.value;
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      className={active ? 'tool-chip-active' : 'tool-chip'}
                      aria-pressed={active}
                      onClick={() => setSource(filter.value)}
                    >
                      {t(filter.label)}
                    </button>
                  );
                })}
              </div>

              {hasFilters ? (
                <button type="button" className="btn btn-ghost" onClick={clearFilters}>
                  {t('library.clear')}
                </button>
              ) : null}
            </div>

            <div
              className="mt-3 flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label={t('library.foldersAria')}
            >
              <button
                type="button"
                className={folder === 'all' ? 'tool-chip-active' : 'tool-chip'}
                aria-pressed={folder === 'all'}
                onClick={() => setFolder('all')}
              >
                {t('library.allFolders')}
              </button>
              <button
                type="button"
                className={folder === 'unfiled' ? 'tool-chip-active' : 'tool-chip'}
                aria-pressed={folder === 'unfiled'}
                onClick={() => setFolder('unfiled')}
              >
                {t('library.unfiled')}
              </button>
              {folders.map((item) => {
                const active = folder === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={active ? 'tool-chip-active' : 'tool-chip'}
                    aria-pressed={active}
                    onClick={() => setFolder(item.id)}
                  >
                    {item.name}
                  </button>
                );
              })}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setFolderEditor({ mode: 'create', value: '' })}
              >
                {t('library.newFolder')}
              </button>
              {activeFolder ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      setFolderEditor({
                        mode: 'rename',
                        value: activeFolder.name,
                        folderId: activeFolder.id,
                      })
                    }
                  >
                    {t('library.renameFolder')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => onDeleteFolder?.(activeFolder)}
                  >
                    {t('library.deleteFolder')}
                  </button>
                </>
              ) : null}
              {folderEditor ? (
                <form
                  className="flex flex-wrap items-center gap-1.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const name = folderEditor.value.trim();
                    if (!name) return;
                    if (folderEditor.mode === 'create') {
                      onCreateFolder?.(name);
                    } else {
                      const target = folders.find((item) => item.id === folderEditor.folderId);
                      if (target) onRenameFolder?.(target, name);
                    }
                    setFolderEditor(null);
                  }}
                >
                  <label htmlFor="folder-name" className="sr-only">
                    {t('library.folderPrompt')}
                  </label>
                  <input
                    id="folder-name"
                    className="field max-w-48"
                    value={folderEditor.value}
                    onChange={(event) =>
                      setFolderEditor((current) =>
                        current ? { ...current, value: event.target.value } : current,
                      )
                    }
                    placeholder={t('library.folderPrompt')}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!folderEditor.value.trim()}
                  >
                    {t('common.save')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setFolderEditor(null)}
                  >
                    {t('common.cancel')}
                  </button>
                </form>
              ) : null}
            </div>

            <p
              className="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink3"
              aria-live="polite"
            >
              {t('library.results', {
                count: filtered.length,
                total: songs.length,
                label: songs.length === 1 ? t('common.song') : t('common.songs'),
              })}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center sm:p-16">
              <p className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                {t('library.noResultsTitle')}
              </p>
              <p className="mx-auto mt-2 max-w-[40ch] text-sm text-ink2">
                {t('library.noResults')}
              </p>
              <button type="button" className="btn mt-5" onClick={clearFilters}>
                {t('library.clearFilters')}
              </button>
            </div>
          ) : (
            <ol className="divide-y divide-line">
              {filtered.map((song, index) => (
                <li
                  key={song.id}
                  className="group grid gap-3 px-6 py-4 transition-colors hover:bg-panel-2/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-8"
                >
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => onOpen(song.id)}
                  >
                    <span className="flex items-baseline gap-3">
                      <span className="font-mono text-[0.62rem] tracking-[0.1em] text-ink3">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="truncate font-display text-lg font-bold leading-tight text-ink transition group-hover:text-accent sm:text-xl">
                        {song.title}
                      </span>
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 pl-8 text-xs text-ink3">
                      <span className="badge">
                        {song.source.type === 'youtube'
                          ? 'YouTube'
                          : song.source.type === 'sheet'
                            ? t('library.sheetSource')
                            : t('library.uploadSource')}
                      </span>
                      <span className="font-mono tabular-nums">{formatTime(song.duration)}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {history[song.id]
                          ? t('history.lastPracticed', {
                              date: formatDate(history[song.id]!.lastOpenedAt, language),
                            })
                          : t('history.never')}
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 pl-8 sm:pl-0">
                    <label htmlFor={`folder-${song.id}`} className="sr-only">
                      {t('library.moveToFolder', { title: song.title })}
                    </label>
                    <select
                      id={`folder-${song.id}`}
                      className="tool-select max-w-40 text-xs"
                      value={song.folderId ?? ''}
                      onChange={(event) => onMoveSong?.(song.id, event.target.value || null)}
                    >
                      <option value="">{t('library.noFolder')}</option>
                      {folders.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn" onClick={() => onOpen(song.id)}>
                      {t('common.open')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => {
                        if (
                          window.confirm(
                            t('library.deleteConfirm', { title: song.title }),
                          )
                        ) {
                          onDelete(song.id);
                        }
                      }}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4 text-xs text-ink3 sm:px-8">
        <span>
          {t('library.cacheStats', {
            count: cache?.entries ?? 0,
            size: formatBytes(cache?.bytes ?? 0),
          })}
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!cache?.entries}
          onClick={onClearCache}
        >
          {t('library.clearCache')}
        </button>
      </div>
    </section>
  );
}
