import { useLanguage, useT } from '../i18n';
import type { Setlist, SongSummary } from '../types';

interface SetlistListProps {
  setlists: Setlist[];
  songs: SongSummary[];
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
  onBack: () => void;
}

function formatDate(value: string, language: 'en' | 'es'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function SetlistList({
  setlists,
  songs,
  onCreate,
  onDelete,
  onOpen,
  onBack,
}: SetlistListProps) {
  const t = useT();
  const language = useLanguage();

  const create = () => {
    const name = window.prompt(t('setlists.namePrompt'));
    if (name?.trim()) onCreate(name.trim());
  };

  return (
    <section
      className="overflow-hidden rounded-2xl border border-line bg-panel shadow-lg"
      aria-label={t('setlists.title')}
    >
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line p-6 sm:p-8">
        <div>
          <p className="eyebrow">{t('setlists.eyebrow')}</p>
          <h1 className="display mt-2 text-3xl sm:text-4xl">{t('setlists.title')}</h1>
          <p className="mt-2 max-w-[52ch] text-sm text-ink2">{t('setlists.description')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            {t('song.back')}
          </button>
          <button type="button" className="btn btn-primary" onClick={create}>
            {t('setlists.new')}
          </button>
        </div>
      </header>

      {setlists.length === 0 ? (
        <div className="p-10 text-center sm:p-16">
          <p className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {t('setlists.emptyTitle')}
          </p>
          <p className="mx-auto mt-2 max-w-[40ch] text-sm text-ink2">
            {t('setlists.emptyBody')}
          </p>
          <button type="button" className="btn btn-primary mt-5" onClick={create}>
            {t('setlists.new')}
          </button>
        </div>
      ) : (
        <ol className="divide-y divide-line">
          {setlists.map((setlist) => {
            const count = setlist.songIds.filter((id) =>
              songs.some((song) => song.id === id),
            ).length;
            return (
              <li
                key={setlist.id}
                className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 hover:bg-panel-2/40 sm:px-8"
              >
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() => onOpen(setlist.id)}
                >
                  <span className="block truncate font-display text-lg font-bold leading-tight text-ink sm:text-xl">
                    {setlist.name}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink3">
                    <span className="badge">
                      {t('setlists.songCount', {
                        count,
                        label: count === 1 ? t('common.song') : t('common.songs'),
                      })}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(setlist.updatedAt, language)}</span>
                  </span>
                </button>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="btn" onClick={() => onOpen(setlist.id)}>
                    {t('common.open')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      if (window.confirm(t('setlists.deleteConfirm', { name: setlist.name }))) {
                        onDelete(setlist.id);
                      }
                    }}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
