import { useMemo, useRef, useState } from 'react';
import { formatTime } from '@chordifree/chords';
import type { SongSummary } from '../types';
import { NoticeBanner } from './ErrorBanner';

type SourceFilter = 'all' | 'youtube' | 'upload';

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'youtube', label: 'Vídeos' },
  { value: 'upload', label: 'Archivos' },
];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

interface LibraryNotice {
  message: string;
  tone: 'info' | 'warning' | 'success';
}

interface LibraryListProps {
  songs: SongSummary[];
  notice?: LibraryNotice | null;
  onDismissNotice?: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  onHome: () => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LibraryList({
  songs,
  notice,
  onDismissNotice,
  onExport,
  onImport,
  onOpen,
  onDelete,
  onBack,
  onHome,
}: LibraryListProps) {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<SourceFilter>('all');
  const fileInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    return songs.filter((song) => {
      if (source !== 'all' && song.source.type !== source) return false;
      if (!needle) return true;
      return normalize(song.title).includes(needle);
    });
  }, [songs, query, source]);

  const hasFilters = query.trim().length > 0 || source !== 'all';
  const clearFilters = () => {
    setQuery('');
    setSource('all');
  };

  return (
    <section
      className="overflow-hidden rounded-2xl border border-line bg-panel shadow-lg"
      aria-label="Biblioteca de canciones"
    >
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line p-6 sm:p-8">
        <div>
          <p className="eyebrow">Archivo personal</p>
          <h1 className="display mt-2 text-3xl sm:text-4xl">Biblioteca</h1>
          <p className="mt-2 text-sm text-ink2">
            Tus canciones se guardan solo en este navegador.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onExport}
            disabled={songs.length === 0}
          >
            Exportar JSON
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => fileInput.current?.click()}
          >
            Importar JSON
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-label="Archivo de copia de seguridad"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onImport(file);
            }}
          />
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            Volver
          </button>
          <button type="button" className="btn btn-primary" onClick={onHome}>
            Analizar otra
          </button>
        </div>
      </header>

      {notice ? (
        <div className="border-b border-line px-6 py-3 sm:px-8">
          <NoticeBanner
            message={notice.message}
            tone={notice.tone}
            onDismiss={onDismissNotice}
          />
        </div>
      ) : null}

      {songs.length === 0 ? (
        <div className="p-10 text-center sm:p-16">
          <p className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Todavía no hay canciones
          </p>
          <p className="mx-auto mt-2 max-w-[40ch] text-sm text-ink2">
            Analiza un video o sube un audio y pulsa «Guardar en biblioteca».
          </p>
        </div>
      ) : (
        <>
          <div className="border-b border-line px-6 py-4 sm:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[13rem] flex-1">
                <label htmlFor="library-search" className="sr-only">
                  Buscar canciones
                </label>
                <input
                  id="library-search"
                  type="search"
                  className="field"
                  placeholder="Buscar por título…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoComplete="off"
                />
              </div>

              <div
                className="flex flex-wrap items-center gap-1"
                role="group"
                aria-label="Filtrar por origen"
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
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              {hasFilters ? (
                <button type="button" className="btn btn-ghost" onClick={clearFilters}>
                  Limpiar
                </button>
              ) : null}
            </div>

            <p
              className="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink3"
              aria-live="polite"
            >
              {filtered.length} de {songs.length}{' '}
              {songs.length === 1 ? 'canción' : 'canciones'}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center sm:p-16">
              <p className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                No hay canciones que coincidan
              </p>
              <p className="mx-auto mt-2 max-w-[40ch] text-sm text-ink2">
                Prueba con otro título o cambia el filtro de origen.
              </p>
              <button type="button" className="btn mt-5" onClick={clearFilters}>
                Limpiar filtros
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
                        {song.source.type === 'youtube' ? 'YouTube' : 'Audio subido'}
                      </span>
                      <span className="font-mono tabular-nums">{formatTime(song.duration)}</span>
                      <span aria-hidden="true">·</span>
                      <span>Modificada {formatDate(song.updatedAt)}</span>
                    </span>
                  </button>
                  <div className="flex shrink-0 gap-2 pl-8 sm:pl-0">
                    <button type="button" className="btn" onClick={() => onOpen(song.id)}>
                      Abrir
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => {
                        if (
                          window.confirm(
                            `¿Eliminar «${song.title}» de la biblioteca? Esta acción no se puede deshacer.`,
                          )
                        ) {
                          onDelete(song.id);
                        }
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
