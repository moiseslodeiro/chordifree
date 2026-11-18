import { useEffect, useState } from 'react';
import { formatChordOrSilence, resolveAccidental, type Chord } from '@chordifree/chords';
import { useT } from '../i18n';
import { diffSongs, type SongDiff } from '../collab/diff';
import type { CollabRevision, CollabShare, Language, Song } from '../types';

interface CollabPanelProps {
  share: CollabShare;
  song: Song;
  currentUid: string | null;
  language: Language;
  loading: boolean;
  onCopyLink: () => void;
  onRefresh: () => void;
  onLoadRevision: (revisionId: string) => Promise<CollabRevision | null>;
  onApply: (revision: CollabRevision) => void;
}

function formatWhen(value: string, language: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(language === 'es' ? 'es-ES' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function chordFormatter(song: Song): (chord: Chord | null) => string {
  const accidental = resolveAccidental(null, song.accidentalPreference);
  return (chord) => formatChordOrSilence(chord, song.notation, accidental);
}

export function CollabPanel({
  share,
  song,
  currentUid,
  language,
  loading,
  onCopyLink,
  onRefresh,
  onLoadRevision,
  onApply,
}: CollabPanelProps) {
  const t = useT();
  const [openRevision, setOpenRevision] = useState<string | null>(null);
  const [revision, setRevision] = useState<CollabRevision | null>(null);
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState<SongDiff | null>(null);

  const latest = share.revisions[0] ?? null;
  const latestByOther = latest !== null && latest.authorUid !== currentUid;

  useEffect(() => {
    setOpenRevision(null);
    setRevision(null);
    setDiff(null);
  }, [share.currentRevisionId]);

  const open = async (revisionId: string) => {
    if (openRevision === revisionId) {
      setOpenRevision(null);
      setRevision(null);
      setDiff(null);
      return;
    }
    setBusy(true);
    const found = await onLoadRevision(revisionId);
    setBusy(false);
    if (!found) return;
    setOpenRevision(revisionId);
    setRevision(found);
    setDiff(diffSongs(song, found.song, chordFormatter(found.song)));
  };

  return (
    <section
      className="rounded-xl border border-line bg-panel p-3 shadow-sm"
      aria-label={t('collab.title')}
      data-testid="collab-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow">{t('collab.eyebrow')}</p>
          <h2 className="mt-1 text-sm font-semibold text-ink">{t('collab.title')}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="tool-chip" onClick={onRefresh} disabled={loading}>
            {t('collab.refresh')}
          </button>
          <button type="button" className="tool-chip" onClick={onCopyLink}>
            {t('collab.copyLink')}
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs text-ink3">
        {latest
          ? t('collab.lastVersion', {
              name: latest.authorNickname,
              when: formatWhen(latest.createdAt, language),
            })
          : t('collab.noVersions')}
      </p>

      {latestByOther ? (
        <div className="mt-3 rounded-lg border border-accent/40 bg-accent/5 p-2.5">
          <p className="text-xs font-semibold text-ink">
            {t('collab.changedBy', { name: latest.authorNickname })}
          </p>
          <button
            type="button"
            className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-accent"
            onClick={() => void open(latest.id)}
          >
            {openRevision === latest.id ? t('collab.hide') : t('collab.view')}
          </button>
        </div>
      ) : null}

      <div className="mt-3 space-y-1">
        <p className="eyebrow">{t('collab.history')}</p>
        <ul className="divide-y divide-line">
          {share.revisions.slice(0, 10).map((item) => {
            const isOpen = openRevision === item.id;
            return (
              <li key={item.id} className="py-1.5">
                <button
                  type="button"
                  className="flex w-full items-baseline justify-between gap-2 text-left"
                  aria-expanded={isOpen}
                  onClick={() => void open(item.id)}
                >
                  <span className="min-w-0 truncate text-xs font-medium text-ink">
                    {item.authorUid === currentUid ? t('collab.you') : item.authorNickname}
                  </span>
                  <span className="shrink-0 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-ink3">
                    {formatWhen(item.createdAt, language)}
                  </span>
                </button>

                {isOpen && revision ? (
                  <div className="mt-2 rounded-lg border border-line bg-panel-2/40 p-2.5">
                    {busy ? (
                      <p className="text-xs text-ink3">{t('collab.loading')}</p>
                    ) : diff?.empty ? (
                      <p className="text-xs text-ink3">{t('collab.sameAsCurrent')}</p>
                    ) : (
                      <div className="space-y-2 text-xs text-ink2">
                        {diff ? (
                          <>
                            {diff.chords.length > 0 ? (
                              <div>
                                <p className="font-medium text-ink">{t('collab.chords')}</p>
                                <ul className="mt-1 space-y-1">
                                  {diff.chords.slice(0, 12).map((change) => (
                                    <li key={`${change.index}-${change.start}`}>
                                      <span className="font-mono text-[0.6rem] text-ink3">
                                        {formatClock(change.start)}
                                      </span>{' '}
                                      <span className="text-ink3">{change.before || '—'}</span>{' '}
                                      <span aria-hidden="true">→</span>{' '}
                                      <span className="font-semibold text-ink">
                                        {change.after || '—'}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                                {diff.chords.length > 12 ? (
                                  <p className="mt-1 text-[0.65rem] text-ink3">
                                    {t('collab.moreChanges', { count: diff.chords.length - 12 })}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}

                            {diff.lyrics.length > 0 ? (
                              <div>
                                <p className="font-medium text-ink">{t('collab.lyrics')}</p>
                                <ul className="mt-1 space-y-1">
                                  {diff.lyrics.slice(0, 8).map((change, index) => (
                                    <li key={index} className="leading-snug">
                                      {change.type === 'changed' ? (
                                        <>
                                          <span className="text-ink3 line-through">
                                            {change.before}
                                          </span>
                                          <br />
                                          <span className="text-ink">{change.after}</span>
                                        </>
                                      ) : change.type === 'added' ? (
                                        <span className="text-ink">+ {change.after}</span>
                                      ) : (
                                        <span className="text-ink3 line-through">
                                          − {change.before}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {diff.fields.length > 0 ? (
                              <div>
                                <p className="font-medium text-ink">{t('collab.details')}</p>
                                <ul className="mt-1 space-y-1">
                                  {diff.fields.map((field) => (
                                    <li key={field.label}>
                                      <span className="text-ink3">{field.label}:</span>{' '}
                                      <span className="text-ink3">{field.before || '—'}</span>{' '}
                                      <span aria-hidden="true">→</span>{' '}
                                      <span className="text-ink">{field.after || '—'}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <p className="text-xs text-ink3">{t('collab.loading')}</p>
                        )}
                      </div>
                    )}

                    {revision && item.id !== share.currentRevisionId ? (
                      <button
                        type="button"
                        className="btn mt-2 w-full justify-center px-2 py-1 text-xs"
                        onClick={() => onApply(revision)}
                      >
                        {t('collab.load')}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
