import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  addAccessEntry,
  listAccessEntries,
  listAnalysisRuns,
  removeAccessEntry,
  type AccessEntry,
  type AnalysisLogEntry,
} from '../lib/api';
import { useLanguage, useT } from '../i18n';
import { useAuth } from '../auth/AuthProvider';
import { useConfirm } from './ConfirmDialog';

interface AdminAccessProps {
  onBack: () => void;
}

function formatDate(value: string, language: 'en' | 'es'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language === 'es' ? 'es-ES' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: string, language: 'en' | 'es'): string {
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

export function AdminAccess({ onBack }: AdminAccessProps) {
  const t = useT();
  const language = useLanguage();
  const auth = useAuth();
  const confirm = useConfirm();
  const [entries, setEntries] = useState<AccessEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [runs, setRuns] = useState<AnalysisLogEntry[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsProblem, setRunsProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setProblem(null);
    try {
      setEntries(await listAccessEntries());
    } catch {
      setProblem(t('admin.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    setRunsProblem(null);
    try {
      setRuns(await listAnalysisRuns());
    } catch {
      setRunsProblem(t('admin.activityError'));
    } finally {
      setRunsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
    void loadRuns();
  }, [load, loadRuns]);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || saving) return;
    setSaving(true);
    setProblem(null);
    try {
      await addAccessEntry(email.trim());
      setEmail('');
      await load();
    } catch {
      setProblem(t('admin.addFailed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entry: AccessEntry) => {
    const accepted = await confirm({
      title: t('admin.remove'),
      description: t('admin.removeConfirm', { email: entry.email }),
      confirmLabel: t('admin.remove'),
      tone: 'danger',
    });
    if (!accepted) return;
    try {
      await removeAccessEntry(entry.email);
      setEntries((current) => current.filter((item) => item.email !== entry.email));
    } catch {
      setProblem(t('admin.error'));
    }
  };

  if (!auth.admin) {
    return (
      <section className="rounded-xl border border-line bg-panel p-6 shadow-sm">
        <h1 className="display text-2xl">{t('admin.title')}</h1>
        <p className="note note-warning mt-4 text-sm">{t('error.forbidden')}</p>
        <button type="button" className="btn mt-4" onClick={onBack}>
          {t('song.back')}
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-lg">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line p-6 sm:p-8">
          <div>
            <p className="eyebrow">{t('auth.admin')}</p>
            <h1 className="display mt-2 text-3xl">{t('admin.title')}</h1>
            <p className="mt-2 max-w-[55ch] text-sm leading-relaxed text-ink2">
              {t('admin.description')}
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            {t('song.back')}
          </button>
        </header>

        <div className="border-b border-line px-6 py-5 sm:px-8">
          <form className="flex flex-wrap items-end gap-3" onSubmit={add}>
            <label className="min-w-[16rem] flex-1">
              <span className="tool-label block">{t('admin.emailLabel')}</span>
              <input
                type="email"
                name="email"
                className="field mt-2 w-full"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {t('admin.add')}
            </button>
          </form>
          {problem ? (
            <p className="note note-warning mt-3 text-sm" role="alert">
              {problem}
            </p>
          ) : null}
        </div>

        {loading ? (
          <p className="p-6 text-sm text-ink3 sm:p-8" role="status">
            {t('admin.loading')}
          </p>
        ) : entries.length === 0 ? (
          <p className="p-6 text-sm text-ink3 sm:p-8">{t('admin.empty')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((entry) => (
              <li
                key={entry.email}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 sm:px-8"
              >
                <div>
                  <p className="font-semibold text-ink">{entry.email}</p>
                  <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink3">
                    {t('admin.addedAt', { date: formatDate(entry.addedAt, language) })}
                  </p>
                </div>
                <button type="button" className="btn btn-danger" onClick={() => void remove(entry)}>
                  {t('admin.remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-lg">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line p-6 sm:p-8">
          <div>
            <p className="eyebrow">{t('auth.admin')}</p>
            <h2 className="display mt-2 text-2xl">{t('admin.activityTitle')}</h2>
            <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink2">
              {t('admin.activityDescription')}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void loadRuns()}
            disabled={runsLoading}
          >
            {t('admin.activityRefresh')}
          </button>
        </header>

        {runsProblem ? (
          <p className="p-6 text-sm text-danger sm:p-8" role="alert">
            {runsProblem}
          </p>
        ) : runsLoading ? (
          <p className="p-6 text-sm text-ink3 sm:p-8" role="status">
            {t('admin.activityLoading')}
          </p>
        ) : runs.length === 0 ? (
          <p className="p-6 text-sm text-ink3 sm:p-8">{t('admin.activityEmpty')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-start justify-between gap-3 px-6 py-4 sm:px-8"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-ink">
                      {run.title ?? run.filename ?? run.videoId ?? '—'}
                    </p>
                    <span className="badge shrink-0">
                      {run.kind === 'youtube'
                        ? t('admin.activityYoutube')
                        : t('admin.activityUpload')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink2">
                    {t('admin.activityBy', { name: run.nickname || run.email })} · {run.email}
                  </p>
                  <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink3">
                    {formatDateTime(run.createdAt, language)} · {run.analyzerVersion} ·{' '}
                    {t('admin.activityChords', { count: run.chords })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
