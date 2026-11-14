import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useT } from '../i18n';
import type { Setlist } from '../types';

interface AddToSetlistDialogProps {
  songId: string;
  songTitle: string;
  setlists: Setlist[];
  onAdd: (setlistId: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}

export function AddToSetlistDialog({
  songId,
  songTitle,
  setlists,
  onAdd,
  onCreate,
  onClose,
}: AddToSetlistDialogProps) {
  const t = useT();
  const [name, setName] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const create = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 px-4 pb-10 pt-[10vh]"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-setlist-title"
        className="mx-auto w-full max-w-lg rounded-2xl border border-line bg-panel p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{t('setlists.title')}</p>
            <h2 id="add-to-setlist-title" className="display mt-2 text-2xl">
              {t('setlists.addToTitle')}
            </h2>
          </div>
          <button ref={closeRef} type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-ink2">
          {t('setlists.addToBody', { title: songTitle })}
        </p>

        {setlists.length === 0 ? (
          <p className="note note-info mt-4 text-sm leading-relaxed">
            {t('setlists.addToEmpty')}
          </p>
        ) : (
          <ul className="mt-4 max-h-64 divide-y divide-line overflow-y-auto border-y border-line">
            {setlists.map((setlist) => {
              const already = setlist.songIds.includes(songId);
              return (
                <li key={setlist.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left text-sm font-semibold text-ink transition hover:text-accent disabled:cursor-default disabled:text-ink3"
                    disabled={already}
                    onClick={() => {
                      onAdd(setlist.id);
                      onClose();
                    }}
                  >
                    <span className="truncate">{setlist.name}</span>
                    <span className="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink3">
                      {already
                        ? t('setlists.alreadyIn')
                        : t('setlists.songCount', {
                            count: setlist.songIds.length,
                            label:
                              setlist.songIds.length === 1
                                ? t('common.song')
                                : t('common.songs'),
                          })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <form className="mt-5" onSubmit={create}>
          <label htmlFor="add-to-setlist-name" className="tool-label block">
            {t('setlists.addToNew')}
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="add-to-setlist-name"
              className="field min-w-0 flex-1"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('setlists.namePrompt')}
            />
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              {t('setlists.createAndAdd')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
